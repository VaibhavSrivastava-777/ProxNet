import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import { createAdminClient } from "../lib/supabase/admin";
import { getPreviousDayIstBounds, generateDailyAdminDigestData } from "../lib/admin-digest";
import { buildDailyDigestEmailHtml } from "../lib/email/daily-digest-email";

async function run() {
  console.log("================================================================================");
  console.log("🧪 TEST SUITE: DAILY 8 AM ADMINISTRATIVE DIGEST EMAIL & METRICS ENGINE");
  console.log("================================================================================\n");

  // 1. Test IST Date Bounds Calculation
  console.log("[Test 1] Testing IST previous day bounds calculation...");
  const bounds = getPreviousDayIstBounds();
  console.log("   IST Bounds:", bounds);
  const diffMs = new Date(bounds.endUtcIso).getTime() - new Date(bounds.startUtcIso).getTime();
  console.log(`   Time window span: ${diffMs / (1000 * 60 * 60)} hours (${diffMs} ms)`);
  assert(Math.abs(diffMs - 86399999) < 2000, "Window must be exactly 24 hours");
  assert(bounds.dateStr.length > 5, "Date string must be formatted");

  // 2. Test Digest Data Aggregation
  console.log("\n[Test 2] Testing generateDailyAdminDigestData aggregation...");
  const supabase = createAdminClient();
  const report = await generateDailyAdminDigestData(supabase);

  console.log("   --- Company Inventory ---");
  console.log(`   • Total Network Companies: ${report.companyMetrics.totalNetworkCompanies}`);
  console.log(`   • Total Competitors Tracked: ${report.companyMetrics.totalCompetitorCompanies}`);
  console.log(`   • Total Configured ATS Boards: ${report.companyMetrics.totalConfiguredAts}`);
  console.log(`   • Companies With Active Jobs: ${report.companyMetrics.totalCompaniesWithJobs}`);
  console.log(`   • Incremental Network Companies: ${report.companyMetrics.incrementalNetworkCompanies}`);
  console.log(`   • Incremental Competitors: ${report.companyMetrics.incrementalCompetitors}`);

  console.log("   --- Good Leading Indicators ---");
  console.log(`   • New User Signups: ${report.goodIndicators.newSignupsCount}`);
  console.log(`   • Pioneer Bounties Awarded: ${report.goodIndicators.pioneerBountiesCount}`);
  console.log(`   • Referral Threads: ${report.goodIndicators.referralThreadsCount}`);
  console.log(`   • Referral Messages: ${report.goodIndicators.referralMessagesCount}`);
  console.log(`   • Jobs Scraped Yesterday: ${report.goodIndicators.jobsScrapedYesterday}`);
  console.log(`   • In-App Notifications Delivered: ${report.goodIndicators.notificationsDelivered}`);

  console.log("   --- Bad Leading Indicators ---");
  console.log(`   • Scraper Board Errors: ${report.badIndicators.scraperErrorsCount}`);
  console.log(`   • Uncovered Referral Demand Companies: ${report.badIndicators.uncoveredDemandCount}`);
  console.log(`   • Stalled Referral Threads (>24h waiting): ${report.badIndicators.stalledThreadsCount}`);
  console.log(`   • Incomplete Signups Drop-off: ${report.badIndicators.incompleteSignupsCount}`);
  console.log(`   • Blocked Users: ${report.badIndicators.blockedUsersCount}`);

  assert(typeof report.companyMetrics.totalNetworkCompanies === "number", "Total network companies must be a number");
  assert(Array.isArray(report.goodIndicators.newSignups), "newSignups must be an array");
  assert(Array.isArray(report.badIndicators.stalledThreads), "stalledThreads must be an array");

  // 3. Test HTML Email Generation
  console.log("\n[Test 3] Testing buildDailyDigestEmailHtml email layout...");
  const { subject, html } = buildDailyDigestEmailHtml(report);
  console.log(`   Subject: "${subject}"`);
  console.log(`   HTML Length: ${html.length} characters`);

  assert(subject.includes("ProxNet Daily Pulse"), "Subject must contain 'ProxNet Daily Pulse'");
  assert(html.includes("Executive Morning Digest"), "HTML must contain header badge");
  assert(html.includes("Good Leading Indicators"), "HTML must contain Good Leading Indicators section");
  assert(html.includes("Bad Leading Indicators"), "HTML must contain Bad Leading Indicators section");
  assert(html.includes("ProxNet.Connect@Gmail.com"), "HTML must mention destination recipient");
  assert(html.includes("https://www.proxnet.in/admin"), "HTML must include CTA to admin dashboard");

  // 4. Test Resend API Dispatch to ProxNet.Connect@Gmail.com
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@proxnet.in";
  const toEmail = "ProxNet.Connect@Gmail.com";

  console.log(`\n[Test 4] Dispatching test email via Resend API to ${toEmail}...`);
  assert(apiKey, "RESEND_API_KEY is required");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ProxNet <${fromEmail}>`,
      to: toEmail,
      subject,
      html,
    }),
  });

  const resendResult = await res.json();
  if (!res.ok) {
    console.error("❌ Resend API failed:", resendResult);
    throw new Error(`Resend returned HTTP ${res.status}: ${JSON.stringify(resendResult)}`);
  }

  console.log(`✅ Email delivered successfully to ${toEmail}! Message ID: ${resendResult.id}`);

  console.log("\n================================================================================");
  console.log("🎉 ALL DAILY ADMINISTRATIVE DIGEST & EMAIL DISPATCH TESTS PASSED!");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
