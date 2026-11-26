import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: myParticipants, error } = await supabase
    .from("job_participants")
    .select("thread_id, last_read_at")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!myParticipants || myParticipants.length === 0) return NextResponse.json({ threads: [] });

  const threadIds = myParticipants.map(p => p.thread_id);
  const myReadMap = new Map(myParticipants.map(p => [p.thread_id, p.last_read_at]));

  const { data: threads } = await supabase
    .from("job_threads")
    .select(`
      id,
      status,
      created_at,
      post:job_posts!post_id(type, role, company, skills),
      responder:job_posts!responder_post_id(type, role, company, skills),
      job_participants(user_id, alias, last_read_at),
      job_messages(id, sender_id, body, created_at)
    `)
    .in("id", threadIds)
    .order("created_at", { ascending: false });

  const formatted = (threads || []).map(t => {
    // Sort messages descending to get the latest
    const messages = (t.job_messages || []).slice();
    messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestMsg = messages.length > 0 ? messages[0] : null;
    const latestMessage = latestMsg ? latestMsg.body : "No messages yet";
    const latestMessageAt = latestMsg ? latestMsg.created_at : t.created_at;

    const otherParticipant = t.job_participants?.find((p: any) => p.user_id !== user.id);
    const postObj = Array.isArray(t.post) ? t.post[0] : t.post;
    const responderObj = Array.isArray(t.responder) ? t.responder[0] : t.responder;
    
    // Parse target role and company with backward-compatibility for automated initial messages
    let targetRole = responderObj?.role || postObj?.role || "Referral Opportunity";
    const oldestMessage = messages.length > 0 ? messages[messages.length - 1].body : "";
    const roleMatch = oldestMessage?.match(/📌\s*Role:\s*([^\n\r]+)/i);
    if (roleMatch && roleMatch[1]) {
      targetRole = roleMatch[1].trim();
    }

    let postCompany = postObj?.company || responderObj?.company || "";
    const compMatch = oldestMessage?.match(/🏢\s*Company:\s*([^\n\r]+)/i);
    if (compMatch && compMatch[1] && (!postCompany || postCompany.toLowerCase().includes("colleague"))) {
      postCompany = compMatch[1].trim();
    }

    // Accurate unread status: latest message is from the other party and newer than user's last_read_at
    const myLastRead = myReadMap.get(t.id);
    const isFromOther = Boolean(latestMsg && latestMsg.sender_id !== user.id);
    const isUnread = Boolean(
      isFromOther && (!myLastRead || new Date(latestMsg!.created_at).getTime() > new Date(myLastRead).getTime())
    );

    return {
      id: t.id,
      status: t.status,
      otherAlias: otherParticipant?.alias || "Unknown",
      latestMessage,
      latestMessageAt,
      postType: postObj?.type,
      postRole: targetRole,
      jobTitle: targetRole,
      postCompany,
      unread: isUnread,
    };
  });

  // Sort threads by latest message time
  formatted.sort((a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime());

  return NextResponse.json({ threads: formatted });
}
