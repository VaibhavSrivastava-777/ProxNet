import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPastEvent } from "@/lib/date";
import { notifyUsersWithin2km } from "@/lib/notifications";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  let lat = parseFloat(url.searchParams.get("lat") || "");
  let lng = parseFloat(url.searchParams.get("lng") || "");
  const radius = parseInt(url.searchParams.get("radius") || "2000", 10);

  // If lat/lng are invalid, missing, or NaN, resolve from logged in user's profile
  if (isNaN(lat) || isNaN(lng) || !lat || !lng) {
    lat = Number(user.home_lat || user.office_lat || 28.6139);
    lng = Number(user.home_lng || user.office_lng || 77.2090);
  }

  const supabase = createAdminClient();

  const { data: events, error } = await supabase
    .from("events")
    .select(`
      *,
      creator:users!events_creator_id_fkey(full_name, job_title, company, anonymous_name, home_lat, home_lng),
      rsvps:event_rsvps(user_id, status),
      likes:event_likes(id, user_id, comment_id),
      comments:event_comments(id)
    `)
    .eq("status", "active")
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by distance (haversine)
  const toRad = (value: number) => (value * Math.PI) / 180;
  const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredEvents = (events || []).filter((e: any) => {
    // If radius >= 50000 (all distances mode), include all active events
    if (radius >= 50000) return true;

    let eventLat = e.center_lat || e.venue_lat;
    let eventLng = e.center_lng || e.venue_lng;

    if (!eventLat || !eventLng) {
      eventLat = e.creator?.home_lat;
      eventLng = e.creator?.home_lng;
    }

    if (!eventLat || !eventLng) return false;

    const dist = calcDistance(lat, lng, eventLat, eventLng);
    e.distance = dist;
    return dist <= radius;
  });

  return NextResponse.json({ events: filteredEvents });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, subtitle, description, startsAt, endsAt, venueName, venueLat, venueLng, centerLat, centerLng, isPublic } = body;

  if (!title || !startsAt || !endsAt || !venueName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      creator_id: user.id,
      title,
      subtitle: subtitle || null,
      description: description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      venue_name: venueName,
      venue_lat: venueLat || null,
      venue_lng: venueLng || null,
      center_lat: centerLat || venueLat || null,
      center_lng: centerLng || venueLng || null,
      is_public: isPublic ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto RSVP creator as yes
  await supabase.from("event_rsvps").insert({
    event_id: event.id,
    user_id: user.id,
    status: "yes"
  });

  if (event) {
    const cLat = Number(event.center_lat || event.venue_lat || user.home_lat || 0);
    const cLng = Number(event.center_lng || event.venue_lng || user.home_lng || 0);
    notifyUsersWithin2km({
      creatorId: user.id,
      centerLat: cLat,
      centerLng: cLng,
      title: `New Meetup nearby: ${title}`,
      body: `${venueName}${subtitle ? ` · ${subtitle}` : ""}`,
      url: `/event/${event.id}`,
      data: { eventId: event.id }
    }).catch(err => console.error("2km notification error for event:", err));
  }

  return NextResponse.json({ event });
}
