import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let { targetPostId, myPostId } = await request.json();
  if (!targetPostId) return NextResponse.json({ error: "Missing target id" }, { status: 400 });

  const supabase = createAdminClient();

  // 1. Fetch the target post to get the target user details
  const { data: targetPost } = await supabase
    .from("carpool_posts")
    .select("*")
    .eq("id", targetPostId)
    .single();

  if (!targetPost) return NextResponse.json({ error: "Target post not found" }, { status: 404 });

  // 1b. Create implicit post if myPostId is missing
  if (!myPostId) {
    const implicitType = targetPost.type === "giver" ? "seeker" : "giver";
    const { data: newPost, error: createError } = await supabase
      .from("carpool_posts")
      .insert({
        user_id: user.id,
        type: implicitType,
        start_lat: targetPost.start_lat,
        start_lng: targetPost.start_lng,
        dest_lat: targetPost.dest_lat,
        dest_lng: targetPost.dest_lng,
        date: targetPost.date,
        is_recurring: targetPost.is_recurring,
        recurring_days: targetPost.recurring_days,
        time_start: targetPost.time_start,
        time_end: targetPost.time_end,
        seats: 1, // Defaulting to 1 seat for implicit posts
        status: "implicit"
      })
      .select("id")
      .single();

    if (createError) return NextResponse.json({ error: "Failed to implicitly create route" }, { status: 500 });
    myPostId = newPost.id;
  }

  // 2. Check if thread already exists
  const { data: existing } = await supabase
    .from("carpool_threads")
    .select("id")
    .eq("post_id", targetPostId)
    .eq("responder_post_id", myPostId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ threadId: existing.id });
  }

  // 3. Fetch user details for alias generation

  // Fetch current user details from DB to get fresh job_title and company
  const { data: currentUserDb } = await supabase
    .from("users")
    .select("job_title, company")
    .eq("id", user.id)
    .single();

  // 3. Create thread
  const { data: thread, error: threadError } = await supabase
    .from("carpool_threads")
    .insert({
      post_id: targetPostId,
      responder_post_id: myPostId,
      status: "active"
    })
    .select("id")
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  // 4. Create participants with aliases (Designation @ Company if available)
  const getAlias = (u: any, defaultPrefix: string) => {
    if (u && u.job_title && u.company) {
      return `${u.job_title} @ ${u.company}`;
    }
    return `${defaultPrefix} ` + Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const targetPrefix = targetPost.type === "giver" ? "Driver" : "Passenger";
  const myPrefix = targetPost.type === "giver" ? "Passenger" : "Driver";

  const alias1 = getAlias(targetPost.user, targetPrefix);
  const alias2 = getAlias(currentUserDb, myPrefix);

  await supabase.from("carpool_participants").insert([
    { thread_id: thread.id, user_id: targetPost.user_id, alias: alias1 },
    { thread_id: thread.id, user_id: user.id, alias: alias2 }
  ]);

  return NextResponse.json({ threadId: thread.id });
}
