import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key is not configured." }, { status: 500 });

  try {
    const { message, history } = await request.json();
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    const supabase = createAdminClient();
    
    // Fetch aggregate context safely
    const { data: usersData } = await supabase.from("users").select("company, job_title").eq("is_active", true).limit(100);
    const { data: jobsData } = await supabase.from("jobs").select("role, company").limit(50);
    const { data: qData } = await supabase.from("questions").select("body").eq("type", "forum").limit(20);

    const safeUsers = usersData?.filter(u => u.company && u.job_title) || [];
    const safeJobs = jobsData?.filter(j => j.company && j.role) || [];

    const contextStr = `
Users currently active nearby (Job Titles and Companies only): ${JSON.stringify(safeUsers)}
Active job listings in the network: ${JSON.stringify(safeJobs)}
Recent forum discussions: ${JSON.stringify(qData || [])}
`;

    const systemPrompt = `You are ProxNet AI, the helpful, professional, and friendly networking assistant for the ProxNet platform.
ProxNet is a hyper-local, anonymous professional networking platform that connects people in the same building or neighborhood.

AVAILABLE CONTEXT (Use this to answer user questions about the network):
${contextStr}

GUARDRAILS & RULES:
1. NEVER reveal the exact identity, real name, email, phone number, LinkedIn URL, or precise physical location/address of any professional on the platform.
2. If asked about a person or who works at a company, speak in aggregates or anonymized terms (e.g., "There are 2 Software Engineers at Google nearby" or "Someone nearby works at Microsoft").
3. Do NOT make up data. If someone asks a question and the answer isn't in the context, clearly state that you don't have that information right now.
4. Keep answers concise, helpful, and conversational.
5. You are talking directly to a verified professional on the network.
6. Format your responses clearly using Markdown where appropriate (bullet points, bold text).`;

    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    }));

    formattedHistory.push({ role: "user", content: message });

    let modelName = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
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
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          system: systemPrompt,
          max_tokens: 1024,
          messages: formattedHistory,
        }),
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API Error:", errText);
      return NextResponse.json({ error: "Failed to generate AI response" }, { status: 502 });
    }

    const result = await response.json();
    return NextResponse.json({ text: result.content?.[0]?.text || "No response." });

  } catch (error: any) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "Failed to process chat." }, { status: 500 });
  }
}
