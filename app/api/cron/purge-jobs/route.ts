import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";

export const maxDuration = 60;

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

  console.log(`[purge-jobs] Starting automated purge of scraped_jobs older than: ${cutoffIso}`);

  let totalPurged = 0;
  const batchLimit = 500;
  const maxBatches = 20; // Up to 10,000 stale jobs per cron execution
  let batchIndex = 0;

  while (batchIndex < maxBatches) {
    batchIndex++;

    // Order by id is required by PostgREST when using limit on delete
    const { data: batch, error: deleteErr } = await supabase
      .from("scraped_jobs")
      .delete()
      .lt("posted_at", cutoffIso)
      .order("id", { ascending: true })
      .select("id")
      .limit(batchLimit);

    if (deleteErr) {
      console.error("[purge-jobs] Delete error:", deleteErr);
      return NextResponse.json(
        { error: deleteErr.message, totalPurged },
        { status: 500 }
      );
    }

    const batchCount = batch?.length || 0;
    totalPurged += batchCount;

    if (batchCount < batchLimit) {
      break;
    }
  }

  // Also purge any orphaned records with NULL posted_at whose created_at is older than 30 days
  const { data: nullOldBatch, error: nullErr } = await supabase
    .from("scraped_jobs")
    .delete()
    .is("posted_at", null)
    .lt("created_at", cutoffIso)
    .order("id", { ascending: true })
    .select("id")
    .limit(batchLimit);

  if (!nullErr && nullOldBatch && nullOldBatch.length > 0) {
    totalPurged += nullOldBatch.length;
  }

  // Fair Representation Maintenance: prune any company with > 50 jobs down to 50 freshest
  let representationPruned = 0;
  try {
    const { data: allActiveJobs } = await supabase
      .from("scraped_jobs")
      .select("id, company, posted_at")
      .order("posted_at", { ascending: false });

    if (allActiveJobs && allActiveJobs.length > 0) {
      const companyBuckets = new Map<string, string[]>();
      for (const j of allActiveJobs) {
        const cKey = (j.company || "unknown").toLowerCase().trim();
        const list = companyBuckets.get(cKey) || [];
        list.push(j.id);
        companyBuckets.set(cKey, list);
      }

      const toPruneIds: string[] = [];
      for (const [_, ids] of companyBuckets.entries()) {
        if (ids.length > 50) {
          toPruneIds.push(...ids.slice(50));
        }
      }

      if (toPruneIds.length > 0) {
        const { error: pruneErr } = await supabase
          .from("scraped_jobs")
          .delete()
          .in("id", toPruneIds);

        if (!pruneErr) {
          representationPruned = toPruneIds.length;
          totalPurged += representationPruned;
        }
      }
    }
  } catch (err: any) {
    console.warn("[purge-jobs] Fair representation pruning notice:", err.message);
  }

  console.log(`[purge-jobs] Successfully purged ${totalPurged} stale/excess jobs (${representationPruned} representation cap).`);

  return NextResponse.json({
    success: true,
    totalPurged,
    representationPruned,
    cutoffDate: cutoffIso,
    message: `Purged ${totalPurged} jobs older than 30 days or exceeding per-company representation limits.`,
  });
}
