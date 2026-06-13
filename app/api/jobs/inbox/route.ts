import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: myParticipants, error } = await supabase
    .from("job_participants")
    .select("thread_id")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!myParticipants || myParticipants.length === 0) return NextResponse.json({ threads: [] });

  const threadIds = myParticipants.map(p => p.thread_id);

  const { data: threads } = await supabase
    .from("job_threads")
    .select(`
      id,
      status,
      created_at,
      post:job_posts!post_id(type, role, company, skills),
      responder:job_posts!responder_post_id(type, role, company, skills),
      job_participants(user_id, alias),
      job_messages(body, created_at)
    `)
    .in("id", threadIds)
    .order("created_at", { ascending: false });

  const formatted = (threads || []).map(t => {
    // Sort messages to get the latest
    const messages = t.job_messages || [];
    messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestMessage = messages.length > 0 ? messages[0].body : "No messages yet";
    const latestMessageAt = messages.length > 0 ? messages[0].created_at : t.created_at;

    const otherParticipant = t.job_participants.find((p: any) => p.user_id !== user.id);
    const postObj = Array.isArray(t.post) ? t.post[0] : t.post;

    return {
      id: t.id,
      status: t.status,
      otherAlias: otherParticipant?.alias || "Unknown",
      latestMessage,
      latestMessageAt,
      postType: postObj?.type,
      postRole: postObj?.role
    };
  });

  // Sort threads by latest message time
  formatted.sort((a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime());

  return NextResponse.json({ threads: formatted });
}
