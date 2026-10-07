import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== Fetching all jobs in scraped_jobs ===");
  let allJobs: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("scraped_jobs")
      .select("id, company, title, url, posted_at, ats_source")
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order("id", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Total jobs fetched: ${allJobs.length}`);

  // 1. Company counts
  const compMap: Record<string, any[]> = {};
  for (const j of allJobs) {
    const c = (j.company || "Unknown").trim();
    if (!compMap[c]) compMap[c] = [];
    compMap[c].push(j);
  }

  console.log(`Total companies with jobs: ${Object.keys(compMap).length}`);
  const over50 = Object.entries(compMap).filter(([_, list]) => list.length > 50);
  console.log(`Companies with > 50 jobs: ${over50.length}`);
  over50.forEach(([c, list]) => console.log(`  - ${c}: ${list.length} jobs`));

  // 2. Old jobs (> 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
  const oldJobs = allJobs.filter(j => {
    if (!j.posted_at) return true;
    return new Date(j.posted_at).getTime() < thirtyDaysAgo;
  });
  console.log(`Jobs older than 30 days: ${oldJobs.length}`);

  // 3. Google URL jobs
  const googleJobs = allJobs.filter(j => (j.url || "").toLowerCase().includes("google.com"));
  console.log(`Jobs with google.com URL: ${googleJobs.length}`);
  googleJobs.forEach(j => {
    if (j.company !== "Google") {
      console.log(`  - Non-Google: [${j.company}] "${j.title}" -> ${j.url}`);
    }
  });
}

main().catch(console.error);
