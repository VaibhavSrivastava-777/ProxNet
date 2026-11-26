import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUserId } = await request.json();
  if (!targetUserId) return NextResponse.json({ error: "Missing target user id" }, { status: 400 });

  const supabase = createAdminClient();

  // Fetch target user to get their home/office coordinates
  const { data: targetUser } = await supabase
    .from("users")
    .select("id, home_lat, home_lng, office_lat, office_lng, job_title, company")
    .eq("id", targetUserId)
    .single();

  if (!targetUser) return NextResponse.json({ error: "Target user not found" }, { status: 404 });

  // Get or create an implicit post for the current user
  let { data: myPost } = await supabase
    .from("carpool_posts")
    .select("id, type")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!myPost) {
    if (!user.home_lat || !user.office_lat) {
      return NextResponse.json({ error: "You must set your Home and Office locations to initiate a direct carpool chat." }, { status: 400 });
    }
    const { data: newMyPost, error: myPostErr } = await supabase
      .from("carpool_posts")
      .insert({
        user_id: user.id,
        type: "seeker",
        start_lat: user.home_lat,
        start_lng: user.home_lng,
        dest_lat: user.office_lat,
        dest_lng: user.office_lng,
        date: new Date().toISOString().split('T')[0],
        time_start: "08:00:00",
        time_end: "09:00:00",
        seats: 1,
        status: "implicit"
      })
      .select("id, type")
      .single();
    if (myPostErr) return NextResponse.json({ error: "Failed to create implicit post for you." }, { status: 500 });
    myPost = newMyPost;
  }

  // Get or create an implicit post for the target user
  let { data: targetPost } = await supabase
    .from("carpool_posts")
    .select("id, type")
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .maybeSingle();

  if (!targetPost) {
    if (!targetUser.home_lat || !targetUser.office_lat) {
      return NextResponse.json({ error: "Target user hasn't fully set their locations." }, { status: 400 });
    }
    const implicitTargetType = myPost.type === "giver" ? "seeker" : "giver";
    const { data: newTargetPost, error: targetPostErr } = await supabase
      .from("carpool_posts")
      .insert({
        user_id: targetUser.id,
        type: implicitTargetType,
        start_lat: targetUser.home_lat,
        start_lng: targetUser.home_lng,
        dest_lat: targetUser.office_lat,
        dest_lng: targetUser.office_lng,
        date: new Date().toISOString().split('T')[0],
        time_start: "08:00:00",
        time_end: "09:00:00",
        seats: 1,
        status: "implicit"
      })
      .select("id, type")
      .single();
    if (targetPostErr) return NextResponse.json({ error: "Failed to create implicit post for target user." }, { status: 500 });
    targetPost = newTargetPost;
  }

  // Check if thread already exists
  const { data: existing } = await supabase
    .from("carpool_threads")
    .select("id")
    .or(`and(post_id.eq.${targetPost.id},responder_post_id.eq.${myPost.id}),and(post_id.eq.${myPost.id},responder_post_id.eq.${targetPost.id})`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ threadId: existing.id });
  }

  // Fetch current user details from DB to get fresh job_title and company
  const { data: currentUserDb } = await supabase
    .from("users")
    .select("job_title, company")
    .eq("id", user.id)
    .single();

  // Create thread
  const { data: thread, error: threadError } = await supabase
    .from("carpool_threads")
    .insert({
      post_id: targetPost.id,
      responder_post_id: myPost.id,
      status: "active"
    })
    .select("id")
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  // Create participants with aliases
  const getAlias = (u: any, defaultPrefix: string) => {
    if (u && u.job_title && u.company) {
      return `${u.job_title} @ ${u.company}`;
    }
    return `${defaultPrefix} ` + Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const targetPrefix = targetPost.type === "giver" ? "Driver" : "Passenger";
  const myPrefix = myPost.type === "giver" ? "Driver" : "Passenger";

  const alias1 = getAlias(targetUser, targetPrefix);
  const alias2 = getAlias(currentUserDb, myPrefix);

  await supabase.from("carpool_participants").insert([
    { thread_id: thread.id, user_id: targetUser.id, alias: alias1 },
    { thread_id: thread.id, user_id: user.id, alias: alias2 }
  ]);

  return NextResponse.json({ threadId: thread.id });
}
