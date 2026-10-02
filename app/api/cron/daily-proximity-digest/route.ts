import { NextResponse } from "next/server";
import { runDailyProximityAndJobsCron } from "@/lib/notifications/daily-proximity-and-jobs";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 120;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  // Allow trigger if cron secret matches or if admin is logged in
  if (!isCron && !adminSession) {
    // In dev / manual testing, check if query param ?key matches CRON_SECRET
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!cronSecret || key !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await runDailyProximityAndJobsCron();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (error: any) {
    console.error("Daily proximity & jobs digest cron failed:", error);
    return NextResponse.json({
      error: "CRON_FAILED",
      message: error?.message || "Daily digest failed.",
    }, { status: 500 });
  }
}
