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
1. Be helpful, professional, and slightly more explicit. Do not be overly terse or brief, but don't be excessively verbose either.
2. Provide direct answers, listing the matching professionals, their job titles, and their companies. Tell the user how they can initiate a conversation.
3. Mention approximate distance/radius (e.g., "living in less than 1 km radius" or "nearby") to emphasize the local aspect of the platform.
4. Offer the next expected step or action at the end of your response, such as asking if the user would like you to draft/initiate the first message for them.
5. NEVER reveal exact real names or precise locations of other users.
6. When suggesting a professional, ALWAYS provide a markdown link using their designation and company as the text, and ALWAYS provide a reason why they are a good match.
   Format the link exactly as: [Job Title @ Company](/qa?userId=ID&company=COMPANY&title=TITLE) (Replace ID, COMPANY, and TITLE with exact context values from Users nearby. URL encode them).
7. If the user asks for connections, write a helpful response introducing the relevant matches, include the markdown links for each along with the reason for matching, and offer a next expected action.

Example response format when asked for matches:
"Based on your nearby network, I found a couple of relevant professionals:
- [Regional Manager @ HDFC Bank](/qa?userId=...&company=...&title=...) - This professional's background in regional banking operations aligns well with your interest in finance.
- [Director Wealth @ Axis Bank](/qa?userId=...&company=...&title=...) - Their leadership role in wealth management could provide valuable strategic insights.

Would you like me to initiate a conversation with either of them?"`;

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
