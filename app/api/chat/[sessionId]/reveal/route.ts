import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  const supabase = createAdminClient();

  // Verify participant
  const { data: participant } = await supabase
    .from("chat_participants")
    .select("alias")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch real user info
  const { data: userData } = await supabase
    .from("users")
    .select("full_name, email, linkedin_profile_url")
    .eq("id", user.id)
    .single();

  if (!userData) return NextResponse.json({ error: "User info not found" }, { status: 404 });

  // Generate real identity alias
  const realAlias = userData.full_name || "A ProxNet User";

  // Update alias in chat participants
  await supabase
    .from("chat_participants")
    .update({ alias: realAlias })
    .eq("session_id", sessionId)
    .eq("user_id", user.id);

  // Send automated messages announcing the reveal
  const messagesToInsert = [
    { session_id: sessionId, sender_id: user.id, body: `I have decided to reveal my identity! My name is ${realAlias}.` }
  ];
  if (userData.email) messagesToInsert.push({ session_id: sessionId, sender_id: user.id, body: `Email: ${userData.email}` });
  if (userData.linkedin_profile_url) messagesToInsert.push({ session_id: sessionId, sender_id: user.id, body: `LinkedIn: ${userData.linkedin_profile_url}` });

  const { data: insertedMessages, error } = await supabase
    .from("chat_messages")
    .insert(messagesToInsert)
    .select("id, body, created_at, sender_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the other participant
  try {
    const { data: otherParticipant } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("session_id", sessionId)
      .neq("user_id", user.id)
      .maybeSingle();

    if (otherParticipant) {
      await sendNotification(otherParticipant.user_id, {
        title: "Identity Revealed",
        body: `${realAlias} has revealed their identity in your chat!`,
        url: `/chat/${sessionId}`,
      });
    }
  } catch (err) {
    console.error("Chat reveal notification trigger error:", err);
  }

  return NextResponse.json({
    success: true,
    alias: realAlias,
    messages: (insertedMessages || []).map((m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      alias: realAlias,
      isOwn: true,
    })),
  });
}
