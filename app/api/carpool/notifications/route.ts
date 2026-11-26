import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unreadCount: 0, newMatches: 0 });

  const supabase = createAdminClient();

  // 1. Check for unread messages in carpool chats
  // The simplest way: if there's any message in a thread we are part of
  // that was created AFTER our participant `last_read_at`, it's unread.
  const { data: participants } = await supabase
    .from("carpool_participants")
    .select("thread_id, last_read_at")
    .eq("user_id", user.id);

  let unreadCount = 0;
  if (participants && participants.length > 0) {
    const threadIds = participants.map((p: any) => p.thread_id);
    const { data: messages } = await supabase
      .from("carpool_messages")
      .select("thread_id, created_at, sender_id")
      .in("thread_id", threadIds)
      .neq("sender_id", user.id); // don't count our own messages

    if (messages) {
      for (const p of participants) {
        const lastRead = p.last_read_at ? new Date(p.last_read_at).getTime() : 0;
        const unreadForThread = messages.filter(
          (m: any) => m.thread_id === p.thread_id && new Date(m.created_at).getTime() > lastRead
        ).length;
        unreadCount += unreadForThread;
      }
    }
  }

  // 2. Check for new matches
  // If we have an active post, and there are candidates of the opposite type
  // created after our `last_checked_matches_at`
  let newMatches = 0;
  const { data: myPosts } = await supabase
    .from("carpool_posts")
    .select("type, last_checked_matches_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);

  if (myPosts && myPosts.length > 0) {
    const myPost = myPosts[0];
    const targetType = myPost.type === "giver" ? "seeker" : "giver";
    const lastChecked = myPost.last_checked_matches_at 
      ? new Date(myPost.last_checked_matches_at).toISOString() 
      : new Date(0).toISOString();

    const { count } = await supabase
      .from("carpool_posts")
      .select("*", { count: 'exact', head: true })
      .eq("type", targetType)
      .eq("status", "active")
      .gt("created_at", lastChecked);

    newMatches = count || 0;
  }

  return NextResponse.json({ unreadCount, newMatches });
}
