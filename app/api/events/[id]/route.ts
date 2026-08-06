import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

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

  // Find current user's RSVP status (authenticated or anonymous device)
  let userRsvp = null;
  const cookieStore = await cookies();
  const anonId = cookieStore.get("proxnet_anon_id")?.value;

  if (user) {
    const myRsvp = event.rsvps?.find((r: any) => r.user?.id === user.id);
    userRsvp = myRsvp ? myRsvp.status : null;
  } else if (anonId) {
    const { data: anonUser } = await supabase.from("users").select("id").eq("linkedin_sub", anonId).maybeSingle();
    if (anonUser) {
      const myRsvp = event.rsvps?.find((r: any) => r.user?.id === anonUser.id);
      userRsvp = myRsvp ? myRsvp.status : null;
    }
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

  const { data: updatedEvent, error } = await supabase
    .from("events")
    .update({
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      venue_name: body.venueName,
      venue_lat: body.venueLat,
      venue_lng: body.venueLng,
      center_lat: body.centerLat,
      center_lng: body.centerLng,
      is_public: body.isPublic,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
