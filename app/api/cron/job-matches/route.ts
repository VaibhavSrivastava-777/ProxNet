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

  // 1. Fetch all active, non-blocked users
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, about, professional_bio, resume_text, profile_digest, embedding, tags, home_lat, office_lat")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (userError || !users) {
    return NextResponse.json({ error: "Failed to fetch active users" }, { status: 500 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  let notificationsSentCount = 0;
  const auditDetails: Array<{ userId: string; email: string; topJobs: Array<{ jobId: string; jobTitle: string; company: string; score: number }> }> = [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

  const { rerankJobsForCandidate } = await import("@/lib/jobs/reranker");
  const { isSameCompany, isIndiaLocation } = await import("@/lib/jobs/job-filters");

  // 2. Evaluate top 3 job matches for each member (clubbing profile completion if incomplete)
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

    // Evaluate missing profile fields
    const missingProfileFields: string[] = [];
    const hasResume = Boolean(user.resume_text && user.resume_text.trim().length >= 50);
    if (!hasResume) missingProfileFields.push("resume");
    if (!user.job_title?.trim()) missingProfileFields.push("current designation");
    if (!user.company?.trim()) missingProfileFields.push("company");
    if (!user.home_lat && !user.office_lat) missingProfileFields.push("location");
    const isProfileIncomplete = missingProfileFields.length > 0;

    let userEmbedding = user.embedding;

    // Generate embedding if missing and resume exists
    if (!userEmbedding && openAiApiKey && hasResume) {
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

    let candidateJobs: any[] = [];

    // Stage 1: Vector retrieval if embedding exists
    if (userEmbedding) {
      const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
        query_embedding: userEmbedding,
        match_threshold: 0.15,
        match_count: 60,
      });

      if (!matchError && matchedJobs && matchedJobs.length > 0) {
        candidateJobs = matchedJobs;
      }
    }

    // Fallback: If no vector matches (e.g. user has no resume or no embedding), fetch recent verified jobs
    if (candidateJobs.length === 0) {
      const { data: freshJobs } = await supabase
        .from("scraped_jobs")
        .select("id, title, company, location, description, keywords, posted_at, url, similarity")
        .gte("posted_at", thirtyDaysAgo.toISOString())
        .order("posted_at", { ascending: false })
        .limit(30);

      if (freshJobs && freshJobs.length > 0) {
        candidateJobs = freshJobs;
      }
    }

    if (candidateJobs.length === 0) {
      continue;
    }

    // Filter candidate jobs by date (30 days) and exclude user's current company
    const filteredJobs: any[] = [];
    const userCompany = user.company?.trim() || "";

    for (const job of candidateJobs) {
      if (!isIndiaLocation(job.location, job.description, job.title)) continue;
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < thirtyDaysAgo) continue;
      }
      if (userCompany && isSameCompany(job.company || "", userCompany)) continue;
      filteredJobs.push(job);
    }

    if (filteredJobs.length === 0) continue;

    // Pick diverse companies (max 1 job per company in candidate pool)
    const companyJobCounts = new Map<string, number>();
    const diverseJobs: any[] = [];
    for (const job of filteredJobs) {
      const cKey = ((job.company || job.company_name || "") as string).toLowerCase().trim();
      if (!companyJobCounts.has(cKey)) {
        diverseJobs.push(job);
        companyJobCounts.set(cKey, 1);
      }
      if (diverseJobs.length >= 15) break;
    }

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

    // Stage 2: Rerank if profile has info, otherwise score based on recency/diversity
    let rerankedMap = new Map<string, { score: number; reason?: string; label?: string }>();
    if (hasResume || user.job_title || user.tags?.length) {
      try {
        rerankedMap = await rerankJobsForCandidate(candidateProfile, jobsToRerank);
      } catch (e) {
        // Fall back gracefully to base scoring
      }
    }

    // Select Top 3 Highest Scored Opportunities across distinct companies
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
          reason: reranked?.reason || "Verified tech opening in your community cluster.",
          label: reranked?.label || "Recommended",
        };
      })
      .sort((a, b) => b.score - a.score);

    // Ensure top 3 strictly belong to distinct companies (deduplicating company aliases & subsidiaries)
    const top3: typeof scoredJobs = [];
    for (const job of scoredJobs) {
      if (!job.company) continue;
      if (userCompany && isSameCompany(job.company, userCompany)) continue;
      const isDuplicateCompany = top3.some((t) => isSameCompany(t.company, job.company));
      if (!isDuplicateCompany) {
        top3.push(job);
      }
      if (top3.length >= 3) break;
    }
    if (top3.length === 0) continue;

    // Dispatch Top 3 notification (with clubbed profile reminder if profile is incomplete)
    const summaryLines = top3.map((j, idx) => `${idx + 1}. ${j.title} @ ${j.company} (${j.score}%)`).join(" | ");
    const notifTitle = `🎯 Top 3 Job Opportunities Today`;
    let notifBody = hasResume
      ? `Matched to your resume: ${summaryLines}. Tap to prepare & apply!`
      : `Top tech openings today: ${summaryLines}. Tap to prepare & apply!`;

    if (isProfileIncomplete) {
      const missingText = missingProfileFields.join(" & ");
      notifBody += ` 💡 Tip: Add your ${missingText} to unlock tailored 90%+ match accuracy and inside referrals!`;
    }

    const targetUrl = isProfileIncomplete
      ? `/jobs?highlight=${encodeURIComponent(top3[0].id)}&wizard=profile`
      : `/jobs?highlight=${encodeURIComponent(top3[0].id)}`;

    await sendNotification(user.id, {
      title: notifTitle,
      body: notifBody,
      url: targetUrl,
      data: {
        type: "daily_top_3_jobs",
        jobIds: top3.map((j) => j.id),
        scores: top3.map((j) => j.score),
        incompleteProfile: isProfileIncomplete,
        missingProfileFields,
        forceEmail: true,
      },
    });

    notificationsSentCount++;
    auditDetails.push({
      userId: user.id,
      email: user.email || "N/A",
      topJobs: top3.map((j) => ({ jobId: j.id, jobTitle: j.title, company: j.company, score: j.score })),
    });

    console.log(
      `[Cron Job Match] Sent Top 3 matches notification to ${user.email}: ${summaryLines}${isProfileIncomplete ? " (clubbed profile completion tip)" : ""}`
    );
  }

  return NextResponse.json({
    success: true,
    usersEvaluated: users.length,
    notificationsSentCount,
    auditDetails,
  });
}
