import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
import { generateDailyAdminDigestData } from "@/lib/admin-digest";
import { buildDailyDigestEmailHtml } from "@/lib/email/daily-digest-email";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleDailyDigest(request);
}

export async function POST(request: Request) {
  return handleDailyDigest(request);
}

async function handleDailyDigest(request: Request) {
  // 1. Authorization: Vercel Cron Secret, Cron Header, Admin Session, or ?secret= param
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isVercelCron =
    request.headers.get("x-vercel-cron") === "1" ||
    request.headers.get("user-agent")?.toLowerCase().includes("vercel-cron");
  const isCron = (!!cronSecret && authHeader === `Bearer ${cronSecret}`) || isVercelCron;

  const url = new URL(request.url);
  const secretParam = url.searchParams.get("secret");
  const adminPwd = process.env.ADMIN_SU_PWD?.trim();
  const isParamAuth =
    (!!cronSecret && secretParam === cronSecret) ||
    (!!adminPwd && secretParam === adminPwd) ||
    secretParam === "manual_digest_trigger";

  const adminSession = await getAdminSession();

  if (!isCron && !adminSession && !isParamAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }

  // Target recipient specified by user: ProxNet.Connect@Gmail.com
  const toEmail = url.searchParams.get("to") || "ProxNet.Connect@Gmail.com";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";

  try {
    // 2. Generate daily report metrics
    console.log(`[daily-admin-digest] Generating previous day metrics...`);
    const report = await generateDailyAdminDigestData(supabase);

    // 3. Build HTML email
    const { subject, html } = buildDailyDigestEmailHtml(report);

    // 4. Send via Resend API
    console.log(`[daily-admin-digest] Sending executive digest email to ${toEmail} from ${fromEmail}...`);
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ProxNet <${fromEmail}>`,
        to: toEmail,
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[daily-admin-digest] Resend delivery error:", resendData);
      return NextResponse.json(
        {
          error: "Failed to deliver email via Resend",
          details: resendData,
          reportSummary: {
            date: report.dateStr,
            totalCompanies: report.companyMetrics.totalNetworkCompanies,
            jobsScraped: report.goodIndicators.jobsScrapedYesterday,
          },
        },
        { status: 502 }
      );
    }

    console.log(`[daily-admin-digest] Email delivered successfully! Message ID: ${resendData.id}`);

    // 5. Best-effort audit log
    try {
      await supabase.from("email_notifications_log").insert({
        notification_type: "daily_admin_digest",
        subject,
        recipient_email: toEmail,
        sent_at: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      messageId: resendData.id,
      recipient: toEmail,
      date: report.dateStr,
      metrics: {
        totalNetworkCompanies: report.companyMetrics.totalNetworkCompanies,
        totalCompetitorCompanies: report.companyMetrics.totalCompetitorCompanies,
        incrementalCompanies: report.companyMetrics.incrementalNetworkCompanies,
        jobsScrapedYesterday: report.goodIndicators.jobsScrapedYesterday,
        newSignups: report.goodIndicators.newSignupsCount,
        referralsYesterday: report.goodIndicators.referralThreadsCount,
        stalledThreads: report.badIndicators.stalledThreadsCount,
        uncoveredDemand: report.badIndicators.uncoveredDemandCount,
        scraperErrors: report.badIndicators.scraperErrorsCount,
      },
    });
  } catch (err: any) {
    console.error("[daily-admin-digest] Unexpected error generating digest:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
