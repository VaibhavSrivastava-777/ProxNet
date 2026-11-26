import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMatchLabel } from "@/lib/jobs/reranker";
import { detectCandidateDiscipline, detectFunctionalDiscipline, relateDisciplines, DISCIPLINE_LABELS } from "@/lib/jobs/discipline";
import { hasSubstantiveDescription } from "@/lib/jobs/job-quality";
import { computeSkillAlignment } from "@/lib/jobs/skill-matching";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId parameter" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch user's latest profile, resume, and wallet balance
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, job_title, company, about, professional_bio, resume_text, profile_digest, wallet, initial_credits_granted")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const currentWallet = userData.wallet ?? 0;
    const initialCreditsGranted = userData.initial_credits_granted ?? false;

    // Check if user has sufficient credits
    if (initialCreditsGranted && currentWallet <= 0) {
      return NextResponse.json({
        error: "INSUFFICIENT_CREDITS",
        message: "Your credit balance is exhausted. Please recharge your wallet to calculate match rates.",
        wallet: currentWallet,
      }, { status: 402 });
    }

    // Check if resume is available
    const resumeText = userData.resume_text?.trim();
    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json({
        error: "NO_RESUME",
        message: "Please upload your resume to calculate a real-time match rate for this job.",
      }, { status: 400 });
    }

    // 2. Fetch the target job posting details
    const { data: job, error: jobError } = await supabase
      .from("scraped_jobs")
      .select("id, title, company, location, description, keywords")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    const newWallet = currentWallet - 1;

    // 4. Evaluate match rate in real-time using OpenAI with Method 1 Skill Coverage
    const openaiKey = process.env.OPENAI_API_KEY;
    const candDiscipline = detectCandidateDiscipline(userData);
    const jobDiscipline = detectFunctionalDiscipline(job.title, job.description);
    const relation = relateDisciplines(candDiscipline, jobDiscipline);
    const isSubstantive = hasSubstantiveDescription(job.description, job.title);
    const skillsAlignment = computeSkillAlignment(userData, job);

    let score = 50;
    let label = "Moderate Match";
    let reason = "Profile and resume evaluated against role requirements.";

    if (relation === "incompatible") {
      score = 25;
      label = "Low Match";
      reason = `Candidate background in ${DISCIPLINE_LABELS[candDiscipline]} does not match this role in ${DISCIPLINE_LABELS[jobDiscipline]}.`;
    } else if (!isSubstantive) {
      score = 35;
      label = "Low Match";
      reason = "Job description is missing or minimal; role requirements cannot be verified.";
    } else if (openaiKey) {
      try {
        const candidateContext = `
CANDIDATE PROFILE (LATEST RESUME & PROFILE):
- Current Title: ${userData.job_title || "Professional"}
- Current Company: ${userData.company || "Unknown"}
- Functional Discipline: ${DISCIPLINE_LABELS[candDiscipline]}
- Skills: ${(userData.profile_digest?.skills || []).join(", ") || "General"}
- Summary: ${userData.profile_digest?.summary || userData.about || "N/A"}
- Full Resume Excerpt:
${resumeText.slice(0, 3000)}
`.trim();

        const jobContext = `
JOB POSTING DETAILS:
- Title: ${job.title}
- Company: ${job.company}
- Functional Discipline: ${DISCIPLINE_LABELS[jobDiscipline]}
- Location: ${job.location || "Remote"}
- Keywords: ${(job.keywords || []).join(", ") || "General"}
- Skill Coverage Analysis (Method 1):
  * Coverage: ${skillsAlignment.coveragePercent}%
  * Matched Skills: ${skillsAlignment.matchedSkills.join(", ") || "None"}
  * Missing Skills / Gaps: ${skillsAlignment.missingSkills.join(", ") || "None identified"}
- Description:
${(job.description || job.title).slice(0, 2000)}
`.trim();

        const prompt = `You are an expert technical talent evaluator. Evaluate how strongly the candidate's latest resume and background match the target job opening.
Score the match strictly from 0 to 100 based on functional domain, hard skill coverage (Method 1), and seniority fit.
- 85-100: Strong Match (Direct alignment on role, tech stack, or domain with high skill coverage >70%)
- 70-84: Good Match (Strong transferable overlap, adjacent seniority or stack)
- 50-69: Moderate Match (Partial overlap, different sub-domain or noticeable skill gaps)
- Below 50: Low Match (Completely different career track or major skill deficit)

Provide a concise, compelling 1-2 sentence fit reason explaining why this candidate is a match or where the overlap lies.

Output valid JSON ONLY with the format:
{
  "score": number,
  "reason": "1-2 sentence explanation"
}

${candidateContext}

${jobContext}`;

        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const parsed = JSON.parse(oaiData.choices[0].message.content);
          if (typeof parsed.score === "number") {
            let parsedScore = Math.min(99, Math.max(10, Math.round(parsed.score)));
            if (relation === "adjacent") {
              parsedScore = Math.min(74, parsedScore);
            }
            if (skillsAlignment.totalRequiredSkills >= 3 && skillsAlignment.coveragePercent < 30) {
              parsedScore = Math.min(50, parsedScore);
            }
            score = parsedScore;
            label = getMatchLabel(score);
          }
          if (parsed.reason && typeof parsed.reason === "string") {
            reason = parsed.reason.trim();
          }
        }
      } catch (aiErr: unknown) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error("[match-rate] AI evaluation error:", msg);
      }
    } else {
      // Fallback without OpenAI key using skill coverage
      const coverageBoost = Math.round(skillsAlignment.coveragePercent * 0.3);
      score = Math.min(75, 45 + coverageBoost);
      label = getMatchLabel(score);
      reason = `Evaluated using skill coverage ratio (${skillsAlignment.coveragePercent}% tooling match).`;
    }

    // 5. Persist evaluated match in user's profile_digest.evaluated_matches & deduct wallet credit
    const currentProfileDigest = userData.profile_digest || {};
    const evaluatedMatches = currentProfileDigest.evaluated_matches || {};
    evaluatedMatches[job.id] = {
      jobId: job.id,
      score,
      label,
      reason,
      skillsAlignment,
      evaluated_at: new Date().toISOString(),
    };

    await supabase
      .from("users")
      .update({
        wallet: newWallet,
        profile_digest: {
          ...currentProfileDigest,
          evaluated_matches: evaluatedMatches,
        },
      })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      score,
      label,
      reason,
      skillsAlignment,
      remainingWallet: newWallet,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/jobs/match-rate] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
