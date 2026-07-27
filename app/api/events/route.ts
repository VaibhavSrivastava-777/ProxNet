import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lng = parseFloat(url.searchParams.get("lng") || "0");
  const radius = parseInt(url.searchParams.get("radius") || "2000", 10);

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing location parameters" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Use a simple distance formula query since we have PostGIS or just raw calculations.
  // Actually, we'll fetch all active events and calculate distance in memory if we don't have a PostGIS function ready.
  // Alternatively, since events are tied to proximity, we can do a naive bounding box or just fetch and filter.
  // We'll fetch upcoming events (starts_at > now() or ends_at > now()) and filter by distance.
  const { data: events, error } = await supabase
    .from("events")
    .select(`
      *,
      creator:users!events_creator_id_fkey(full_name, job_title, company, anonymous_name),
      rsvps:event_rsvps(user_id, status)
    `)
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString())
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
    const dist = calcDistance(lat, lng, e.center_lat, e.center_lng);
    e.distance = dist;
    return dist <= radius;
  });

  return NextResponse.json({ events: filteredEvents });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, subtitle, description, startsAt, endsAt, venueName, venueLat, venueLng, centerLat, centerLng, isPublic, recurrenceRule } = body;

  if (!title || !startsAt || !endsAt || !venueName || !centerLat || !centerLng) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check credit balance
  const { data: userData } = await supabase.from("users").select("wallet").eq("id", user.id).single();
  const currentWallet = userData?.wallet ?? 0;

  if (currentWallet < 1) {
    return NextResponse.json({ error: "Insufficient credits. You need at least 1 credit to create a Meetup." }, { status: 402 });
  }

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
      venue_lat: venueLat,
      venue_lng: venueLng,
      center_lat: centerLat,
      center_lng: centerLng,
      is_public: isPublic ?? true,
      recurrence_rule: recurrenceRule || null
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduct 1 credit point
  await supabase.from("users").update({ wallet: Math.max(0, currentWallet - 1) }).eq("id", user.id);

  // Auto RSVP the creator
  await supabase.from("event_rsvps").insert({
    event_id: event.id,
    user_id: user.id,
    status: "yes"
  });

  return NextResponse.json({ event });
}
