import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function audit() {
  const supabase = createAdminClient();
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, total_jobs_found, last_scraped_at, scrape_notes")
    .order("total_jobs_found", { ascending: false });

  console.log(`Total rows in company_ats_config: ${configs?.length}`);

  const withJobs = (configs || []).filter(c => (c.total_jobs_found || 0) > 0);
  const zeroJobs = (configs || []).filter(c => !c.total_jobs_found || c.total_jobs_found === 0);

  console.log(`Companies WITH jobs (>0): ${withJobs.length}`);
  console.log(`Companies with ZERO jobs (0): ${zeroJobs.length}`);

  // Provider breakdown
  const providerStats: Record<string, { total: number; withJobs: number }> = {};
  for (const c of configs || []) {
    const p = c.provider || "unknown";
    if (!providerStats[p]) providerStats[p] = { total: 0, withJobs: 0 };
    providerStats[p].total++;
    if ((c.total_jobs_found || 0) > 0) providerStats[p].withJobs++;
  }
  console.log("\nProvider Breakdown:", providerStats);

  console.log("\n--- Top 15 Companies WITH jobs ---");
  for (const c of withJobs.slice(0, 15)) {
    console.log(`  • ${c.company_name} [${c.provider}]: ${c.total_jobs_found} jobs (board: ${c.board_token_or_url})`);
  }

  console.log("\n--- Sample 20 Companies with ZERO jobs ---");
  for (const c of zeroJobs.slice(0, 20)) {
    console.log(`  • ${c.company_name} [${c.provider}]: board: "${c.board_token_or_url}" | notes: "${c.scrape_notes?.slice(0, 60)}"`);
  }
}

audit().catch(console.error);
