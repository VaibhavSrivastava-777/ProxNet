import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Public events can be fetched without auth
  const user = await getCurrentUser();
  const supabase = createAdminClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(`
      *,
      creator:users!events_creator_id_fkey(full_name, job_title, company, anonymous_name, profile_photo_url),
      rsvps:event_rsvps(
        status,
        user:users!event_rsvps_user_id_fkey(id, full_name, job_title, company, profile_photo_url)
      ),
      likes:event_likes(id, user_id, comment_id),
      comments:event_comments(id)
    `)
    .eq("id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!event.is_public && !user) {
    return NextResponse.json({ error: "Unauthorized. This event is private." }, { status: 401 });
  }

  // Find current user's RSVP status
  let userRsvp = null;
  if (user) {
    const myRsvp = event.rsvps?.find((r: any) => r.user?.id === user.id);
    userRsvp = myRsvp ? myRsvp.status : null;
  }

  return NextResponse.json({ 
    event,
    userRsvp,
    isAdmin: user?.source === "admin",
    isCreator: user?.id === event.creator_id
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const supabase = createAdminClient();

  // Validate creator
  const { data: event } = await supabase.from("events").select("creator_id").eq("id", id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  
  if (event.creator_id !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const startsAt = body.startsAt || body.starts_at;
  const endsAt = body.endsAt || body.ends_at;
  const venueName = body.venueName || body.venue_name;
  const venueLat = body.venueLat ?? body.venue_lat;
  const venueLng = body.venueLng ?? body.venue_lng;
  const centerLat = body.centerLat ?? body.center_lat ?? venueLat;
  const centerLng = body.centerLng ?? body.center_lng ?? venueLng;

  const { data: updatedEvent, error } = await supabase
    .from("events")
    .update({
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      starts_at: startsAt,
      ends_at: endsAt,
      venue_name: venueName,
      venue_lat: venueLat != null ? Number(venueLat) : null,
      venue_lng: venueLng != null ? Number(venueLng) : null,
      center_lat: centerLat != null ? Number(centerLat) : null,
      center_lng: centerLng != null ? Number(centerLng) : null,
      is_public: body.isPublic ?? body.is_public ?? true,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 1. Reset stale countdown notification logs for this event so daily reminders resume
  try {
    await supabase.from("event_notifications_log").delete().eq("event_id", id);
  } catch (err) {
    console.error("Failed to clear event_notifications_log:", err);
  }

  // 2. Dispatch real-time update notification to 2km neighbors
  if (updatedEvent) {
    const cLat = Number(updatedEvent.center_lat || updatedEvent.venue_lat || 0);
    const cLng = Number(updatedEvent.center_lng || updatedEvent.venue_lng || 0);
    if (cLat && cLng) {
      const { notifyUsersWithin2km } = await import("@/lib/notifications");
      const dateStr = new Date(updatedEvent.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
      notifyUsersWithin2km({
        creatorId: user.id,
        centerLat: cLat,
        centerLng: cLng,
        title: `Updated Meetup nearby: ${updatedEvent.title}`,
        body: `Updated: ${updatedEvent.venue_name} on ${dateStr}. Tap for details & RSVP!`,
        url: `/event/${updatedEvent.id}`,
        data: { eventId: updatedEvent.id, type: "event_updated" }
      }).catch(err => console.error("2km update notification error:", err));
    }
  }

  return NextResponse.json({ event: updatedEvent });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: event } = await supabase.from("events").select("creator_id").eq("id", id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  
  if (event.creator_id !== user.id && user.source !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true });
}
