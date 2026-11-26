import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, action, phoneNumber } = await request.json();
  if (!threadId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createAdminClient();

  // 1. Verify thread and participant
  const { data: thread } = await supabase
    .from("carpool_threads")
    .select("*, post:carpool_posts!carpool_threads_post_id_fkey(type, seats, user_id), responder:carpool_posts!carpool_threads_responder_post_id_fkey(type, seats, user_id)")
    .eq("id", threadId)
    .single();

  if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

  const { data: participant } = await supabase
    .from("carpool_participants")
    .select("*")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  if (action === "decline") {
    // Revert thread to active so AI can trigger again later
    await supabase.from("carpool_threads").update({ status: "active" }).eq("id", threadId);
    return NextResponse.json({ ok: true, status: "active" });
  }

  if (action === "agree") {
    // If they provided a new phone number, save it
    if (phoneNumber) {
      await supabase.from("users").update({ phone_number: phoneNumber }).eq("id", user.id);
    }

    // Update their agreement
    await supabase.from("carpool_participants").update({ reveal_agreed: true }).eq("thread_id", threadId).eq("user_id", user.id);

    // Check if the OTHER participant agreed
    const { data: participants } = await supabase
      .from("carpool_participants")
      .select("reveal_agreed")
      .eq("thread_id", threadId);

    const allAgreed = participants?.every(p => p.reveal_agreed === true);

    if (allAgreed) {
      // 1. Update thread status to revealed
      await supabase.from("carpool_threads").update({ status: "revealed" }).eq("id", threadId);

      // 2. Decrement seats
      const giverPost = thread.post.type === "giver" ? thread.post : thread.responder;
      const seekerPost = thread.post.type === "seeker" ? thread.post : thread.responder;
      
      // We assume seeker always needs 1 seat for simplicity, or we check seeker's seats
      const seatsTaken = seekerPost.seats || 1;
      const newSeats = Math.max(0, giverPost.seats - seatsTaken);
      const newGiverStatus = newSeats === 0 ? "matched" : "active";

      // Note: We need to know the IDs to update.
      const giverPostId = thread.post.type === "giver" ? thread.post_id : thread.responder_post_id;
      const seekerPostId = thread.post.type === "seeker" ? thread.post_id : thread.responder_post_id;

      await supabase.from("carpool_posts").update({ seats: newSeats, status: newGiverStatus }).eq("id", giverPostId);
      await supabase.from("carpool_posts").update({ status: "matched" }).eq("id", seekerPostId);

      return NextResponse.json({ ok: true, status: "revealed" });
    }

    return NextResponse.json({ ok: true, status: "reveal_pending" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
