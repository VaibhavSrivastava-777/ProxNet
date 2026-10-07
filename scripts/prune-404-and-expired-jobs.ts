import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { inspectJobPage } from "../lib/jobs/job-quality";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CONCURRENCY = 20;

async function pruneExpiredAnd404Jobs() {
  console.log("======================================================");
  console.log("🧹 PRUNING 404, EXPIRED, STALE & EXCESS JOB LISTINGS");
  console.log("======================================================");

  // 1. Get protected job URLs/IDs from user applications so we never delete active applied jobs
  const { data: apps } = await supabase.from("job_applications").select("id, job_url, job_title, company");
  const appliedUrls = new Set((apps || []).map(a => (a.job_url || "").trim().toLowerCase()).filter(Boolean));
  console.log(`Protected user applications: ${appliedUrls.size} applied jobs protected from deletion.`);

  // 2. Fair Representation Cap (<= 50 freshest jobs per company)
  console.log("\n▶ Step 1: Enforcing 50-Job Fair Representation Cap per Company...");
  let allJobs: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("scraped_jobs")
      .select("id, company, title, url, posted_at")
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order("posted_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Initial total catalog size: ${allJobs.length} jobs across all companies.`);

  const companyBuckets = new Map<string, any[]>();
  for (const j of allJobs) {
    const cKey = (j.company || "unknown").toLowerCase().trim();
    const list = companyBuckets.get(cKey) || [];
    list.push(j);
    companyBuckets.set(cKey, list);
  }

  const excessIdsToDelete: string[] = [];
  for (const [comp, jobs] of companyBuckets.entries()) {
    if (jobs.length > 50) {
      // Keep freshest 50 (already sorted by posted_at desc)
      const excess = jobs.slice(50);
      const prunable = excess.filter(j => !appliedUrls.has((j.url || "").toLowerCase().trim()));
      excessIdsToDelete.push(...prunable.map(j => j.id));
      console.log(`  - ${comp}: ${jobs.length} jobs -> pruning ${prunable.length} excess beyond freshest 50`);
    }
  }

  if (excessIdsToDelete.length > 0) {
    console.log(`Deleting ${excessIdsToDelete.length} excess jobs beyond 50-job representation cap...`);
    for (let i = 0; i < excessIdsToDelete.length; i += 200) {
      const chunk = excessIdsToDelete.slice(i, i + 200);
      const { error: delErr } = await supabase.from("scraped_jobs").delete().in("id", chunk);
      if (delErr) console.error("Error deleting representation chunk:", delErr.message);
    }
    console.log("✅ Fair representation cap pruning complete.");
  }

  // 3. Delete jobs older than 30 days
  console.log("\n▶ Step 2: Pruning Jobs Older Than 30 Days...");
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldJobs, error: oldErr } = await supabase
    .from("scraped_jobs")
    .delete()
    .lt("posted_at", thirtyDaysAgoIso)
    .select("id");

  console.log(`Deleted ${oldJobs?.length || 0} jobs older than 30 days.`);

  // 4. Fetch all remaining active jobs for 404 & Expired URL Verification
  console.log("\n▶ Step 3: Fetching remaining jobs for Live 404 & Expiration Verification...");
  let activeJobs: any[] = [];
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from("scraped_jobs")
      .select("id, company, title, url, posted_at")
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) break;
    activeJobs = activeJobs.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Checking ${activeJobs.length} active jobs for 404s, redirects, and expired markers...`);

  const expiredOr404Ids: string[] = [];
  let checkedCount = 0;
  let activeCount = 0;
  let closedCount = 0;
  let timeoutCount = 0;

  for (let i = 0; i < activeJobs.length; i += CONCURRENCY) {
    const batch = activeJobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (job) => {
        checkedCount++;
        // If applied by a user, never delete
        if (appliedUrls.has((job.url || "").toLowerCase().trim())) {
          activeCount++;
          return;
        }

        try {
          const res = await inspectJobPage(job.url, 5000);
          if (res.status === "closed") {
            closedCount++;
            expiredOr404Ids.push(job.id);
            console.log(`  ❌ [PRUNING] [${job.company}] "${job.title}" -> ${res.reason}`);
          } else if (res.status === "active") {
            activeCount++;
          } else {
            timeoutCount++;
          }
        } catch {
          timeoutCount++;
        }
      })
    );

    if (checkedCount % 200 === 0 || checkedCount === activeJobs.length) {
      console.log(`Progress: Checked ${checkedCount}/${activeJobs.length} jobs (Closed/404 found: ${closedCount})...`);
    }
  }

  console.log(`\nURL Verification Summary:`);
  console.log(`  Active: ${activeCount}`);
  console.log(`  Closed/404 identified: ${closedCount}`);
  console.log(`  Timeouts/Unreachable: ${timeoutCount}`);

  if (expiredOr404Ids.length > 0) {
    console.log(`\nDeleting ${expiredOr404Ids.length} expired or 404 job postings from database...`);
    for (let i = 0; i < expiredOr404Ids.length; i += 200) {
      const chunk = expiredOr404Ids.slice(i, i + 200);
      const { error: delErr } = await supabase.from("scraped_jobs").delete().in("id", chunk);
      if (delErr) {
        console.error("Error deleting closed/404 batch:", delErr.message);
      } else {
        console.log(`  Deleted chunk of ${chunk.length} expired/404 jobs.`);
      }
    }
  }

  // 5. Final catalog health check
  const { count: finalJobCount } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  const { count: finalWiproCount } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true })
    .ilike("company", "%wipro%");

  console.log("\n======================================================");
  console.log("🎉 PRUNING COMPLETE!");
  console.log(`  Total remaining live jobs: ${finalJobCount}`);
  console.log(`  Wipro jobs remaining (capped at 50 max): ${finalWiproCount}`);
  console.log("======================================================");
}

pruneExpiredAnd404Jobs().catch(console.error);
