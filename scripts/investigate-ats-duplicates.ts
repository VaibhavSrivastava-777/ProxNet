import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

function normalizeCompanyName(name: string): string {
  let clean = name.toLowerCase().trim();
  // Remove content in parentheses, e.g., "(last company)", "(pwc)", "(india)"
  clean = clean.replace(/\([^)]*\)/g, " ");
  // Remove common corporate suffixes & legal entities
  clean = clean.replace(/\b(corporation|corp|technologies|technology|tech|solutions|systems|services|private|pvt|limited|ltd|inc|holdings|group|india)\b/gi, " ");
  // Remove punctuation & extra spaces
  clean = clean.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  return clean;
}

async function main() {
  const supabase = createAdminClient();
  const { data: configs, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .order("company_name", { ascending: true });

  if (error || !configs) {
    console.error("Error fetching configs:", error);
    return;
  }

  console.log(`Total rows fetched: ${configs.length}`);

  // 1. Group by normalized company name
  const normalizedGroups: Record<string, any[]> = {};
  for (const c of configs) {
    if (c.company_name === "cron_status") continue;
    const norm = normalizeCompanyName(c.company_name);
    if (!norm) continue;
    if (!normalizedGroups[norm]) normalizedGroups[norm] = [];
    normalizedGroups[norm].push(c);
  }

  // 2. Also group by board_token_or_url
  const urlGroups: Record<string, any[]> = {};
  for (const c of configs) {
    if (c.company_name === "cron_status" || !c.board_token_or_url) continue;
    const cleanUrl = c.board_token_or_url.toLowerCase().trim().replace(/\/$/, "");
    if (!urlGroups[cleanUrl]) urlGroups[cleanUrl] = [];
    urlGroups[cleanUrl].push(c);
  }

  console.log("\n=== CLUSTERS FOUND BY NORMALIZED NAME (>1 ENTRY) ===");
  let dupCount = 0;
  for (const [norm, list] of Object.entries(normalizedGroups)) {
    if (list.length > 1) {
      dupCount += (list.length - 1);
      console.log(`\nCluster [${norm}]: (${list.length} rows)`);
      for (const row of list) {
        console.log(`  • "${row.company_name}" [${row.provider}] (token/url: "${row.board_token_or_url}") -> jobs: ${row.total_jobs_found || 0}`);
      }
    }
  }

  console.log("\n=== CLUSTERS FOUND BY IDENTICAL URL/BOARD TOKEN (>1 ENTRY) ===");
  for (const [url, list] of Object.entries(urlGroups)) {
    if (list.length > 1) {
      console.log(`\nSame URL [${url}]: (${list.length} rows)`);
      for (const row of list) {
        console.log(`  • "${row.company_name}" [${row.provider}] -> jobs: ${row.total_jobs_found || 0}`);
      }
    }
  }

  console.log(`\nTotal potential duplicates identified by name grouping: ${dupCount}`);
}

main().catch(console.error);
