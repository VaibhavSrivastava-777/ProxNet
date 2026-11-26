import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

// Whitelisted accounts for selective testing
const WHITELISTED_TEST_EMAILS = [
  "vaibhav.srivastava@iiml.org",
  "swatipandya.sr@gmail.com"
];

export async function POST(request: Request) {
  const supabase = createAdminClient();

  // 1. Fetch whitelisted users ONLY
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email, job_title, company, about, professional_bio, resume_text, profile_digest, embedding, tags")
    .eq("is_blocked", false);

  if (userError || !users) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const testUsers = users.filter(u => 
    u.email && WHITELISTED_TEST_EMAILS.includes(u.email.trim().toLowerCase())
  );

  if (testUsers.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No whitelisted test accounts found for nudge generation."
    });
  }

  const { rerankJobsForCandidate } = await import("@/lib/jobs/reranker");
  let totalNudgesSent = 0;
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  for (const testUser of testUsers) {
    if (!testUser.embedding) continue;

    // Stage 1: Vector match with broad threshold (0.25)
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: testUser.embedding,
      match_threshold: 0.25,
      match_count: 40
    });

    if (matchError || !matchedJobs || matchedJobs.length === 0) {
      continue;
    }

    const candidateJobs: any[] = [];
    for (const job of matchedJobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) continue;
      }
      candidateJobs.push(job);
    }

    if (candidateJobs.length === 0) continue;

    // Stage 2: LLM Reranking
    const candidateProfile = {
      id: testUser.id,
      job_title: testUser.job_title,
      company: testUser.company,
      about: testUser.about || testUser.professional_bio,
      resume_text: testUser.resume_text,
      profile_digest: testUser.profile_digest,
      tags: testUser.tags,
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

    // Filter for Strong Matches (score >= 75)
    for (const job of jobsToRerank) {
      const reranked = rerankedMap.get(job.id);
      if (!reranked || reranked.score < 75) continue;

      const score = reranked.score;
      const label = reranked.label;
      const reason = reranked.reason;
      const companyName = job.company;
      const jobTitle = job.title;
      const jobId = job.id;

      if (!companyName || !jobTitle) continue;

      // Deduplication check
      const { data: existing } = await supabase
        .from("in_app_notifications")
        .select("id")
        .eq("user_id", testUser.id)
        .like("url", `%${jobId}%`);

      if (existing && existing.length > 0) continue;

      // Dispatch notification
      await sendNotification(testUser.id, {
        title: `🔥 Strong Job Match (${score}%): ${jobTitle} at ${companyName}`,
        body: `${reason} Tap to view details and apply!`,
        url: `/jobs?jobId=${encodeURIComponent(jobId)}&match=${score}`,
        data: { jobId, matchRate: score, label, reason, type: "job_match_75" }
      });

      totalNudgesSent++;
      console.log(`[Whitelisted Nudge] Sent ${score}% (${label}) notification to ${testUser.email} for ${jobTitle} @ ${companyName}`);
    }
  }

  return NextResponse.json({
    success: true,
    whitelistedUsersEvaluated: testUsers.length,
    totalNudgesSent
  });
}
