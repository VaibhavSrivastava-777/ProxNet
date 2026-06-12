import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

async function assertParticipant(sessionId: string, userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("chat_participants")
    .select("alias")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const participant = await assertParticipant(sessionId, user.id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, sender_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: participants } = await supabase
    .from("chat_participants")
    .select("user_id, alias")
    .eq("session_id", sessionId);

  const aliasMap = new Map((participants ?? []).map((p) => [p.user_id, p.alias]));

  const sanitized = (messages ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    alias: aliasMap.get(m.sender_id) ?? "Anonymous",
    isOwn: m.sender_id === user.id,
  }));

  return NextResponse.json({
    messages: sanitized,
    myAlias: participant.alias,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const participant = await assertParticipant(sessionId, user.id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { body } = await request.json();
  if (!body?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      sender_id: user.id,
      body: body.trim(),
    })
    .select("id, body, created_at, sender_id")
    .single();

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
        title: "New Message",
        body: `${participant.alias}: "${body.trim().slice(0, 60)}${body.trim().length > 60 ? "..." : ""}"`,
        url: `/chat/${sessionId}`,
      });
    }
  } catch (err) {
    console.error("Chat message notification trigger error:", err);
  }

  return NextResponse.json({
    message: {
      id: message.id,
      body: message.body,
      created_at: message.created_at,
      alias: participant.alias,
      isOwn: true,
    },
  });
}
