import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Helper to ensure AI user and Chat Session exist
async function getOrCreateAISession(supabase: any, userId: string) {
  // 1. Get or Create AI User
  let { data: aiUser } = await supabase.from("users").select("id").eq("email", "ai@proxnet.in").maybeSingle();
  if (!aiUser) {
    const { data: newUser } = await supabase.from("users").insert({
      email: "ai@proxnet.in", full_name: "ProxNet AI", job_title: "Network Assistant", company: "ProxNet", source: "admin", is_active: true, visibility: { showCompany: true, showTitle: true, showPhoto: true }
    }).select("id").single();
    aiUser = newUser;
  }
  const aiUserId = aiUser.id;

  // 2. Check if a session exists between user and AI
  // We look for a session where question_id is null and participants include BOTH user and AI
  const { data: sessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", userId);
  
  let sessionId = null;
  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map((s: any) => s.session_id);
    const { data: aiParticipants } = await supabase
      .from("chat_participants")
      .select("session_id")
      .eq("user_id", aiUserId)
      .in("session_id", sessionIds);
    if (aiParticipants && aiParticipants.length > 0) {
      sessionId = aiParticipants[0].session_id;
    }
  }

  if (!sessionId) {
    // Create new session
    const { data: newSession } = await supabase.from("chat_sessions").insert({}).select("id").single();
    sessionId = newSession.id;
    await supabase.from("chat_participants").insert([
      { session_id: sessionId, user_id: userId, alias: "Resident" },
      { session_id: sessionId, user_id: aiUserId, alias: "ProxNet AI" }
    ]);
  }

  return { sessionId, aiUserId };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { sessionId } = await getOrCreateAISession(supabase, user.id);

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, sender_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const formattedMessages = (messages || []).map((m: any) => ({
    role: m.sender_id === user.id ? "user" : "assistant",
    content: m.body
  }));

  return NextResponse.json({ messages: formattedMessages });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key is not configured." }, { status: 500 });

  try {
    const { message, history } = await request.json();
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const supabase = createAdminClient();
    const { sessionId, aiUserId } = await getOrCreateAISession(supabase, user.id);

    // Save User message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_id: user.id,
      body: message.trim()
    });

    // Fetch context
    const { data: usersData } = await supabase.from("users").select("id, company, job_title").eq("is_active", true).limit(100);
    const { data: jobsData } = await supabase.from("jobs").select("role, company").limit(50);
    const { data: qData } = await supabase.from("questions").select("body").eq("type", "forum").limit(20);

    const safeUsers = usersData?.filter(u => u.company && u.job_title) || [];
    const safeJobs = jobsData?.filter(j => j.company && j.role) || [];

    const contextStr = `
Users nearby: ${JSON.stringify(safeUsers)}
Jobs nearby: ${JSON.stringify(safeJobs)}
Recent forums: ${JSON.stringify(qData || [])}
`;

    const systemPrompt = `You are ProxNet AI, a hyper-local, anonymous professional networking assistant.

USER DETAILS:
Name: ${user.full_name || "Unknown"}
Company: ${user.company || "Unknown"}
Job Title: ${user.job_title || "Unknown"}
About: ${user.about || "Not provided"}

CONTEXT:
${contextStr}

RULES:
1. ALWAYS be EXTREMELY brief. Provide short, punchy answers. Do not write long paragraphs or excessive pleasantries.
2. CONSERVE TOKENS. Give the direct answer immediately.
3. NEVER reveal exact identities or precise locations.
4. When suggesting a professional from the context to ask for advice or networking, ALWAYS provide a direct markdown link: [Ask a Question](/qa?userId=ID&company=COMPANY&title=TITLE) (Replace ID, COMPANY, and TITLE with exact context values. URL encode them).
5. If the user asks for connections, just list 1-3 highly relevant matches using bullet points with the markdown link above, and nothing else.`;

    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    }));

    formattedHistory.push({ role: "user", content: message });

    let modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        max_tokens: 1024,
        messages: formattedHistory,
      }),
    });

    if (response.status === 404 && !process.env.ANTHROPIC_MODEL && modelName === "claude-haiku-4-5-20251001") {
       modelName = "claude-sonnet-4-6";
       response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: modelName, system: systemPrompt, max_tokens: 1024, messages: formattedHistory })
      });
    }

    if (!response.ok) {
      console.error("Anthropic Error:", await response.text());
      return NextResponse.json({ error: "Failed to generate AI response" }, { status: 502 });
    }

    const result = await response.json();
    const aiText = result.content?.[0]?.text || "No response.";

    // Save AI message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_id: aiUserId,
      body: aiText
    });

    return NextResponse.json({ text: aiText });

  } catch (error: any) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "Failed to process chat." }, { status: 500 });
  }
}
