import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60; // 60s max for Vercel Hobby

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const job = url.searchParams.get("job");

  // Simple protection for diagnostic route
  if (token !== "proxnet-test-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const diagnostics: Record<string, any> = {
    time: new Date().toISOString(),
    env: {
      hasCronSecret: !!cronSecret,
      cronSecretLength: cronSecret ? cronSecret.length : 0,
      cronSecretFirstChars: cronSecret ? cronSecret.substring(0, 4) + "..." : "EMPTY_OR_UNSET",
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasFirebaseCreds: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
      hasResendKey: !!process.env.RESEND_API_KEY,
    },
    incomingAuthHeader: authHeader ? `${authHeader.substring(0, 12)}... (len: ${authHeader.length})` : "NONE",
    authMatchesCronSecret: authHeader === `Bearer ${cronSecret}`,
  };

  // If a specific job was requested to test, invoke its handler directly
  if (job) {
    const startTime = Date.now();
    try {
      if (job === "event-reminders") {
        // Test event reminders query & logic
        const supabase = createAdminClient();
        const now = new Date();
        const horizon = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
        const { data: events, error } = await supabase
          .from("events")
          .select("id, title, starts_at, venue_name")
          .eq("status", "active")
          .lte("starts_at", horizon)
          .gte("starts_at", now.toISOString());

        diagnostics.testResult = {
          job: "event-reminders",
          durationMs: Date.now() - startTime,
          eventsFound: events?.length || 0,
          eventsSample: events || [],
          dbError: error ? error.message : null,
          status: "success",
        };
      } else if (job === "job-digest") {
        const supabase = createAdminClient();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase
          .from("scraped_jobs")
          .select("id", { count: "exact", head: true })
          .gte("posted_at", sevenDaysAgo);

        diagnostics.testResult = {
          job: "job-digest",
          durationMs: Date.now() - startTime,
          recentJobsCount: count || 0,
          dbError: error ? error.message : null,
          status: "success",
        };
      } else if (job === "job-matches") {
        const supabase = createAdminClient();
        const { count: usersCount, error: uErr } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("is_blocked", false)
          .eq("is_active", true);

        diagnostics.testResult = {
          job: "job-matches",
          durationMs: Date.now() - startTime,
          activeUsersCount: usersCount || 0,
          dbError: uErr ? uErr.message : null,
          status: "success",
        };
      } else if (job === "referral-nudges") {
        const supabase = createAdminClient();
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { count: jobsCount } = await supabase
          .from("scraped_jobs")
          .select("id", { count: "exact", head: true })
          .gte("posted_at", twoWeeksAgo);

        diagnostics.testResult = {
          job: "referral-nudges",
          durationMs: Date.now() - startTime,
          recentJobsCount: jobsCount || 0,
          status: "success",
        };
      } else {
        diagnostics.testResult = { error: `Unknown job: ${job}` };
      }
    } catch (err: any) {
      diagnostics.testResult = {
        job,
        durationMs: Date.now() - startTime,
        status: "failed",
        error: err.message,
        stack: err.stack,
      };
    }
  }

  return NextResponse.json(diagnostics);
}
