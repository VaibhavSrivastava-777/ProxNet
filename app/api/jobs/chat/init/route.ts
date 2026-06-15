import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let { targetPostId, myPostId } = await request.json();
  if (!targetPostId) return NextResponse.json({ error: "Missing target id" }, { status: 400 });

  const supabase = createAdminClient();

  // 1. Check if thread already exists
  const { data: existing } = await supabase
    .from("job_threads")
    .select("id")
    .eq("post_id", targetPostId)
    .eq("responder_post_id", myPostId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ threadId: existing.id });
  }

  // 2. Fetch the target post to get the target user
  const { data: targetPost } = await supabase
    .from("job_posts")
    .select("user_id, type, user:users(job_title, company)")
    .eq("id", targetPostId)
    .single();

  if (!targetPost) return NextResponse.json({ error: "Target post not found" }, { status: 404 });

  const { data: currentUserDb } = await supabase
    .from("users")
    .select("job_title, company")
    .eq("id", user.id)
    .single();

  // 1b. Create implicit post if myPostId is missing
  if (!myPostId) {
    const implicitType = targetPost.type === "giver" ? "seeker" : "giver";
    const { data: newPost, error: createError } = await supabase
      .from("job_posts")
      .insert({
        user_id: user.id,
        type: implicitType,
        role: currentUserDb?.job_title || "Professional",
        company: currentUserDb?.company || "",
        experience_years: 0,
        skills: "",
        status: "active"
      })
      .select("id")
      .single();
      
    if (createError) {
      console.error("Implicit post error:", createError);
      return NextResponse.json({ error: "Failed to implicitly create post" }, { status: 500 });
    }
    myPostId = newPost.id;
  }

  // 3. Create thread
  const { data: thread, error: threadError } = await supabase
    .from("job_threads")
    .insert({
      post_id: targetPostId,
      responder_post_id: myPostId,
      status: "active"
    })
    .select("id")
    .single();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

  // 4. Create participants with aliases
  const getAlias = (u: any, defaultPrefix: string) => {
    if (u && u.job_title && u.company) {
      return `${u.job_title} @ ${u.company}`;
    }
    return `${defaultPrefix} ` + Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const targetPrefix = targetPost.type === "giver" ? "Referrer" : "Candidate";
  const myPrefix = targetPost.type === "giver" ? "Candidate" : "Referrer";

  const alias1 = getAlias(targetPost.user, targetPrefix);
  const alias2 = getAlias(currentUserDb, myPrefix);

  await supabase.from("job_participants").insert([
    { thread_id: thread.id, user_id: targetPost.user_id, alias: alias1 },
    { thread_id: thread.id, user_id: user.id, alias: alias2 }
  ]);

  return NextResponse.json({ threadId: thread.id });
}
