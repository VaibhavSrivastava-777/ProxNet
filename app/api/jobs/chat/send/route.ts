import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { threadId, body } = await request.json();
  if (!threadId || !body) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createAdminClient();

  // Validate participation
  const { data: participant } = await supabase
    .from("job_participants")
    .select("alias")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .single();

  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Insert message
  const { data: msg, error } = await supabase
    .from("job_messages")
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body: body.trim()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get other participant to notify
  const { data: others } = await supabase
    .from("job_participants")
    .select("user_id")
    .eq("thread_id", threadId)
    .neq("user_id", user.id);

  if (others && others.length > 0) {
    const targetUserId = others[0].user_id;
    try {
      await sendNotification(targetUserId, {
        title: `New Message from ${participant.alias}`,
        body: body.length > 60 ? body.substring(0, 60) + "..." : body,
        url: `/jobs/chat/${threadId}`,
        data: { sound: "/car-honk.mp3" } // We can use the same sound or a new one
      });
    } catch (e) {
      console.error("Failed to send notification", e);
    }
  }

  return NextResponse.json({ message: msg });
}
