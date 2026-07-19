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

  // Mark incoming messages from other participant as read
  await supabase
    .from("chat_messages")
    .update({ is_read: true })
    .eq("session_id", sessionId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  // Fetch session details to get the question
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("question_id, created_at")
    .eq("id", sessionId)
    .maybeSingle();

  let questionMessage = null;
  if (session?.question_id) {
    const { data: question } = await supabase
      .from("questions")
      .select("id, body, created_at, asker_id")
      .eq("id", session.question_id)
      .maybeSingle();

    if (question) {
      // Find the asker's alias from participants
      const { data: askerParticipant } = await supabase
        .from("chat_participants")
        .select("alias")
        .eq("session_id", sessionId)
        .eq("user_id", question.asker_id)
        .maybeSingle();

      questionMessage = {
        id: `q-${question.id}`,
        body: question.body,
        created_at: question.created_at,
        alias: askerParticipant?.alias ?? "Resident",
        isOwn: question.asker_id === user.id,
        isRead: true,
      };
    }
  }

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, sender_id, is_read")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: participants } = await supabase
    .from("chat_participants")
    .select("user_id, alias")
    .eq("session_id", sessionId);

  const aliasMap = new Map((participants ?? []).map((p) => [p.user_id, p.alias]));

  let sanitized = (messages ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    alias: aliasMap.get(m.sender_id) ?? "Anonymous",
    isOwn: m.sender_id === user.id,
    isRead: m.is_read,
  }));

  if (questionMessage) {
    sanitized = [questionMessage, ...sanitized];
  }

  const otherParticipant = (participants ?? []).find((p) => p.user_id !== user.id);
  const otherAlias = otherParticipant?.alias ?? "Anonymous";

  return NextResponse.json({
    messages: sanitized,
    myAlias: participant.alias,
    otherAlias,
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

  // Charge the session (costs 1 credit for new sessions, 0 for existing)
  const { data: charged, error: chargeError } = await supabase.rpc("charge_session", {
    p_user_id: user.id,
    p_session_id: sessionId,
    amount: 1
  });

  if (chargeError) {
    console.error("Wallet charge error:", chargeError);
    return NextResponse.json({ error: "Failed to process payment." }, { status: 500 });
  }

  if (!charged) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

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
      const { data: otherUser } = await supabase
        .from("users")
        .select("source, job_title, company")
        .eq("id", otherParticipant.user_id)
        .maybeSingle();

      if (otherUser && otherUser.source === "simulated") {
        // Run async AI response generation playing the persona
        (async () => {
          try {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return;

            const { data: prevMsgs } = await supabase
              .from("chat_messages")
              .select("body, sender_id")
              .eq("session_id", sessionId)
              .order("created_at", { ascending: true });

            const history = (prevMsgs || []).map((m: any) => ({
              role: m.sender_id === user.id ? "user" : "assistant",
              content: m.body
            }));

            const systemPrompt = `You are a professional local resident networking on ProxNet.
Your Profile:
Role: ${otherUser.job_title}
Company: ${otherUser.company}

You are chatting with a local neighbor who connected with you.
Be helpful, professional, and friendly. Speak naturally as a real human professional. Keep your answers extremely short and concise (1-3 sentences maximum).
Never mention that you are an AI assistant or simulated user. Play your character fully.`;

            const modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
              body: JSON.stringify({
                model: modelName,
                system: systemPrompt,
                max_tokens: 250,
                messages: history,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              const replyText = result.content?.[0]?.text || "";
              if (replyText.trim()) {
                await supabase.from("chat_messages").insert({
                  session_id: sessionId,
                  sender_id: otherParticipant.user_id,
                  body: replyText.trim()
                });
              }
            }
          } catch (e) {
            console.error("Failed to generate simulated professional AI response:", e);
          }
        })();
      } else {
        await sendNotification(otherParticipant.user_id, {
          title: "New Message",
          body: `${participant.alias}: "${body.trim().slice(0, 60)}${body.trim().length > 60 ? "..." : ""}"`,
          url: `/chat/${sessionId}`,
          data: { sessionId }
        });
      }
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const participant = await assertParticipant(sessionId, user.id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { messageId } = await request.json();
  if (!messageId) return NextResponse.json({ error: "Message ID required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: message } = await supabase
    .from("chat_messages")
    .select("sender_id")
    .eq("id", messageId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 444 });
  if (message.sender_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("id", messageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const participant = await assertParticipant(sessionId, user.id);
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { messageId, body } = await request.json();
  if (!messageId || !body?.trim()) return NextResponse.json({ error: "Message ID and body required" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: message } = await supabase
    .from("chat_messages")
    .select("sender_id")
    .eq("id", messageId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 444 });
  if (message.sender_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { error } = await supabase
    .from("chat_messages")
    .update({ body: body.trim() })
    .eq("id", messageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
