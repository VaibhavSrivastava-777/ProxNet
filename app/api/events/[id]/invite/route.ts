import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userIds } = body; // Array of user IDs to invite

  if (!userIds || !Array.isArray(userIds)) {
    return NextResponse.json({ error: "Invalid userIds" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: event } = await supabase.from("events").select("title, starts_at, venue_name, description").eq("id", id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const startObj = new Date(event.starts_at);
  const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
  const timeStr = startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

  const notificationTitle = `Event Invite: ${event.title} • ${dateStr}, ${timeStr} @ ${event.venue_name}`;

  const rawAgenda = (event.description || "").trim();
  const agendaText = rawAgenda
    ? `📋 Agenda: ${rawAgenda.length > 100 ? rawAgenda.substring(0, 100) + "..." : rawAgenda}`
    : "";

  const invitesToInsert = userIds.map((targetId: string) => ({
    event_id: id,
    invited_by: user.id,
    invited_user_id: targetId,
    invite_status: "sent"
  }));

  // Upsert invites to avoid errors on duplicate
  const { error } = await supabase
    .from("event_invites")
    .upsert(invitesToInsert, { onConflict: "event_id,invited_user_id", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send push notifications
  for (const targetId of userIds) {
    if (targetId !== user.id) {
      await sendNotification(targetId, {
        title: notificationTitle,
        body: `${user.full_name} invited you to this meetup.${agendaText ? ` ${agendaText}` : ""}`,
        url: `/event/${id}`,
      }).catch(e => console.error("Push failed for", targetId, e));
    }
  }

  return NextResponse.json({ success: true });
}
