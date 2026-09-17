import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 30;

export async function GET(request: Request) {
  return handlePurge(request);
}

export async function POST(request: Request) {
  return handlePurge(request);
}

async function handlePurge(request: Request) {
  // Authorization: Vercel Cron Secret or Admin Session
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron =
    (!!cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    request.headers.get("x-vercel-cron") === "1";
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  console.log(`[purge-jobs] Purging scraped_jobs older than: ${cutoffIso}`);

  // Delete stale jobs in batches to avoid timeout on large tables
  let totalPurged = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error: deleteErr } = await supabase
      .from("scraped_jobs")
      .delete()
      .lt("posted_at", cutoffIso)
      .select("id, company")
      .limit(500);

    if (deleteErr) {
      console.error("[purge-jobs] Delete error:", deleteErr);
      return NextResponse.json(
        { error: deleteErr.message, totalPurged },
        { status: 500 }
      );
    }

    const batchCount = batch?.length || 0;
    totalPurged += batchCount;
    hasMore = batchCount === 500; // If we got exactly 500, there may be more
  }

  // Aggregate purge stats per company for audit
  console.log(`[purge-jobs] Successfully purged ${totalPurged} stale jobs.`);

  return NextResponse.json({
    success: true,
    totalPurged,
    cutoffDate: cutoffIso,
    message: `Purged ${totalPurged} jobs older than 30 days.`,
  });
}
