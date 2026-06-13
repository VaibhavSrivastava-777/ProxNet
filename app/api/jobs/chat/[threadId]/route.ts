import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Validate participation
  const { data: participant } = await supabase
    .from("job_participants")
    .select("*")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .single();

  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get thread status and all participants
  const { data: thread } = await supabase
    .from("job_threads")
    .select("*, job_participants(user_id, alias, reveal_agreed), post:job_posts!post_id(type, role, company)")
    .eq("id", threadId)
    .single();

  const myAlias = thread.job_participants.find((p: any) => p.user_id === user.id)?.alias;
  const otherParticipant = thread.job_participants.find((p: any) => p.user_id !== user.id);

  // If revealed, we can fetch their linkedin URL or email instead of phone number
  let otherContact = null;
  if (thread.status === "revealed" && otherParticipant) {
    const { data: otherUser } = await supabase
      .from("users")
      .select("linkedin_profile_url, email")
      .eq("id", otherParticipant.user_id)
      .single();
    if (otherUser) {
      otherContact = otherUser.linkedin_profile_url || otherUser.email;
    }
  }

  // Get messages
  const { data: messages } = await supabase
    .from("job_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const myRevealAgreed = thread.job_participants.find((p: any) => p.user_id === user.id)?.reveal_agreed;
  const otherRevealAgreed = otherParticipant?.reveal_agreed;

  return NextResponse.json({
    thread,
    messages,
    myAlias,
    otherAlias: otherParticipant?.alias,
    myRevealAgreed,
    otherRevealAgreed,
    otherContact
  });
}
