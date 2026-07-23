import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  // Protect this endpoint (either via a cron secret or admin check)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Seeker Nudge: Match newly scraped jobs against users
  // We look for scraped jobs from the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs } = await supabase
    .from("scraped_jobs")
    .select("*")
    .gte("created_at", oneDayAgo);

  if (recentJobs && recentJobs.length > 0) {
    // Get all users who have a profile_digest or keywords
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, profile_digest, company")
      .eq("is_blocked", false)
      .not("profile_digest", "is", null);

    if (users) {
      for (const job of recentJobs) {
        // Find users whose profile_digest matches the job role or keywords
        const jobKeywords = ((job.title || "") + " " + (job.keywords || "")).toLowerCase();
        
        for (const user of users) {
          // Exclude users who work at the company already
          if (user.company?.toLowerCase() === job.company_name?.toLowerCase()) continue;

          const userProfileStr = JSON.stringify(user.profile_digest).toLowerCase();
          
          // Very basic matching logic: if the user's profile contains key words from the job title
          const titleWords = (job.title || "").toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
          const matchCount = titleWords.filter((w: string) => userProfileStr.includes(w)).length;
          
          if (matchCount > 0) {
            // We have a match! Send a nudge.
            await sendNotification(user.id, {
              title: "New Job Match! 🚀",
              body: `A new ${job.title} role opened at ${job.company_name}. We have verified insiders there. Request a referral now!`,
              url: `/jobs`
            });
          }
        }
      }
    }
  }

  // 2. Insider Nudge: Match seekers (active 'seeker' job_posts) to insiders
  const { data: seekerPosts } = await supabase
    .from("job_posts")
    .select("*, user:users(id, full_name)")
    .eq("status", "active")
    .eq("type", "seeker")
    .gte("created_at", oneDayAgo); // Only nudge for recent requests

  if (seekerPosts && seekerPosts.length > 0) {
    for (const post of seekerPosts) {
      if (!post.company) continue; // If they didn't specify a target company, skip

      // Find insiders at this target company
      const { data: insiders } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("is_blocked", false)
        .ilike("company", post.company);

      if (insiders) {
        for (const insider of insiders) {
          if (insider.id === post.user_id) continue;

          await sendNotification(insider.id, {
            title: "Referral Request 🤝",
            body: `A verified professional is looking for a referral for a ${post.role} role at your company. Refer them and earn a bonus!`,
            url: `/jobs`
          });
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
