import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Get threads where user is a participant
  const { data: myParticipants, error: pError } = await supabase
    .from("carpool_participants")
    .select("thread_id")
    .eq("user_id", user.id);

  if (pError) return NextResponse.json({ error: pError.message }, { status: 500 });
  
  if (!myParticipants || myParticipants.length === 0) {
    return NextResponse.json({ threads: [] });
  }

  const threadIds = myParticipants.map(p => p.thread_id);

  // 2. Fetch those threads with their status
  const { data: threads, error: tError } = await supabase
    .from("carpool_threads")
    .select("*")
    .in("id", threadIds)
    .order("updated_at", { ascending: false });

  if (tError) return NextResponse.json({ error: tError.message }, { status: 500 });

  // 3. For each thread, get the other participant's alias and the latest message
  // Since we don't have a direct join for "the other participant", we can fetch all participants for these threads
  const { data: allParticipants } = await supabase
    .from("carpool_participants")
    .select("thread_id, user_id, alias")
    .in("thread_id", threadIds);

  // Get the latest message for each thread
  // We can just fetch the latest message per thread. To do this efficiently in Supabase without complex SQL,
  // we can fetch the messages and sort by created_at. If there are many threads, this could be slow, but it's fine for now.
  const { data: latestMessages } = await supabase
    .from("carpool_messages")
    .select("thread_id, body, created_at, sender_id")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  const inbox = (threads || []).map(t => {
    // Find the other participant
    const others = (allParticipants || []).filter(p => p.thread_id === t.id && p.user_id !== user.id);
    const otherAlias = others.length > 0 ? others[0].alias : "Anonymous";
    
    // Find latest message
    const threadMessages = (latestMessages || []).filter(m => m.thread_id === t.id);
    const latestMsg = threadMessages.length > 0 ? threadMessages[0] : null;

    return {
      id: t.id,
      status: t.status,
      otherAlias,
      latestMessage: latestMsg ? {
        body: latestMsg.body,
        created_at: latestMsg.created_at,
        isOwn: latestMsg.sender_id === user.id
      } : null,
      updated_at: t.updated_at
    };
  });

  // Sort by latest message time, or thread updated_at
  inbox.sort((a, b) => {
    const timeA = a.latestMessage ? new Date(a.latestMessage.created_at).getTime() : new Date(a.updated_at).getTime();
    const timeB = b.latestMessage ? new Date(b.latestMessage.created_at).getTime() : new Date(b.updated_at).getTime();
    return timeB - timeA;
  });

  return NextResponse.json({ threads: inbox });
}
