import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const supabase = createAdminClient();

  const body = await request.json();
  const { status } = body; // 'yes', 'no', 'maybe'

  if (!["yes", "no", "maybe"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Validate event exists
  const { data: event } = await supabase.from("events").select("id").eq("id", id).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let targetUserId = user?.id;
  let newAnonCookie: string | null = null;

  if (!targetUserId) {
    // Unauthenticated user -> get or create proxnet_anon_id
    let anonId = cookieStore.get("proxnet_anon_id")?.value;
    if (!anonId) {
      anonId = `anon_${crypto.randomUUID()}`;
      newAnonCookie = anonId;
    }

    // Ensure anonymous user record exists in Supabase users table
    let { data: anonUser } = await supabase
      .from("users")
      .select("id")
      .eq("linkedin_sub", anonId)
      .maybeSingle();

    if (!anonUser) {
      const { data: createdUser, error: createUserErr } = await supabase
        .from("users")
        .insert({
          linkedin_sub: anonId,
          full_name: "Anonymous Professional",
          job_title: "Verified Member",
          company: "Local Network",
          source: "oauth"
        })
        .select("id")
        .single();

      if (createUserErr || !createdUser) {
        return NextResponse.json({ error: "Failed to create anonymous session" }, { status: 500 });
      }
      anonUser = createdUser;
    }

    targetUserId = anonUser.id;
  }

  // Upsert RSVP
  const { data: rsvp, error } = await supabase
    .from("event_rsvps")
    .upsert(
      { 
        event_id: id, 
        user_id: targetUserId, 
        status, 
        updated_at: new Date().toISOString() 
      },
      { onConflict: 'event_id,user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ rsvp, userRsvp: status });

  if (newAnonCookie) {
    response.cookies.set("proxnet_anon_id", newAnonCookie, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });
  }

  return response;
}
