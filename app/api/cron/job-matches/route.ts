import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export async function GET(request: Request) {
  return handleJobMatches(request);
}

export async function POST(request: Request) {
  return handleJobMatches(request);
}

async function handleJobMatches(request: Request) {
  // Authorization check (Vercel Cron Secret or Admin Session)
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Fetch all active, non-blocked users
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, about, professional_bio, embedding, tags")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (userError || !users) {
    return NextResponse.json({ error: "Failed to fetch active users" }, { status: 500 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  let notificationsSentCount = 0;
  const auditDetails: Array<{ userId: string; email: string; jobId: string; jobTitle: string; matchRate: number }> = [];

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // 2. Evaluate job matches for each user
  for (const user of users) {
    let userEmbedding = user.embedding;

    // Generate embedding if missing and profile content exists
    if (!userEmbedding && openAiApiKey) {
      const textToEmbed = [
        user.job_title,
        user.company,
        user.about,
        user.professional_bio,
        ...(user.tags || []),
      ]
        .filter(Boolean)
        .join(" ");

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
      // No embedding available to calculate vector similarity for this user
      continue;
    }

    // 3. Query matched scraped jobs using vector similarity RPC (match_threshold: 0.6 => >=60%)
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.6,
      match_count: 50,
    });

    if (matchError || !matchedJobs || matchedJobs.length === 0) {
      // If there is NO matching job (> 60%), do NOT send any notification
      continue;
    }

    // Filter jobs strictly to > 60% match rate and not older than 14 days
    const highMatchJobs = matchedJobs.filter((job: any) => {
      const matchRate = Math.round((job.similarity || 0) * 100);
      if (matchRate <= 60) return false;

      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) {
          return false;
        }
      }
      return true;
    });

    if (highMatchJobs.length === 0) {
      // If there is NO matching job with >60% match rate, do NOT send notification
      continue;
    }

    // Pick top matching job
    for (const job of highMatchJobs) {
      const matchRate = Math.round(job.similarity * 100);
      const companyName = (job.company || job.company_name || "a hiring company").trim();
      const jobTitle = (job.title || job.role || "Job Opening").trim();
      const jobId = job.id;

      // 4. Deduplication Check: Ensure user was NOT already notified for THIS PARTICULAR JOB POSTING
      const { data: existingNotifs } = await supabase
        .from("in_app_notifications")
        .select("id")
        .eq("user_id", user.id)
        .like("url", `%${jobId}%`);

      if (existingNotifs && existingNotifs.length > 0) {
        // Notification for this job posting was already sent to this user
        continue;
      }

      // 5. Send mobile push & in-app notification ONLY FOR THIS PARTICULAR JOB POSTING
      const notifTitle = `🔥 ${matchRate}% Job Match: ${jobTitle} at ${companyName}`;
      const notifBody = `A job matching your profile (${matchRate}% match) opened for "${jobTitle}" at ${companyName}. Tap to view details!`;
      const targetUrl = `/jobs?jobId=${encodeURIComponent(jobId)}&match=${matchRate}`;

      await sendNotification(user.id, {
        title: notifTitle,
        body: notifBody,
        url: targetUrl,
        data: {
          jobId,
          company: companyName,
          matchRate,
          type: "job_match_60",
        },
      });

      notificationsSentCount++;
      auditDetails.push({
        userId: user.id,
        email: user.email || "N/A",
        jobId,
        jobTitle,
        matchRate,
      });

      console.log(
        `[Cron Job Match] Sent ${matchRate}% match notification to ${user.email} for job: ${jobTitle} @ ${companyName}`
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
