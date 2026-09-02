import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleReferralNudges(request);
}

export async function POST(request: Request) {
  return handleReferralNudges(request);
}

async function handleReferralNudges(request: Request) {
  // Authorization check (Vercel Cron Secret or Admin Session)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Fetch all active companies that have scraped jobs in the last 14 days
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: recentJobs, error: jobsErr } = await supabase
    .from("scraped_jobs")
    .select("id, company, title")
    .gte("posted_at", twoWeeksAgo.toISOString());

  if (jobsErr || !recentJobs || recentJobs.length === 0) {
    return NextResponse.json({ success: true, message: "No recent jobs to match referrals against." });
  }

  // Group job count by company
  const companyJobCounts = new Map<string, number>();
  for (const j of recentJobs) {
    const comp = (j.company || "").trim().toLowerCase();
    if (comp) {
      companyJobCounts.set(comp, (companyJobCounts.get(comp) || 0) + 1);
    }
  }

  // 2. Fetch all active users with their company
  const { data: allUsers, error: usersErr } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, profile_digest")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (usersErr || !allUsers || allUsers.length === 0) {
    return NextResponse.json({ error: "No users found" }, { status: 500 });
  }

  // Map users who can refer by company
  const companyReferrers = new Map<string, Array<{ id: string; name: string; title: string; company: string }>>();
  for (const u of allUsers) {
    if (u.company && u.company.trim()) {
      const cKey = u.company.trim().toLowerCase();
      if (!companyReferrers.has(cKey)) {
        companyReferrers.set(cKey, []);
      }
      companyReferrers.get(cKey)!.push({
        id: u.id,
        name: u.full_name || "Professional",
        title: u.job_title || "Colleague",
        company: u.company.trim(),
      });
    }
  }

  let nudgesSent = 0;
  const audit: Array<{ userId: string; email: string; company: string; referrerCount: number; jobCount: number }> = [];
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  // 3. For each user, find companies with open jobs AND colleagues/referrers (excluding themselves)
  for (const user of allUsers) {
    // Deduplication check: Avoid sending if user already received a referral nudge in the last 10 days
    const { data: recentNotifs } = await supabase
      .from("in_app_notifications")
      .select("id, created_at")
      .eq("user_id", user.id)
      .like("url", "%refnudge%")
      .gte("created_at", tenDaysAgo.toISOString());

    if (recentNotifs && recentNotifs.length > 0) {
      continue;
    }

    const userCompany = (user.company || "").trim().toLowerCase();
    const targetCompanies: string[] = (user.profile_digest?.target_companies || []).map((t: string) => t.trim().toLowerCase());

    // Candidate referral opportunities: companies where jobs > 0 and referrers > 0 (excluding user)
    let bestCompany: { name: string; jobCount: number; referrers: any[] } | null = null;

    // Check user's explicitly targeted companies first
    for (const targetName of targetCompanies) {
      if (targetName === userCompany) continue;
      const jobCount = companyJobCounts.get(targetName) || 0;
      const referrers = (companyReferrers.get(targetName) || []).filter(r => r.id !== user.id);
      if (jobCount > 0 && referrers.length > 0) {
        bestCompany = { name: referrers[0].company, jobCount, referrers };
        break;
      }
    }

    // If no target company match, check general active companies with jobs and referrers
    if (!bestCompany) {
      for (const [cKey, referrersList] of companyReferrers.entries()) {
        if (cKey === userCompany) continue;
        const jobCount = companyJobCounts.get(cKey) || 0;
        const validReferrers = referrersList.filter(r => r.id !== user.id);
        if (jobCount >= 2 && validReferrers.length > 0) {
          bestCompany = { name: validReferrers[0].company, jobCount, referrers: validReferrers };
          break;
        }
      }
    }

    if (!bestCompany) continue;

    const refCount = bestCompany.referrers.length;
    const compDisplayName = bestCompany.name;
    const notifTitle = `🤝 ${refCount} ProxNet member${refCount > 1 ? "s" : ""} at ${compDisplayName} can refer you`;
    const notifBody = `${compDisplayName} currently has ${bestCompany.jobCount} open roles. Connect with insiders in your proximity to fast-track your referral!`;
    const targetUrl = `/jobs?company=${encodeURIComponent(compDisplayName)}&refnudge=1`;

    await sendNotification(user.id, {
      title: notifTitle,
      body: notifBody,
      url: targetUrl,
      data: {
        type: "referral_network_nudge",
        company: compDisplayName,
        referrerCount: refCount,
        jobCount: bestCompany.jobCount,
      },
    });

    nudgesSent++;
    audit.push({
      userId: user.id,
      email: user.email || "N/A",
      company: compDisplayName,
      referrerCount: refCount,
      jobCount: bestCompany.jobCount,
    });

    console.log(`[Referral Nudge] Sent notification to ${user.email} for ${compDisplayName} (${refCount} contacts, ${bestCompany.jobCount} jobs)`);
  }

  return NextResponse.json({
    success: true,
    usersEvaluated: allUsers.length,
    nudgesSent,
    audit,
  });
}
