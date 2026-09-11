import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleDailyEngagement(request);
}

export async function POST(request: Request) {
  return handleDailyEngagement(request);
}

interface EngagementTemplate {
  title: string;
  body: string;
  url: string;
  type: string;
}

const ENGAGEMENT_TEMPLATES: EngagementTemplate[] = [
  {
    title: "💼 Discover Fresh Local Openings Early",
    body: "ProxNet spots job opportunities directly from companies in your area before public job boards. Check your fresh matches today!",
    url: "/jobs",
    type: "daily_engagement_jobs",
  },
  {
    title: "🤝 Connect with Verified Local Tech Peers",
    body: "Engineers and leaders from top companies live and work right in your tech cluster. Expand your local network on ProxNet!",
    url: "/network",
    type: "daily_engagement_network",
  },
  {
    title: "🚀 Skip the ATS Queue with ProxNet",
    body: "Get referred directly by employees living in your neighborhood who work at your target companies. Request an inside referral today.",
    url: "/jobs",
    type: "daily_engagement_referrals",
  },
  {
    title: "📍 Hyperlocal Tech Q&A in Your Neighborhood",
    body: "Have questions about local tech hubs, team culture, or salaries? Ask verified local peers on ProxNet.",
    url: "/qa",
    type: "daily_engagement_qa",
  },
];

async function handleDailyEngagement(request: Request) {
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
    .select("id, email, full_name, company, job_title")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (userError || !users) {
    return NextResponse.json({ error: "Failed to fetch active users", details: userError }, { status: 500 });
  }

  // 2. Identify users who received at least one notification in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentNotifications, error: notifError } = await supabase
    .from("in_app_notifications")
    .select("user_id")
    .gte("created_at", twentyFourHoursAgo);

  if (notifError) {
    console.error("Failed to query recent notifications:", notifError);
  }

  const usersWithRecentActivity = new Set((recentNotifications || []).map((n) => n.user_id));

  // 3. Filter to users who have received NOTHING today
  const eligibleUsers = users.filter((u) => !usersWithRecentActivity.has(u.id));

  let sentCount = 0;
  const auditDetails: Array<{ userId: string; email: string; templateTitle: string; url: string }> = [];

  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

  // 4. Send rotating engagement notification to each eligible user
  for (const user of eligibleUsers) {
    try {
      // Deterministic rotation per user to provide variety across the community
      const userHash = user.id.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const templateIndex = Math.abs(dayOfYear + userHash) % ENGAGEMENT_TEMPLATES.length;
      const template = ENGAGEMENT_TEMPLATES[templateIndex];

      await sendNotification(user.id, {
        title: template.title,
        body: template.body,
        url: template.url,
        data: {
          type: template.type,
          engagementType: "daily_value_prop",
          timestamp: new Date().toISOString(),
        },
      });

      sentCount++;
      auditDetails.push({
        userId: user.id,
        email: user.email || "N/A",
        templateTitle: template.title,
        url: template.url,
      });
    } catch (sendErr) {
      console.error(`Failed to send daily engagement notification to user ${user.id}:`, sendErr);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Daily engagement notifications processed. ${sentCount} notifications dispatched out of ${eligibleUsers.length} eligible users (${users.length} total active users, ${usersWithRecentActivity.size} had recent activity).`,
    totalActiveUsers: users.length,
    usersWithRecentActivity: usersWithRecentActivity.size,
    eligibleUsers: eligibleUsers.length,
    notificationsDispatched: sentCount,
    audit: auditDetails.slice(0, 10), // sample audit of first 10
  });
}
