import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId } = await request.json();
  if (!threadId) return NextResponse.json({ error: "Missing threadId" }, { status: 400 });

  const supabase = createAdminClient();

  // Mark this user as agreed to reveal
  const { error: updateError } = await supabase
    .from("job_participants")
    .update({ reveal_agreed: true })
    .eq("thread_id", threadId)
    .eq("user_id", user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Check if both participants have agreed
  const { data: participants } = await supabase
    .from("job_participants")
    .select("user_id, reveal_agreed")
    .eq("thread_id", threadId);

  const allAgreed = participants?.every(p => p.reveal_agreed);

  if (allAgreed) {
    // Both agreed, reveal!
    await supabase
      .from("job_threads")
      .update({ status: "revealed" })
      .eq("id", threadId);

    // Get the thread info
    const { data: thread } = await supabase
      .from("job_threads")
      .select("post_id, responder_post_id")
      .eq("id", threadId)
      .single();

    if (thread) {
      // For jobs, we don't necessarily decrement seats. We just mark both posts as matched if they want, 
      // but usually a job post is matched once hired. For now, let's leave the posts active 
      // unless they explicitly close them, or we can just mark them matched. 
      // User requested "Keep it simple", so we won't automatically close job posts upon revealing.
    }

    // Insert system message about reveal
    const { data: systemUser } = await supabase.from("users").select("id").eq("email", "system@proxnet.local").maybeSingle();
    const adminId = systemUser?.id || "00000000-0000-0000-0000-000000000000"; // fallback

    await supabase.from("job_messages").insert({
      thread_id: threadId,
      sender_id: adminId, // System admin user id
      body: "Both parties have agreed to reveal their professional profiles. You can now view their contact details above."
    });
  } else {
    await supabase
      .from("job_threads")
      .update({ status: "reveal_pending" })
      .eq("id", threadId);
  }

  return NextResponse.json({ success: true, allAgreed });
}
