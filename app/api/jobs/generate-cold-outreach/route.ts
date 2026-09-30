import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    jobId,
    company,
    jobTitle,
    jobDescription,
    jobKeywords,
    targetType = "recruiter",
    tone = "value_add",
  } = await request.json();

  if (!jobId || !jobTitle || !company) {
    return NextResponse.json({ error: "Missing required job details" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  // Fetch candidate profile & digest
  const { data: profile } = await supabase
    .from("users")
    .select("job_title, company, about, professional_bio, resume_text, profile_digest")
    .eq("id", user.id)
    .single();

  const userJobTitle = profile?.job_title || "Software Engineer / Professional";
  const userCompany = profile?.company || "";
  const skills = profile?.profile_digest?.skills || [];
  const experienceYears = profile?.profile_digest?.experienceYears || "";
  const summary = profile?.profile_digest?.summary || profile?.about || "";

  const candidateContext = [
    `Current Role: ${userJobTitle}${userCompany ? ` at ${userCompany}` : ""}`,
    experienceYears ? `Total Experience: ${experienceYears} years` : null,
    skills.length ? `Core Skills: ${skills.slice(0, 8).join(", ")}` : null,
    summary ? `Background Summary: ${summary.slice(0, 300)}` : null,
  ].filter(Boolean).join("\n");

  const jobContext = [
    `Target Role: ${jobTitle}`,
    `Target Company: ${company}`,
    jobKeywords?.length ? `Role Keywords: ${jobKeywords.slice(0, 8).join(", ")}` : null,
    jobDescription ? `Description Snippet: ${jobDescription.replace(/<[^>]*>?/gm, " ").slice(0, 600)}` : null,
  ].filter(Boolean).join("\n");

  const targetLabel =
    targetType === "hiring_manager"
      ? "Hiring Manager / Team Leader"
      : targetType === "peer"
      ? "Peer / Senior Team Member"
      : "Recruiter / Talent Acquisition Specialist";

  const toneGuidelines =
    tone === "direct"
      ? "Direct, punchy, and confident. Get straight to the point in 2-3 sentences. No fluff."
      : tone === "casual"
      ? "Warm, conversational, and peer-to-peer. Natural and low-pressure."
      : "Value-add focused. Highlight 1-2 specific achievements or skills that solve their team's problems.";

  // If no OpenAI key, use dynamic fallback
  if (!openaiKey) {
    const fallbackMessage = generateFallbackMessage(targetType, tone, userJobTitle, jobTitle, company, skills);
    return NextResponse.json({
      subject: `${jobTitle} opportunity — ${userJobTitle} inquiry`,
      message: fallbackMessage,
      highlights: skills.slice(0, 3).map((s: string) => `Strong alignment in ${s}`),
      targetType,
      creditsCost: 0,
    });
  }

  const systemPrompt = `You are an elite tech career coach crafting high-conversion LinkedIn cold outreach DMs for active job seekers.
Target Audience: ${targetLabel} at ${company}.
Tone Style: ${toneGuidelines}

Rules:
1. Message length: Strictly 3 to 4 sentences (under 120 words). LinkedIn connection notes and DMs must be concise and readable in 10 seconds.
2. Structure:
   - Sentence 1: Compelling hook mentioning the specific ${jobTitle} opening at ${company} and candidate's current background.
   - Sentence 2: Specific value proposition: 1-2 concrete skills or relevant impact matching what they need.
   - Sentence 3-4: Low-friction call to action (e.g. "Would you be open to a 10-minute chat next week to see if my background is a fit?").
3. DO NOT use generic phrases like "I hope this message finds you well", "synergy", "enthusiastic go-getter", "esteemed company".
4. DO NOT start with "Dear Mr./Ms." - start with "Hi [Name]," or "Hello,".
5. Provide a short 3-6 word LinkedIn InMail / email subject line.
6. Provide 2-3 brief highlight bullet points explaining why this outreach is compelling.

Return ONLY a JSON object:
{
  "subject": "Short catchy subject line",
  "message": "The exact outreach text to copy-paste",
  "highlights": ["Key hook 1", "Key hook 2"]
}`;

  const userPrompt = `CANDIDATE INFO:
${candidateContext}

TARGET JOB & COMPANY:
${jobContext}

Draft the cold outreach message for ${targetLabel}.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
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
      throw new Error(`OpenAI responded with status ${res.status}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return NextResponse.json({
      subject: parsed.subject || `${jobTitle} role at ${company}`,
      message: parsed.message || generateFallbackMessage(targetType, tone, userJobTitle, jobTitle, company, skills),
      highlights: parsed.highlights || [`Matched for ${jobTitle}`],
      targetType,
      creditsCost: 0,
    });
  } catch (err) {
    console.error("[generate-cold-outreach] Error:", err);
    return NextResponse.json({
      subject: `${jobTitle} opportunity at ${company}`,
      message: generateFallbackMessage(targetType, tone, userJobTitle, jobTitle, company, skills),
      highlights: skills.slice(0, 3).map((s: string) => `Skill fit: ${s}`),
      targetType,
      creditsCost: 0,
    });
  }
}

function generateFallbackMessage(
  targetType: string,
  tone: string,
  userJobTitle: string,
  jobTitle: string,
  company: string,
  skills: string[]
): string {
  const topSkill = skills[0] ? ` specializing in ${skills.slice(0, 2).join(" & ")}` : "";

  if (targetType === "hiring_manager") {
    return `Hi [Name], I noticed ${company} is expanding the team with a ${jobTitle} opening. As a ${userJobTitle}${topSkill}, I've recently delivered impactful systems in this exact space and would love to support your roadmap. Are you free for a quick 10-minute conversation this week to see if my experience aligns with your team's priorities?`;
  }

  if (targetType === "peer") {
    return `Hi [Name], I saw the ${jobTitle} posting at ${company} and love the engineering challenges your team is tackling. I'm a ${userJobTitle}${topSkill} exploring next roles. If you have 5 minutes, I'd love to hear your authentic take on the engineering culture and what the team is currently building!`;
  }

  // Recruiter / TA default
  return `Hi [Name], I saw that you're recruiting for the ${jobTitle} role at ${company}. With my background as a ${userJobTitle}${topSkill}, my experience closely matches what your team is looking for. Would you be open to a brief chat to see if my profile is a good fit for this search?`;
}
