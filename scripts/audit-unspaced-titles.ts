import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function auditTitles() {
  const supabase = createAdminClient();

  const { data: jobs, error } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, url");

  if (error || !jobs) {
    console.error("Error:", error);
    return;
  }

  let unspacedCount = 0;
  let normalCount = 0;
  const sampleUnspaced: any[] = [];

  for (const job of jobs) {
    const t = job.title || "";
    // If title has length > 12 and has no spaces or only 0 spaces
    if (t.length > 12 && !t.includes(" ")) {
      unspacedCount++;
      if (sampleUnspaced.length < 15) {
        sampleUnspaced.push({ company: job.company, title: t, url: job.url });
      }
    } else {
      normalCount++;
    }
  }

  console.log(`Total jobs: ${jobs.length}`);
  console.log(`Normal spaced titles: ${normalCount}`);
  console.log(`Unspaced titles (need fixing): ${unspacedCount}`);
  console.log("\nSample unspaced titles:");
  for (const s of sampleUnspaced) {
    console.log(`  - [${s.company}] "${s.title}" (URL: ${s.url})`);
  }
}

auditTitles();
