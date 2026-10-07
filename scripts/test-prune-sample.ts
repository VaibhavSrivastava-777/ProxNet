import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { inspectJobPage } from "../lib/jobs/job-quality";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== Testing 404 and Expired Job Detection on Sample ===");

  // Fetch 50 random or distinct company jobs
  const { data: sample } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, url, posted_at")
    .neq("company", "Wipro")
    .limit(50);

  console.log(`Fetched ${sample?.length} sample non-Wipro jobs.`);

  let activeCount = 0;
  let closedCount = 0;
  let unknownCount = 0;

  for (const j of sample || []) {
    const res = await inspectJobPage(j.url, 5000);
    if (res.status === "closed") {
      console.log(`❌ [CLOSED/404] [${j.company}] "${j.title}" -> ${j.url} (Reason: ${res.reason})`);
      closedCount++;
    } else if (res.status === "active") {
      activeCount++;
    } else {
      unknownCount++;
    }
  }

  console.log(`\nSample Results:`);
  console.log(`  Active: ${activeCount}`);
  console.log(`  Closed/404: ${closedCount}`);
  console.log(`  Unknown/Timeout: ${unknownCount}`);
}

main().catch(console.error);
