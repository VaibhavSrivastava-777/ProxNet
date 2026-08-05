import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Validate event exists and user is creator or admin
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, starts_at, venue_name, creator_id")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.creator_id !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Only the creator of this Meetup can send reminders." }, { status: 403 });
  }

  // Fetch all RSVPs with status 'yes' or 'maybe'
  const { data: rsvps, error: rsvpError } = await supabase
    .from("event_rsvps")
    .select("user_id, status")
    .eq("event_id", id)
    .in("status", ["yes", "maybe"]);

  if (rsvpError) {
    return NextResponse.json({ error: "Failed to fetch event RSVPs" }, { status: 500 });
  }

  const targetRsvps = rsvps || [];
  let sentCount = 0;

  const startObj = new Date(event.starts_at);
  const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  for (const rsvp of targetRsvps) {
    const targetUserId = rsvp.user_id;

    const messageBody = `Organizer Reminder: "${event.title}" is coming up on ${dateStr} at ${timeStr} (${event.venue_name}).`;

    await sendNotification(targetUserId, {
      title: `Reminder: ${event.title}`,
      body: messageBody,
      url: `/event/${event.id}`
    });

    await supabase.from("event_notifications_log").insert({
      event_id: event.id,
      user_id: targetUserId,
      notification_type: "manual_realtime"
    });

    sentCount++;
  }

  return NextResponse.json({ 
    success: true, 
    sentCount,
    message: `Reminders sent to ${sentCount} attendee(s).`
  });
}
