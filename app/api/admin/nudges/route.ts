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
    .select("id, full_name, email, profile_digest, company, embedding")
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

  let totalNudgesSent = 0;

  for (const testUser of testUsers) {
    if (!testUser.embedding) continue;

    // Vector match against scraped jobs with > 60% match threshold
    const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: testUser.embedding,
      match_threshold: 0.6, // strict > 60%
      match_count: 20
    });

    if (matchError || !matchedJobs || matchedJobs.length === 0) {
      // If there is no matching job (> 60%), do NOT send notification
      continue;
    }

    for (const job of matchedJobs) {
      const matchRate = Math.round((job.similarity || 0) * 100);
      if (matchRate <= 60) continue;

      const companyName = (job.company || job.company_name || "").trim();
      const jobTitle = (job.title || job.role || "").trim();
      const jobId = job.id;

      if (!companyName || !jobTitle) continue;

      // Check if user was already notified for THIS PARTICULAR JOB POSTING
      const { data: existing } = await supabase
        .from("in_app_notifications")
        .select("id")
        .eq("user_id", testUser.id)
        .like("url", `%${jobId}%`);

      if (existing && existing.length > 0) continue;

      // Send mobile notification ONLY FOR THIS PARTICULAR JOB POSTING
      await sendNotification(testUser.id, {
        title: `🔥 ${matchRate}% Job Match: ${jobTitle} at ${companyName}`,
        body: `Matching Job: "${jobTitle}" at ${companyName} has a ${matchRate}% match with your profile. Tap to apply!`,
        url: `/jobs?jobId=${encodeURIComponent(jobId)}&match=${matchRate}`,
        data: { jobId, matchRate, type: "job_match_60" }
      });

      totalNudgesSent++;
      console.log(`[Whitelisted Nudge] Sent ${matchRate}% match notification to ${testUser.email} for ${jobTitle} @ ${companyName}`);
    }
  }

  return NextResponse.json({
    success: true,
    whitelistedUsersEvaluated: testUsers.length,
    totalNudgesSent
  });
}
