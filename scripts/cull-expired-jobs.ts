import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONCURRENCY_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 15000;

const CLOSED_MARKERS = [
  "no longer available",
  "position has been filled",
  "job is closed",
  "page not found",
  "no longer accepting applications",
  "this job is no longer active",
  "unable to find the page",
  "job post not found",
  "position is closed",
  "not found",
];

async function isJobUrlExpired(url: string): Promise<{ expired: boolean; reason: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410) {
      return { expired: true, reason: `Status code ${res.status}` };
    }

    // Check redirects
    if (res.redirected) {
      const originalUrlObj = new URL(url);
      const finalUrlObj = new URL(res.url);

      // Greenhouse redirects to board main page if job is closed
      // e.g. /jobs/123 -> /companyname
      if (
        originalUrlObj.hostname.includes("greenhouse.io") &&
        !finalUrlObj.pathname.includes("/jobs/")
      ) {
        return { expired: true, reason: `Redirected from job URL to board root: ${res.url}` };
      }

      // Lever redirects to job board root if closed
      if (
        originalUrlObj.hostname.includes("lever.co") &&
        originalUrlObj.pathname !== finalUrlObj.pathname &&
        finalUrlObj.pathname === `/${originalUrlObj.pathname.split("/")[1]}`
      ) {
        return { expired: true, reason: `Redirected from job URL to Lever board root: ${res.url}` };
      }

      // SuccessFactors redirects to careers main search or homepage if closed
      if (
        url.includes("careers.wipro.com") &&
        !res.url.includes("/job/") &&
        !res.url.includes("/jobs/")
      ) {
        return { expired: true, reason: `Redirected to SuccessFactors root search: ${res.url}` };
      }
    }

    // For HTML responses, inspect text body for closed markers
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const htmlText = (await res.text()).toLowerCase();

      for (const marker of CLOSED_MARKERS) {
        if (htmlText.includes(marker)) {
          return { expired: true, reason: `Found closed marker text: "${marker}"` };
        }
      }
    }

    return { expired: false, reason: "Active" };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { expired: false, reason: "Timeout (assumed active to prevent false positives)" };
    }
    // Network errors or connection refusals are sometimes temporary, 
    // but a persistent connection failure might indicate a dead domain/url.
    // We treat connection errors as active to avoid deleting valid jobs under temporary network glithces.
    return { expired: false, reason: `Network error: ${err.message}` };
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing DB credentials in .env.local");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const verbose = process.argv.includes("--verbose");

  console.log("=".repeat(60));
  console.log(`  ProxNet Expired Jobs Culler`);
  console.log(`  Dry Run: ${dryRun ? "ENABLED (No changes will be saved)" : "DISABLED (Expired jobs will be deleted)"}`);
  console.log("=".repeat(60));

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("Fetching all jobs from scraped_jobs...");
  const { data: jobs, error: jobsError } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, url, posted_at");

  if (jobsError) {
    console.error("Failed to fetch jobs:", jobsError.message);
    process.exit(1);
  }

  console.log(`Found ${jobs.length} jobs to check.`);

  const expiredJobs: typeof jobs = [];
  let checkedCount = 0;

  // Process in concurrent batches
  for (let i = 0; i < jobs.length; i += CONCURRENCY_LIMIT) {
    const batch = jobs.slice(i, i + CONCURRENCY_LIMIT);
    
    await Promise.all(
      batch.map(async (job) => {
        const check = await isJobUrlExpired(job.url);
        checkedCount++;

        if (check.expired) {
          console.log(`[EXPIRED] "${job.title}" (${job.company})`);
          console.log(`  URL: ${job.url}`);
          console.log(`  Reason: ${check.reason}\n`);
          expiredJobs.push(job);
        } else if (verbose) {
          console.log(`[ACTIVE] "${job.title}" (${job.company}) - ${check.reason}`);
        }
      })
    );

    if (checkedCount % 20 === 0 || checkedCount === jobs.length) {
      console.log(`Progress: checked ${checkedCount}/${jobs.length} jobs...`);
    }
  }

  console.log(`\nCulling Summary:`);
  console.log(`  Total checked: ${jobs.length}`);
  console.log(`  Expired jobs identified: ${expiredJobs.length}`);

  if (expiredJobs.length > 0) {
    if (dryRun) {
      console.log(`\n[DRY RUN] Would have deleted ${expiredJobs.length} expired jobs.`);
    } else {
      console.log(`\nDeleting ${expiredJobs.length} expired jobs from database...`);
      const idsToDelete = expiredJobs.map((j) => j.id);

      // Perform deletion in chunks of 100 to avoid long query parameters
      for (let offset = 0; offset < idsToDelete.length; offset += 100) {
        const chunk = idsToDelete.slice(offset, offset + 100);
        const { error: deleteError } = await supabase
          .from("scraped_jobs")
          .delete()
          .in("id", chunk);

        if (deleteError) {
          console.error(`  ❌ Failed to delete batch:`, deleteError.message);
        } else {
          console.log(`  ✅ Deleted batch of ${chunk.length} jobs.`);
        }
      }
    }
  } else {
    console.log("No expired jobs found. Everything is active!");
  }

  console.log(`\n🎉 Culling script execution complete!`);
}

main().catch(console.error);
