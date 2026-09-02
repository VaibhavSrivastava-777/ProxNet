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
    .select("id, full_name, email, company, job_title, about, professional_bio, resume_text, profile_digest, embedding, tags")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (userError || !users) {
    return NextResponse.json({ error: "Failed to fetch active users" }, { status: 500 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  let notificationsSentCount = 0;
  const auditDetails: Array<{ userId: string; email: string; jobId: string; jobTitle: string; score: number; label: string; reason: string }> = [];

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { rerankJobsForCandidate } = await import("@/lib/jobs/reranker");

  // 2. Evaluate job matches for each user
  for (const user of users) {
    let userEmbedding = user.embedding;

    // Generate embedding if missing and profile content exists
    if (!userEmbedding && openAiApiKey) {
      const denseContext = user.resume_text ? `Resume: ${user.resume_text}` : `About: ${user.about || user.professional_bio || "None"}`;
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

    // 3. Stage 1: Fast vector retrieval with broad threshold (0.25)
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.25,
      match_count: 50,
    });

    if (matchError || !matchedJobs || matchedJobs.length === 0) {
      continue;
    }

    // Filter candidate jobs by date & seniority before reranking
    const candidateJobs: any[] = [];
    for (const job of matchedJobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) continue;
      }
      candidateJobs.push(job);
    }

    if (candidateJobs.length === 0) continue;

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

    const jobsToRerank = candidateJobs.slice(0, 25).map((j: any) => ({
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

    // 5. Filter strictly for Strong Matches (score >= 75)
    for (const job of jobsToRerank) {
      const reranked = rerankedMap.get(job.id);
      if (!reranked || reranked.score < 75) {
        continue;
      }

      const score = reranked.score;
      const label = reranked.label;
      const reason = reranked.reason;
      const companyName = job.company || "a hiring company";
      const jobTitle = job.title || "Job Opening";
      const jobId = job.id;

      // 6. Deduplication Check
      const { data: existingNotifs } = await supabase
        .from("in_app_notifications")
        .select("id")
        .eq("user_id", user.id)
        .like("url", `%${jobId}%`);

      if (existingNotifs && existingNotifs.length > 0) {
        continue;
      }

      // 7. Dispatch rich notifications with qualitative label & derived reason
      const notifTitle = `🔥 Strong Job Match (${score}%): ${jobTitle} at ${companyName}`;
      const notifBody = `${reason} Tap to view details and apply!`;
      const targetUrl = `/jobs?jobId=${encodeURIComponent(jobId)}&match=${score}`;

      await sendNotification(user.id, {
        title: notifTitle,
        body: notifBody,
        url: targetUrl,
        data: {
          jobId,
          company: companyName,
          matchRate: score,
          label,
          reason,
          type: "job_match_75",
        },
      });

      notificationsSentCount++;
      auditDetails.push({
        userId: user.id,
        email: user.email || "N/A",
        jobId,
        jobTitle,
        score,
        label,
        reason,
      });

      console.log(
        `[Cron Job Match] Sent ${score}% (${label}) notification to ${user.email} for job: ${jobTitle} @ ${companyName}`
      );
    }
  }

  return NextResponse.json({
    success: true,
    usersEvaluated: users.length,
    notificationsSentCount,
    auditDetails,
  });
}
