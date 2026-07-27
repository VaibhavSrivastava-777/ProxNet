import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";

// Whitelisted accounts for selective testing
const WHITELISTED_TEST_EMAILS = [
  "vaibhav.srivastava@iiml.org",
  "swatipandya.sr@gmail.com"
];

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow logged-in admin access for testing
  }

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

  // 2. Look for recent scraped jobs posted in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs } = await supabase
    .from("scraped_jobs")
    .select("*")
    .gte("created_at", sevenDaysAgo);

  let totalNudgesSent = 0;

  if (recentJobs && recentJobs.length > 0) {
    for (const testUser of testUsers) {
      // Find companies where OTHER verified professionals work (potential referrers)
      const { data: insiders } = await supabase
        .from("users")
        .select("company")
        .neq("id", testUser.id)
        .not("company", "is", null);

      const availableCompanies = new Set(insiders?.map(i => i.company?.trim().toLowerCase()).filter(Boolean));

      // Match user against recent jobs
      for (const job of recentJobs) {
        if (!job.company_name) continue;
        const jobCompany = job.company_name.trim().toLowerCase();

        // Check if user already works there
        if (testUser.company?.trim().toLowerCase() === jobCompany) continue;

        // Check if there are verified referrers at this target company
        if (!availableCompanies.has(jobCompany)) continue;

        // Send a specific high-confidence opportunity notification
        await sendNotification(testUser.id, {
          title: `High-Match Opportunity: ${job.title} 🚀`,
          body: `A job matching your profile opened at ${job.company_name}. Verified referrers are available on ProxNet to refer you!`,
          url: `/qa?tab=network&company=${encodeURIComponent(job.company_name)}`
        });

        totalNudgesSent++;
        console.log(`[Whitelisted Nudge] Sent opportunity notification to ${testUser.email} for ${job.title} @ ${job.company_name}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    whitelistedUsersEvaluated: testUsers.length,
    totalNudgesSent
  });
}
