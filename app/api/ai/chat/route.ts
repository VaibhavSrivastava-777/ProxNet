import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

import { getOrCreateAISession } from "@/lib/ai-chat";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { sessionId } = await getOrCreateAISession(supabase, user.id);

  const { data: userData } = await supabase
    .from("users")
    .select("wallet, initial_credits_granted")
    .eq("id", user.id)
    .single();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, sender_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const formattedMessages = (messages || []).map((m: any) => ({
    role: m.sender_id === user.id ? "user" : "assistant",
    content: m.body
  }));

  return NextResponse.json({
    messages: formattedMessages,
    wallet: userData?.wallet ?? 0,
    initial_credits_granted: userData?.initial_credits_granted ?? false
  });
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

    // Fetch user wallet balance and initial_credits_granted status
    const { data: userData } = await supabase
      .from("users")
      .select("wallet, initial_credits_granted")
      .eq("id", user.id)
      .single();

    const currentWallet = userData?.wallet ?? 0;
    const initialCreditsGranted = userData?.initial_credits_granted ?? false;

    // If initial credits were granted and credits go to <= 0, require recharge
    if (initialCreditsGranted && currentWallet <= 0) {
      return NextResponse.json({
        error: "RECHARGE_REQUIRED",
        message: "Your credit balance is exhausted. Please contact ProxNet.Connect@Gmail.com to recharge your credits.",
        wallet: currentWallet,
        initial_credits_granted: true
      }, { status: 402 });
    }

    // Deduct 1 credit point for every ProxNet AI prompt
    const newWallet = currentWallet - 1;
    await supabase
      .from("users")
      .update({ wallet: newWallet })
      .eq("id", user.id);

    // Save User message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_id: user.id,
      body: message.trim()
    });

    // Fetch context: all active network professionals
    const { data: usersData } = await supabase
      .from("users")
      .select("id, company, job_title, about, professional_bio, tags, profile_digest")
      .eq("is_active", true)
      .not("company", "is", null);

    const { data: jobsData } = await supabase
      .from("scraped_jobs")
      .select("id, title, company, location")
      .order("created_at", { ascending: false })
      .limit(60);

    const { data: qData } = await supabase
      .from("questions")
      .select("body")
      .eq("type", "forum")
      .order("created_at", { ascending: false })
      .limit(15);

    const msgLower = (message || "").toLowerCase();

    // Map users and prioritize relevance to the user's specific query keywords
    const safeUsers = (usersData || [])
      .filter((u: any) => u.company && u.job_title && u.id !== user.id)
      .map((u: any) => {
        const comp = u.company.trim();
        const title = u.job_title.trim();
        const digest = u.profile_digest || {};
        return {
          id: u.id,
          company: comp,
          job_title: title,
          about: u.about || u.professional_bio || "",
          skills: digest.help_offers || u.tags || [],
        };
      });

    // Helper to test if a term appears as a distinct word in the user message
    const matchesQueryWord = (term: string) => {
      const clean = term.trim().toLowerCase();
      if (!clean) return false;
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(msgLower);
    };

    // Prioritize users whose company, title, or skills match keywords in user message
    safeUsers.sort((a: any, b: any) => {
      const aCompMatch = matchesQueryWord(a.company);
      const bCompMatch = matchesQueryWord(b.company);
      if (aCompMatch && !bCompMatch) return -1;
      if (!aCompMatch && bCompMatch) return 1;

      const aTitleMatch = matchesQueryWord(a.job_title);
      const bTitleMatch = matchesQueryWord(b.job_title);
      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;

      return 0;
    });

    const safeJobs = (jobsData || []).map((j: any) => ({
      id: j.id,
      role: j.title,
      company: j.company,
      location: j.location || "Nearby"
    }));

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

UX & USABILITY PRINCIPLES (CRITICAL):
1. ZERO FLUFF & MAXIMUM SCANNABILITY: Keep answers concise, clear, and structured. Do NOT write long conversational introductions, redundant disclaimers, or paragraphs of preamble.
2. ACCURACY & COMPLETENESS: Search "Users nearby" carefully. If a user asks about a specific company (e.g. Eclerx), check all members and accurately acknowledge if someone from that company is present.
3. PROXIMITY CARD LINKS: When suggesting a professional, ALWAYS provide a direct link to their Proximity Card View so the user can easily view their profile and initiate a conversation.
   Format each suggested professional cleanly like this:
   - **[Job Title @ Company](/network?userId=ID)**
     Reason: [1 punchy sentence explaining their relevant background or why to connect]
     [👀 View Proximity Card](/network?userId=ID)
   (Replace ID with the person's exact id from Users nearby).
4. PRIVACY: NEVER reveal real names or private personal addresses. Only refer to professionals by their Job Title @ Company, approximate radius ("nearby" / "within 2 km"), and anonymized background.
5. SHORT ACTIONABLE CLOSING: Finish with a single short, helpful sentence offering next steps (e.g., "Would you like me to draft an introductory message for you?").

Example response format:
"I found a relevant professional nearby:

- **[Senior Data Scientist @ Eclerx](/network?userId=...)**
  Specializes in predictive modeling and analytics workflows.
  [👀 View Proximity Card](/network?userId=...)

Would you like me to draft an intro note?"`;

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
