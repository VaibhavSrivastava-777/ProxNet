import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export async function GET(request: Request) {
  return handleEventReminders(request);
}

export async function POST(request: Request) {
  return handleEventReminders(request);
}

async function handleEventReminders(request: Request) {
  // Authorization check (Vercel Cron Secret or Admin Session)
  const authHeader = request.headers.get('authorization');
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const nowTime = now.getTime();

  // Fetch all active upcoming events within 4 days
  const horizon = new Date(nowTime + 4 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id, title, subtitle, description, starts_at, venue_name,
      rsvps:event_rsvps(user_id, status)
    `)
    .eq("status", "active")
    .lte("starts_at", horizon)
    .gte("starts_at", now.toISOString());

  if (error || !events) {
    return NextResponse.json({ error: error?.message || "No events found" }, { status: 500 });
  }

  let sentCount = 0;

  for (const event of events) {
    const startsAt = new Date(event.starts_at).getTime();
    const msUntilStart = startsAt - nowTime;
    const hoursUntilStart = msUntilStart / (1000 * 60 * 60);

    let notificationType = null;
    let messageBody = "";

    const rsvps = event.rsvps || [];
    const goingAndMaybe = rsvps.filter((r: any) => ["yes", "maybe"].includes(r.status));
    const goingOnly = rsvps.filter((r: any) => r.status === "yes");

    const startObj = new Date(event.starts_at);
    const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
    const timeStr = startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

    const rawAgenda = (event.description || "").trim();
    const agendaText = rawAgenda
      ? `📋 Agenda: ${rawAgenda.length > 100 ? rawAgenda.substring(0, 100) + "..." : rawAgenda}`
      : "";

    let notificationTitle = "";

    if (hoursUntilStart <= 72 && hoursUntilStart > 48) {
      notificationType = "3d";
      notificationTitle = `Meetup in 3 Days: ${event.title} • ${dateStr}, ${timeStr} @ ${event.venue_name}`;
      messageBody = agendaText ? `${agendaText} • ${goingOnly.length} going.` : `${goingOnly.length} going. Tap to view details!`;
    } else if (hoursUntilStart <= 24 && hoursUntilStart > 12) {
      notificationType = "1d";
      notificationTitle = `Meetup Tomorrow: ${event.title} • ${dateStr}, ${timeStr} @ ${event.venue_name}`;
      messageBody = agendaText ? `${agendaText}` : `Meetup is tomorrow at ${timeStr}.`;
    } else if (hoursUntilStart <= 4 && hoursUntilStart > 1) {
      notificationType = "4h";
      notificationTitle = `Meetup Soon (4h): ${event.title} • Today, ${timeStr} @ ${event.venue_name}`;
      messageBody = agendaText ? `${agendaText}` : `Starting in 4 hours at ${event.venue_name}.`;
    } else if (hoursUntilStart <= 0.25) {
      notificationType = "start";
      notificationTitle = `Meetup Starting Now: ${event.title} @ ${event.venue_name}`;
      messageBody = agendaText ? `${agendaText} • Tap for directions.` : `Happening now at ${event.venue_name}. Tap for directions.`;
    }

    if (!notificationType) continue;

    const targets = ["4h", "start"].includes(notificationType) ? goingOnly : goingAndMaybe;

    for (const rsvp of targets) {
      const targetUserId = rsvp.user_id;

      // Check if already sent
      const { data: existingLog } = await supabase
        .from("event_notifications_log")
        .select("id")
        .eq("event_id", event.id)
        .eq("user_id", targetUserId)
        .eq("notification_type", notificationType)
        .single();

      if (!existingLog) {
        // Send and log
        await sendNotification(targetUserId, {
          title: notificationTitle,
          body: messageBody,
          url: `/event/${event.id}`
        });

        await supabase.from("event_notifications_log").insert({
          event_id: event.id,
          user_id: targetUserId,
          notification_type: notificationType
        });
        
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
