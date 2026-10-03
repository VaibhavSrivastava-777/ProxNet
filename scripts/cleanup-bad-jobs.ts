import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { isLikelyJobPostingUrl } from "../lib/jobs/job-quality";

async function main() {
  const sb = createAdminClient();
  const { data: jobs, error } = await sb
    .from("scraped_jobs")
    .select("id, title, company, url");

  if (error || !jobs) {
    console.error("Error fetching jobs:", error);
    return;
  }

  const badJobIds: string[] = [];
  for (const j of jobs) {
    if (!isLikelyJobPostingUrl(j.url)) {
      console.log(`[DELETING BAD URL] ${j.company} - ${j.title}: ${j.url}`);
      badJobIds.push(j.id);
    }
  }

  console.log(`\nFound ${badJobIds.length} non-posting jobs to delete.`);
  if (badJobIds.length > 0) {
    for (let i = 0; i < badJobIds.length; i += 100) {
      const chunk = badJobIds.slice(i, i + 100);
      const { error: delErr } = await sb.from("scraped_jobs").delete().in("id", chunk);
      if (delErr) {
        console.error("Error deleting chunk:", delErr);
      } else {
        console.log(`Deleted chunk of ${chunk.length} jobs.`);
      }
    }
  }

  const { count: remaining } = await sb.from("scraped_jobs").select("*", { count: "exact", head: true });
  console.log(`\nRemaining verified scraped_jobs: ${remaining}`);
}

main().catch(console.error);
