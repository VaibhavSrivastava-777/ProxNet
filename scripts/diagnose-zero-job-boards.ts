import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");

  const supabase = createClient(url, key);

  const { data: boards, error } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, total_jobs_found, last_scraped_at, scrape_notes")
    .neq("provider", "cron_status")
    .order("company_name", { ascending: true });

  if (error) {
    console.error("Error fetching configs:", error);
    return;
  }

  console.log(`Total boards in company_ats_config: ${boards.length}`);

  const withJobs = boards.filter((b) => (b.total_jobs_found || 0) > 0);
  const zeroJobs = boards.filter((b) => !b.total_jobs_found || b.total_jobs_found === 0);

  console.log(`Boards with jobs (>0): ${withJobs.length}`);
  console.log(`Boards with 0 jobs or unscraped: ${zeroJobs.length}`);

  // Analyze zeroJobs providers
  const providerCount: Record<string, number> = {};
  for (const b of zeroJobs) {
    providerCount[b.provider] = (providerCount[b.provider] || 0) + 1;
  }
  console.log("\nZero jobs breakdown by provider:", providerCount);

  // Check URL patterns in zeroJobs
  let googleSearchCount = 0;
  let invalidUrls = 0;
  let customCount = 0;

  for (const b of zeroJobs) {
    const val = b.board_token_or_url || "";
    if (val.includes("google.com/search")) googleSearchCount++;
    if (b.provider === "custom") customCount++;
  }

  console.log(`Google search URLs: ${googleSearchCount}`);
  console.log(`Custom URLs: ${customCount}`);

  // Print first 40 zero-job boards for diagnostic inspection
  console.log("\nSample 40 zero-job boards:");
  for (const b of zeroJobs.slice(0, 40)) {
    console.log(`- [${b.company_name}] (${b.provider}) -> "${b.board_token_or_url}" | notes: ${b.scrape_notes || "none"}`);
  }
}

main();
