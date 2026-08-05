import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { haversineDistanceMeters } from "@/lib/geo/haversine";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Validate event exists
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, venue_lat, venue_lng, center_lat, center_lng")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // 1. Fetch count of 'yes' or 'maybe' RSVPs
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("user_id, status")
    .eq("event_id", id)
    .in("status", ["yes", "maybe"]);

  const rsvpCount = (rsvps || []).length;

  // 2. Calculate count of professionals within 2km radius
  const venueLat = event.venue_lat ?? event.center_lat;
  const venueLng = event.venue_lng ?? event.center_lng;

  const { data: users } = await supabase
    .from("users")
    .select("id, home_lat, home_lng, office_lat, office_lng")
    .eq("is_active", true);

  const { data: currentLocations } = await supabase.from("user_current_locations").select("user_id, lat, lng");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  const radius2kmUserIds = new Set<string>();

  for (const u of users || []) {
    const current = locationMap.get(u.id);
    let minDistance = Infinity;

    const locsToCheck = [];
    if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
    if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
    if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

    for (const loc of locsToCheck) {
      const distance = haversineDistanceMeters(venueLat, venueLng, loc.lat, loc.lng);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    if (minDistance <= 2000) {
      radius2kmUserIds.add(u.id);
    }
  }

  return NextResponse.json({
    rsvpCount,
    radius2kmCount: radius2kmUserIds.size
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bodyData: { targetMode?: "rsvp" | "radius_2km" } = {};
  try {
    bodyData = await request.json();
  } catch {
    // default body if empty
  }

  const targetMode = bodyData.targetMode || "rsvp";
  const supabase = createAdminClient();

  // Validate event exists and user is creator or admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, starts_at, venue_name, venue_lat, venue_lng, center_lat, center_lng, creator_id")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.creator_id !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Only the creator of this Meetup can send reminders." }, { status: 403 });
  }

  const targetUserIds = new Set<string>();

  if (targetMode === "radius_2km") {
    const venueLat = event.venue_lat ?? event.center_lat;
    const venueLng = event.venue_lng ?? event.center_lng;

    const { data: users } = await supabase
      .from("users")
      .select("id, home_lat, home_lng, office_lat, office_lng")
      .eq("is_active", true);

    const { data: currentLocations } = await supabase.from("user_current_locations").select("user_id, lat, lng");
    const locationMap = new Map(
      (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
    );

    for (const u of users || []) {
      const current = locationMap.get(u.id);
      let minDistance = Infinity;

      const locsToCheck = [];
      if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
      if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
      if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

      for (const loc of locsToCheck) {
        const distance = haversineDistanceMeters(venueLat, venueLng, loc.lat, loc.lng);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }

      if (minDistance <= 2000) {
        targetUserIds.add(u.id);
      }
    }
  } else {
    // Default RSVP mode ('yes' or 'maybe')
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", id)
      .in("status", ["yes", "maybe"]);

    for (const r of rsvps || []) {
      targetUserIds.add(r.user_id);
    }
  }

  let sentCount = 0;

  const startObj = new Date(event.starts_at);
  const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
  const timeStr = startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  const notificationTitle = targetMode === "radius_2km" ? `Meetup Nearby: ${event.title}` : `Reminder: ${event.title}`;
  const notificationBody = targetMode === "radius_2km"
    ? `ProxNet Meetup alert: "${event.title}" is happening near you on ${dateStr} at ${timeStr} (${event.venue_name}). Tap to view and RSVP!`
    : `Organizer Reminder: "${event.title}" is coming up on ${dateStr} at ${timeStr} (${event.venue_name}).`;

  for (const targetUserId of Array.from(targetUserIds)) {
    await sendNotification(targetUserId, {
      title: notificationTitle,
      body: notificationBody,
      url: `/event/${event.id}`
    });

    await supabase.from("event_notifications_log").insert({
      event_id: event.id,
      user_id: targetUserId,
      notification_type: targetMode === "radius_2km" ? "manual_realtime_2km" : "manual_realtime"
    });

    sentCount++;
  }

  return NextResponse.json({ 
    success: true, 
    sentCount,
    message: `Reminders sent to ${sentCount} professional(s).`
  });
}
