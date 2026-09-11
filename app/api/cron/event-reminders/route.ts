import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";
import { haversineDistanceMeters } from "@/lib/geo/haversine";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleEventReminders(request);
}

export async function POST(request: Request) {
  return handleEventReminders(request);
}

async function handleEventReminders(request: Request) {
  // Authorization check (Vercel Cron Secret or Admin Session)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const nowTime = now.getTime();

  // Fetch all active upcoming events within 7 days
  const horizon = new Date(nowTime + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id, title, subtitle, description, starts_at, venue_name,
      venue_lat, venue_lng, center_lat, center_lng, creator_id,
      rsvps:event_rsvps(user_id, status)
    `)
    .eq("status", "active")
    .lte("starts_at", horizon)
    .gte("starts_at", now.toISOString());

  if (error || !events) {
    return NextResponse.json({ error: error?.message || "No events found" }, { status: 500 });
  }

  // Pre-fetch active users and locations once for radius calculations
  const { data: activeUsers } = await supabase
    .from("users")
    .select("id, home_lat, home_lng, office_lat, office_lng")
    .eq("is_active", true)
    .eq("is_blocked", false);

  const { data: currentLocations } = await supabase
    .from("user_current_locations")
    .select("user_id, lat, lng");

  const locationMap = new Map<string, { lat: number; lng: number }>();
  for (const loc of currentLocations || []) {
    if (loc.lat != null && loc.lng != null) {
      locationMap.set(loc.user_id, { lat: Number(loc.lat), lng: Number(loc.lng) });
    }
  }

  let sentCount = 0;

  for (const event of events) {
    const startsAt = new Date(event.starts_at).getTime();
    const msUntilStart = startsAt - nowTime;
    const hoursUntilStart = msUntilStart / (1000 * 60 * 60);

    if (hoursUntilStart <= 0) continue;

    const startObj = new Date(event.starts_at);
    const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
    const timeStr = startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

    const rawAgenda = (event.description || "").trim();
    const agendaText = rawAgenda
      ? `📋 Agenda: ${rawAgenda.length > 100 ? rawAgenda.substring(0, 100) + "..." : rawAgenda}`
      : "";

    // Fetch existing notification logs for this event to avoid duplicate blasts
    const { data: existingLogs } = await supabase
      .from("event_notifications_log")
      .select("user_id, notification_type")
      .eq("event_id", event.id);

    const sentLogSet = new Set<string>();
    for (const log of existingLogs || []) {
      sentLogSet.add(`${log.user_id}_${log.notification_type}`);
    }

    const rsvps = event.rsvps || [];
    const rsvpMap = new Map<string, string>();
    for (const r of rsvps) {
      rsvpMap.set(r.user_id, r.status);
    }

    // -------------------------------------------------------------
    // Branch 1: Daily 2 km Radius Discovery (Days 7 through > 24 Hours)
    // -------------------------------------------------------------
    if (hoursUntilStart <= 7 * 24 && hoursUntilStart > 24) {
      const daysLeft = Math.ceil(hoursUntilStart / 24);
      const radiusNotifType = `radius_2km_${daysLeft}d`;
      const venueLat = Number(event.venue_lat ?? event.center_lat);
      const venueLng = Number(event.venue_lng ?? event.center_lng);

      if (venueLat && venueLng && !isNaN(venueLat) && !isNaN(venueLng)) {
        for (const user of activeUsers || []) {
          // Skip event creator and users who have already RSVPed
          if (user.id === event.creator_id || rsvpMap.has(user.id)) continue;

          // Check if already notified for this countdown day
          if (sentLogSet.has(`${user.id}_${radiusNotifType}`)) continue;

          const currentLoc = locationMap.get(user.id);
          let minDistance = Infinity;

          const locsToCheck: Array<{ lat: number; lng: number }> = [];
          if (user.home_lat != null && user.home_lng != null) {
            locsToCheck.push({ lat: Number(user.home_lat), lng: Number(user.home_lng) });
          }
          if (user.office_lat != null && user.office_lng != null) {
            locsToCheck.push({ lat: Number(user.office_lat), lng: Number(user.office_lng) });
          }
          if (currentLoc) {
            locsToCheck.push(currentLoc);
          }

          for (const loc of locsToCheck) {
            const dist = haversineDistanceMeters(venueLat, venueLng, loc.lat, loc.lng);
            if (dist < minDistance) minDistance = dist;
          }

          // Within 2km radius (or fallback for users with no location configured)
          const isMatch = minDistance <= 2000 || locsToCheck.length === 0;

          if (isMatch) {
            const title = `Meetup in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}: ${event.title} @ ${event.venue_name}`;
            const body = agendaText
              ? `${agendaText} • Happening near you on ${dateStr} at ${timeStr}. Tap to RSVP!`
              : `Happening near you on ${dateStr} at ${timeStr} @ ${event.venue_name}. Tap to view details & RSVP!`;

            await sendNotification(user.id, {
              title,
              body,
              url: `/event/${event.id}`,
              data: { type: "event_radius", eventId: event.id, daysLeft }
            });

            await supabase.from("event_notifications_log").insert({
              event_id: event.id,
              user_id: user.id,
              notification_type: radiusNotifType
            });

            sentLogSet.add(`${user.id}_${radiusNotifType}`);
            sentCount++;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Branch 2: RSVP Reminders (ONLY when <= 24 hours are left)
    // -------------------------------------------------------------
    if (hoursUntilStart <= 24 && hoursUntilStart > 0) {
      const goingAndMaybe = rsvps.filter((r: any) => ["yes", "maybe"].includes(r.status));

      let rsvpNotifType = "rsvp_24h";
      let rsvpTitle = "";
      let rsvpBody = "";

      if (hoursUntilStart > 4) {
        rsvpNotifType = "rsvp_24h";
        rsvpTitle = `Meetup Tomorrow: ${event.title} • ${dateStr}, ${timeStr} @ ${event.venue_name}`;
        rsvpBody = agendaText
          ? `${agendaText}`
          : `Meetup is starting in ${Math.round(hoursUntilStart)}h at ${event.venue_name}. Tap for directions!`;
      } else if (hoursUntilStart > 0.25) {
        rsvpNotifType = "rsvp_4h";
        rsvpTitle = `Meetup Soon (${Math.round(hoursUntilStart)}h): ${event.title} • Today @ ${event.venue_name}`;
        rsvpBody = agendaText
          ? `${agendaText}`
          : `Starting in ~${Math.round(hoursUntilStart)} hours at ${event.venue_name}.`;
      } else {
        rsvpNotifType = "rsvp_start";
        rsvpTitle = `Meetup Starting Now: ${event.title} @ ${event.venue_name}`;
        rsvpBody = `Happening now at ${event.venue_name}. Tap for directions.`;
      }

      for (const rsvp of goingAndMaybe) {
        const targetUserId = rsvp.user_id;
        if (sentLogSet.has(`${targetUserId}_${rsvpNotifType}`)) continue;

        await sendNotification(targetUserId, {
          title: rsvpTitle,
          body: rsvpBody,
          url: `/event/${event.id}`,
          data: { type: "event_reminder", eventId: event.id, hoursUntilStart: Math.round(hoursUntilStart) }
        });

        await supabase.from("event_notifications_log").insert({
          event_id: event.id,
          user_id: targetUserId,
          notification_type: rsvpNotifType
        });

        sentLogSet.add(`${targetUserId}_${rsvpNotifType}`);
        sentCount++;
      }
    }
  }

  // Handle recurring event generation
  // Fetch events that ended in the last 24 hours, have a recurrence rule, and haven't been cloned yet.
  const oneDayAgo = new Date(nowTime - 24 * 60 * 60 * 1000).toISOString();
  const { data: endedRecurring } = await supabase
    .from("events")
    .select("*")
    .eq("status", "active")
    .not("recurrence_rule", "is", null)
    .lte("ends_at", now.toISOString())
    .gte("ends_at", oneDayAgo);

  let recurringCount = 0;
  if (endedRecurring && endedRecurring.length > 0) {
    for (const oldEvent of endedRecurring) {
      // Simple check to avoid double cloning: check if an event with this parent_event_id already exists with starts_at > oldEvent.starts_at
      const { data: existingChild } = await supabase
        .from("events")
        .select("id")
        .eq("parent_event_id", oldEvent.id)
        .gt("starts_at", oldEvent.starts_at)
        .single();
      
      if (!existingChild) {
        // Calculate new dates
        let daysToAdd = 7;
        if (oldEvent.recurrence_rule === "biweekly") daysToAdd = 14;
        if (oldEvent.recurrence_rule === "monthly") daysToAdd = 30; // Approximation

        const newStartsAt = new Date(new Date(oldEvent.starts_at).getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
        const newEndsAt = new Date(new Date(oldEvent.ends_at).getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from("events").insert({
          creator_id: oldEvent.creator_id,
          title: oldEvent.title,
          subtitle: oldEvent.subtitle,
          description: oldEvent.description,
          starts_at: newStartsAt,
          ends_at: newEndsAt,
          venue_name: oldEvent.venue_name,
          venue_lat: oldEvent.venue_lat,
          venue_lng: oldEvent.venue_lng,
          center_lat: oldEvent.center_lat,
          center_lng: oldEvent.center_lng,
          is_public: oldEvent.is_public,
          recurrence_rule: oldEvent.recurrence_rule,
          parent_event_id: oldEvent.id
        });
        recurringCount++;
      }
    }
  }

  return NextResponse.json({ success: true, sentCount, recurringCount });
}
