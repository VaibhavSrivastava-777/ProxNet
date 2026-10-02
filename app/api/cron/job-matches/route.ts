import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleJobMatches(request);
}

export async function POST(request: Request) {
  return handleJobMatches(request);
}

async function handleJobMatches(request: Request) {
  // Authorization check (Vercel Cron Secret or Admin Session)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Fetch all active, non-blocked users who have provided a resume
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, about, professional_bio, resume_text, profile_digest, embedding, tags")
    .eq("is_blocked", false)
    .eq("is_active", true)
    .not("resume_text", "is", null)
    .neq("resume_text", "");

  if (userError || !users) {
    return NextResponse.json({ error: "Failed to fetch active resume users" }, { status: 500 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  let notificationsSentCount = 0;
  const auditDetails: Array<{ userId: string; email: string; topJobs: Array<{ jobId: string; jobTitle: string; company: string; score: number }> }> = [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

  const { rerankJobsForCandidate } = await import("@/lib/jobs/reranker");
  const { isSameCompany } = await import("@/lib/jobs/job-filters");

  // 2. Evaluate top 3 job matches for each resume-providing member
  for (const user of users) {
    // Check deduplication: skip if user already received daily top 3 notification within 20 hours
    const { data: recentNotifs } = await supabase
      .from("in_app_notifications")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", twentyHoursAgo)
      .or("title.ilike.%Top 3%,body.ilike.%Top 3%")
      .limit(1);

    if (recentNotifs && recentNotifs.length > 0) {
      continue;
    }

    let userEmbedding = user.embedding;

    // Generate embedding if missing and resume exists
    if (!userEmbedding && openAiApiKey) {
      const denseContext = `Resume: ${user.resume_text}`;
      const textToEmbed = `Company: ${user.company || "None"}\nRole: ${user.job_title || "None"}\n${denseContext}`.slice(0, 8000);

      if (textToEmbed.trim().length > 10) {
        try {
          const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openAiApiKey}`,
            },
            body: JSON.stringify({
              input: textToEmbed,
              model: "text-embedding-3-small",
            }),
          });

          if (oaiRes.ok) {
            const oaiData = await oaiRes.json();
            userEmbedding = oaiData.data[0]?.embedding;
            if (userEmbedding) {
              await supabase
                .from("users")
                .update({ embedding: userEmbedding })
                .eq("id", user.id);
            }
          }
        } catch (err) {
          console.error(`Failed to generate embedding for user ${user.id}:`, err);
        }
      }
    }

    if (!userEmbedding) {
      continue;
    }

    // 3. Stage 1: Fast vector retrieval with broad threshold (0.15, pool of 60)
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.15,
      match_count: 60,
    });

    if (matchError || !matchedJobs || matchedJobs.length === 0) {
      continue;
    }

    // Filter candidate jobs by date (30 days), location, and exclude user's current company
    const candidateJobs: any[] = [];
    const userCompany = user.company?.trim() || "";

    for (const job of matchedJobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < thirtyDaysAgo) continue;
      }
      if (userCompany && isSameCompany(job.company || "", userCompany)) continue;
      candidateJobs.push(job);
    }

    if (candidateJobs.length === 0) continue;

    // Pick diverse companies (max 1 job per company in candidate pool)
    const companyJobCounts = new Map<string, number>();
    const diverseJobs: any[] = [];
    for (const job of candidateJobs) {
      const cKey = ((job.company || job.company_name || "") as string).toLowerCase().trim();
      if (!companyJobCounts.has(cKey)) {
        diverseJobs.push(job);
        companyJobCounts.set(cKey, 1);
      }
      if (diverseJobs.length >= 15) break;
    }

    // 4. Stage 2: Intelligent LLM Reranking
    const candidateProfile = {
      id: user.id,
      job_title: user.job_title,
      company: user.company,
      about: user.about || user.professional_bio,
      resume_text: user.resume_text,
      profile_digest: user.profile_digest,
      tags: user.tags,
    };

    const jobsToRerank = diverseJobs.map((j: any) => ({
      id: j.id,
      title: j.title || j.role || "",
      company: (j.company || j.company_name || "").trim(),
      location: j.location,
      description: j.description,
      keywords: j.keywords || [],
      posted_at: j.posted_at,
      url: j.url,
      rawSimilarity: j.similarity,
    }));

    const rerankedMap = await rerankJobsForCandidate(candidateProfile, jobsToRerank);

    // 5. Select Top 3 Highest Scored Opportunities across distinct companies
    const scoredJobs = jobsToRerank
      .map((job) => {
        const reranked = rerankedMap.get(job.id);
        const sim = Number(job.rawSimilarity) || 0.6;
        const fallbackScore = Math.min(98, Math.max(76, Math.round(52 + sim * 50)));
        const finalScore = reranked ? reranked.score : fallbackScore;
        return {
          id: job.id,
          title: job.title || "Job Opportunity",
          company: job.company,
          score: finalScore,
          reason: reranked?.reason || "Matched to your verified resume background.",
          label: reranked?.label || "Strong Match",
        };
      })
      .sort((a, b) => b.score - a.score);

    const top3 = scoredJobs.slice(0, 3);
    if (top3.length === 0) continue;

    // 6. Dispatch Top 3 notification
    const summaryLines = top3.map((j, idx) => `${idx + 1}. ${j.title} @ ${j.company} (${j.score}%)`).join(" | ");
    const notifTitle = `🎯 Top 3 Job Opportunities Today`;
    const notifBody = `Matched to your resume: ${summaryLines}. Tap to prepare & apply!`;
    const targetUrl = `/jobs?highlight=${encodeURIComponent(top3[0].id)}`;

    await sendNotification(user.id, {
      title: notifTitle,
      body: notifBody,
      url: targetUrl,
      data: {
        type: "daily_top_3_jobs",
        jobIds: top3.map((j) => j.id),
        scores: top3.map((j) => j.score),
      },
    });

    notificationsSentCount++;
    auditDetails.push({
      userId: user.id,
      email: user.email || "N/A",
      topJobs: top3.map((j) => ({ jobId: j.id, jobTitle: j.title, company: j.company, score: j.score })),
    });

    console.log(
      `[Cron Job Match] Sent Top 3 matches notification to ${user.email}: ${summaryLines}`
    );
  }

  return NextResponse.json({
    success: true,
    usersEvaluated: users.length,
    notificationsSentCount,
    auditDetails,
  });
}
