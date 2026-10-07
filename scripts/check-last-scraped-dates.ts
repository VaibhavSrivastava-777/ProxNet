import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: boards } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, last_scraped_at, scrape_notes, total_jobs_found")
    .order("last_scraped_at", { ascending: false });

  if (!boards) return;

  console.log(`Total boards: ${boards.length}`);

  // Look for cron_status row if any
  const cronStatus = boards.filter(b => b.provider === "cron_status" || b.company_name === "cron_status");
  console.log("Cron status rows:", cronStatus);

  // Group by last_scraped_at date (YYYY-MM-DD)
  const dateCounts: Record<string, number> = {};
  let nullDateCount = 0;

  for (const b of boards) {
    if (!b.last_scraped_at) {
      nullDateCount++;
    } else {
      const d = b.last_scraped_at.split("T")[0];
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    }
  }

  console.log("\nLast Scraped Date distribution:");
  console.log("Never scraped (null):", nullDateCount);
  console.log("Dates:", Object.entries(dateCounts).sort((a, b) => b[0].localeCompare(a[0])));

  // Check the most recently scraped boards
  console.log("\nTop 15 most recently scraped boards:");
  for (const b of boards.slice(0, 15)) {
    console.log(`- [${b.company_name}] (${b.provider}) Scraped at: ${b.last_scraped_at} | Notes: ${b.scrape_notes}`);
  }
}

main();
