import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = createAdminClient();

  // Fetch session to get question_id
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("question_id")
    .eq("id", sessionId)
    .maybeSingle();

  let originalQuestion = "";
  if (session?.question_id) {
    const { data: question } = await supabase
      .from("questions")
      .select("body")
      .eq("id", session.question_id)
      .maybeSingle();
    if (question) {
      originalQuestion = question.body;
    }
  }

  const isResident = participant.alias.toLowerCase().startsWith("resident");

  // Fetch last 10 messages for context
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("body, sender_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: participants } = await supabase
    .from("chat_participants")
    .select("user_id, alias")
    .eq("session_id", sessionId);

  const aliasMap = new Map((participants ?? []).map((p) => [p.user_id, p.alias]));

  // Build conversation transcript (reversed so oldest first)
  const transcript = (messages ?? [])
    .slice()
    .reverse()
    .map((m) => {
      const alias = aliasMap.get(m.sender_id) ?? "Anonymous";
      const role = m.sender_id === user.id ? "Me" : alias;
      return `${role}: ${m.body}`;
    })
    .join("\n");

  const myRole = isResident ? "Asker / Job Seeker (Resident)" : "Professional / Responder / Recruiter";
  const otherRole = isResident ? "Professional / Responder / Recruiter" : "Asker / Job Seeker (Resident)";

  const prompt = `You are an AI assistant helping a user ("Me") write replies in an anonymous professional networking chat on a platform called ProxNet.

CONTEXT:
- Original question that started this chat: "${originalQuestion}"
- Current user ("Me") role: ${myRole}
- The other participant's role: ${otherRole}

CONVERSATION TRANSCRIPT SO FAR:
${messages && messages.length > 0 ? transcript : "(No messages yet)"}

YOUR TASK:
Suggest exactly 3 short, natural, and professional next messages that the current user ("Me") could send next.
- Crucial: The suggestions must be written strictly from the perspective of "Me" (${myRole}).
- If the other participant sent the last message, suggest direct answers or responses to their message.
- If "Me" sent the last message (or if the transcript is empty), suggest follow-up questions, icebreakers, or additional context related to the original question and previous messages.
- Keep suggestions concise (under 15 words each), friendly, and conversational.
- Return ONLY a JSON array of 3 strings (e.g., ["option 1", "option 2", "option 3"]), with no markdown formatting or extra text.`;

  try {
    let modelName = "claude-haiku-4-5-20251001";
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    // Fallback to Sonnet if Haiku not available
    if (response.status === 404) {
      modelName = "claude-sonnet-4-6";
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    }

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const result = await response.json();
    let text = (result.content?.[0]?.text || "").trim();

    // Strip markdown code fences if present
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();

    const suggestions = JSON.parse(text);
    if (Array.isArray(suggestions)) {
      return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
    }
    return NextResponse.json({ suggestions: [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
