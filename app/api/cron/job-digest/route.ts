import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleJobDigest(request);
}

export async function POST(request: Request) {
  return handleJobDigest(request);
}

async function handleJobDigest(request: Request) {
  // Authorization check (Vercel Cron Secret or Admin Session)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Fetch recent jobs activity from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const { data: recentJobs, error: jobsErr } = await supabase
    .from("scraped_jobs")
    .select("id, title, company, location, posted_at, similarity, embedding")
    .gte("posted_at", sevenDaysAgoIso)
    .order("posted_at", { ascending: false });

  if (jobsErr || !recentJobs || recentJobs.length === 0) {
    return NextResponse.json({ 
      success: true, 
      message: "No recent jobs found in the last 7 days. Digest skipped." 
    });
  }

  const totalRecentJobs = recentJobs.length;
  
  // Aggregate company counts
  const companyCounts = new Map<string, number>();
  for (const j of recentJobs) {
    const comp = (j.company || "").trim();
    if (comp) {
      companyCounts.set(comp, (companyCounts.get(comp) || 0) + 1);
    }
  }

  const topCompanies = Array.from(companyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name} (${count})`);

  // 2. Fetch all active, non-blocked users
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, about, professional_bio, resume_text, profile_digest, embedding, tags")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (userErr || !users || users.length === 0) {
    return NextResponse.json({ error: "No active users found" }, { status: 500 });
  }

  let digestsSent = 0;
  const audit: Array<{ userId: string; email: string; tier: string; title: string }> = [];
  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  const { rerankJobsForCandidate } = await import("@/lib/jobs/reranker");

  for (const user of users) {
    // Deduplication check: Avoid sending if user already received a weekly digest in the last 6 days
    const { data: recentNotifs } = await supabase
      .from("in_app_notifications")
      .select("id, created_at")
      .eq("user_id", user.id)
      .like("url", "%digest%")
      .gte("created_at", sixDaysAgo.toISOString());

    if (recentNotifs && recentNotifs.length > 0) {
      continue;
    }

    const hasResume = Boolean(user.resume_text && user.resume_text.trim().length > 50);
    const hasProfile = Boolean(user.job_title || user.company || user.about || user.professional_bio);

    if (!hasResume && !hasProfile) {
      // Tier 1A: Cold user with no profile and no resume -> Pure Activity Digest
      const notifTitle = `📊 ProxNet Job Alert: ${totalRecentJobs} new jobs posted this week`;
      const notifBody = `Top hiring companies: ${topCompanies.join(", ")}. Upload your resume to unlock personalized match scores and referral contacts!`;
      const targetUrl = `/profile?prompt=resume&digest=tier1`;

      await sendNotification(user.id, {
        title: notifTitle,
        body: notifBody,
        url: targetUrl,
        data: { type: "weekly_digest_activity", totalJobs: totalRecentJobs }
      });

      digestsSent++;
      audit.push({ userId: user.id, email: user.email || "N/A", tier: "Tier 1 (Activity)", title: notifTitle });

    } else if (!hasResume && hasProfile) {
      // Tier 2: User has profile details but NO resume -> Partial Match Digest with motivation
      let topMatchText = "";
      let topMatchScore = 0;

      if (user.embedding) {
        try {
          const { data: userMatchedJobs } = await supabase.rpc("match_scraped_jobs", {
            query_embedding: user.embedding,
            match_threshold: 0.25,
            match_count: 10,
          });

          if (userMatchedJobs && userMatchedJobs.length > 0) {
            const candidateProfile = {
              id: user.id,
              job_title: user.job_title,
              company: user.company,
              about: user.about || user.professional_bio,
              profile_digest: user.profile_digest,
              tags: user.tags,
            };

            const jobsToRerank = userMatchedJobs.slice(0, 6).map((j: any) => ({
              id: j.id,
              title: j.title || "",
              company: j.company || "",
              location: j.location,
              description: j.description,
              keywords: j.keywords || [],
              posted_at: j.posted_at,
              url: j.url,
              rawSimilarity: j.similarity,
            }));

            const rerankedMap = await rerankJobsForCandidate(candidateProfile, jobsToRerank);
            const matches = Array.from(rerankedMap.values()).sort((a, b) => b.score - a.score);

            if (matches.length > 0 && matches[0].score >= 50) {
              const best = matches[0];
              const bestJob = jobsToRerank.find((j: any) => j.id === best.id);
              topMatchScore = best.score;
              topMatchText = `Top match: "${bestJob?.title}" at ${bestJob?.company} (${best.score}% match). `;
            }
          }
        } catch (err) {
          console.error("Error evaluating partial matches for digest:", err);
        }
      }

      const notifTitle = topMatchScore >= 60 
        ? `✨ New Matches Found (${topMatchScore}%): ${topCompanies[0] || "Top Companies"}` 
        : `📊 ProxNet Job Alert: ${totalRecentJobs} new jobs posted this week`;

      const notifBody = `${topMatchText}Your match accuracy is limited without a resume. Upload one to unlock 90%+ Strong Matches and direct referrals!`;
      const targetUrl = `/jobs?prompt=resume&digest=tier2`;

      await sendNotification(user.id, {
        title: notifTitle,
        body: notifBody,
        url: targetUrl,
        data: { type: "weekly_digest_partial", topScore: topMatchScore }
      });

      digestsSent++;
      audit.push({ userId: user.id, email: user.email || "N/A", tier: "Tier 2 (Partial)", title: notifTitle });

    } else {
      // Tier 1B: User has full resume -> Weekly summary of new opportunities
      const notifTitle = `📊 ${totalRecentJobs} new jobs scraped this week across ${topCompanies.length} top companies`;
      const notifBody = `Hiring now: ${topCompanies.join(", ")}. Tap to check updated personalized matches for your profile!`;
      const targetUrl = `/jobs?digest=tier1_full`;

      await sendNotification(user.id, {
        title: notifTitle,
        body: notifBody,
        url: targetUrl,
        data: { type: "weekly_digest_full", totalJobs: totalRecentJobs }
      });

      digestsSent++;
      audit.push({ userId: user.id, email: user.email || "N/A", tier: "Tier 1 (Full Profile Digest)", title: notifTitle });
    }
  }

  return NextResponse.json({
    success: true,
    totalRecentJobs,
    usersEvaluated: users.length,
    digestsSent,
    audit
  });
}
