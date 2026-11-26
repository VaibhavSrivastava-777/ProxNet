import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId, company, jobTitle, jobDescription, jobKeywords, referrerAlias } = await request.json();
  if (!jobId || !jobTitle) {
    return NextResponse.json({ error: "Missing job details" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    // Fallback to a simple template if no API key
    return NextResponse.json({
      pitch: `Hi! I came across the ${jobTitle} role at ${company} and believe my background aligns well. Would you be open to referring my profile or sharing insights about the team? I'd really appreciate it!`,
      highlights: [],
    });
  }

  // Fetch candidate profile
  const { data: profile } = await supabase
    .from("users")
    .select("job_title, company, about, professional_bio, resume_text, profile_digest")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const candidateContext = [
    profile.job_title ? `Current Role: ${profile.job_title}` : null,
    profile.company ? `Current Company: ${profile.company}` : null,
    profile.profile_digest?.summary ? `Summary: ${profile.profile_digest.summary}` : null,
    profile.profile_digest?.skills?.length ? `Key Skills: ${profile.profile_digest.skills.join(", ")}` : null,
    profile.profile_digest?.experienceYears ? `Experience: ${profile.profile_digest.experienceYears} years` : null,
  ].filter(Boolean).join("\n");

  const jobContext = [
    `Role: ${jobTitle}`,
    `Company: ${company}`,
    jobKeywords?.length ? `Key Requirements: ${jobKeywords.join(", ")}` : null,
    jobDescription ? `Description Snippet: ${jobDescription.replace(/<[^>]*>?/gm, " ").slice(0, 800)}` : null,
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a career coach helping a professional craft a warm, concise referral request message.

Rules:
- Write exactly 3-4 sentences. No more.
- Be warm, professional, and specific about WHY the candidate is a good fit.
- Reference 1-2 specific skills or experiences that match the job requirements.
- End with a clear, polite ask for a referral or insights.
- Do NOT use overly formal language or buzzwords like "synergy".
- Do NOT include greetings like "Dear" or sign-offs like "Best regards".
- Start directly with "Hi!" or similar casual opener.
- The tone should feel like a message to a respected colleague, not a formal cover letter.

Return a JSON object:
{
  "pitch": "The complete referral message text",
  "highlights": ["Highlight 1 about fit", "Highlight 2 about fit"]
}`;

  const userPrompt = `CANDIDATE PROFILE:
${candidateContext || "Professional seeking new opportunities"}

TARGET JOB:
${jobContext}

${referrerAlias ? `REFERRER: ${referrerAlias}` : ""}

Generate a personalized referral request message.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`OpenAI returned ${res.status}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return NextResponse.json({
      pitch: parsed.pitch || `Hi! I came across the ${jobTitle} role at ${company} and believe my background aligns well. Would you be open to referring my profile? I'd really appreciate it!`,
      highlights: parsed.highlights || [],
    });
  } catch (err: unknown) {
    console.error("[generate-pitch] Error:", err);
    // Fallback
    const fallbackPitch = profile.job_title
      ? `Hi! I'm currently working as ${profile.job_title}${profile.company ? ` at ${profile.company}` : ""} and came across the ${jobTitle} role at ${company}. My background aligns well with the requirements, and I'd love to be considered for a referral. Would you be open to sharing my profile with the hiring team?`
      : `Hi! I came across the ${jobTitle} role at ${company} and believe my experience is a strong fit. Would you be open to referring my profile or sharing insights about the team and role? I'd really appreciate your guidance!`;

    return NextResponse.json({
      pitch: fallbackPitch,
      highlights: [],
    });
  }
}
