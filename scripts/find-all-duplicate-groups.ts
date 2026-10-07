import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

interface CompanyRow {
  id: string;
  company_name: string;
  provider: string;
  board_token_or_url: string;
  total_jobs_found: number;
  scrape_notes: string;
}

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\([^)]*\)/g, "") // remove (pwc), (india), (last company), etc.
    .replace(/\b(corporation|corp|technologies|technology|tech|solutions|systems|services|private|pvt|limited|ltd|inc|holdings|group|india|international|enterprise|consulting|bank|llp)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function main() {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .order("company_name", { ascending: true });

  if (error || !rows) {
    console.error("Error fetching configs:", error);
    return;
  }

  const { data: scrapedJobs } = await supabase.from("scraped_jobs").select("id, company");
  const jobCounts: Record<string, number> = {};
  for (const j of scrapedJobs || []) {
    if (j.company) jobCounts[j.company] = (jobCounts[j.company] || 0) + 1;
  }

  const { data: users } = await supabase.from("users").select("id, company");
  const userCounts: Record<string, number> = {};
  for (const u of users || []) {
    if (u.company) userCounts[u.company] = (userCounts[u.company] || 0) + 1;
  }

  console.log(`Analyzing ${rows.length} total rows in company_ats_config...`);

  // Group by clean string and identical board_token_or_url
  const clusters: Record<string, CompanyRow[]> = {};

  for (const row of rows) {
    if (row.company_name === "cron_status") continue;
    const key = cleanString(row.company_name);
    if (!key) continue;
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(row);
  }

  // Also check if any rows share the EXACT SAME valid board_token_or_url
  const urlClusters: Record<string, CompanyRow[]> = {};
  for (const row of rows) {
    if (row.company_name === "cron_status" || !row.board_token_or_url || row.board_token_or_url === "none") continue;
    const urlKey = row.board_token_or_url.toLowerCase().replace(/\/$/, "");
    if (!urlClusters[urlKey]) urlClusters[urlKey] = [];
    urlClusters[urlKey].push(row);
  }

  console.log("\n=======================================================");
  console.log("IDENTIFIED CANDIDATE DUPLICATE CLUSTERS");
  console.log("=======================================================");

  const handledIds = new Set<string>();
  const deDuplicationPlan: Array<{
    canonical: CompanyRow;
    toDelete: CompanyRow[];
    reason: string;
  }> = [];

  // Helper to score a row to pick the winner
  function scoreRow(r: CompanyRow): number {
    let score = 0;
    // Active jobs in DB
    score += (jobCounts[r.company_name] || 0) * 10;
    // Total jobs found
    score += (r.total_jobs_found || 0);
    // Users associated
    score += (userCounts[r.company_name] || 0) * 20;
    // Better providers
    if (["greenhouse", "lever", "ashby", "smartrecruiters", "oracle", "amazon"].includes(r.provider)) {
      score += 15;
    } else if (r.provider === "custom" && !r.board_token_or_url.includes("google.com/search")) {
      score += 5;
    } else if (r.provider === "none" || r.board_token_or_url.includes("google.com/search")) {
      score -= 50;
    }
    // Penalize junk suffixes in name
    if (/\(last company\)/i.test(r.company_name)) score -= 100;
    if (/^none$/i.test(r.company_name)) score -= 200;
    return score;
  }

  // Process clusters by clean name
  for (const [key, list] of Object.entries(clusters)) {
    if (list.length > 1) {
      // Sort descending by score
      const sorted = [...list].sort((a, b) => scoreRow(b) - scoreRow(a));
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      deDuplicationPlan.push({
        canonical,
        toDelete: duplicates,
        reason: `Clean name match "${key}"`
      });

      for (const r of list) handledIds.add(r.id);
    }
  }

  // Process clusters by identical URL where names might differ slightly
  for (const [url, list] of Object.entries(urlClusters)) {
    if (list.length > 1) {
      const unhandled = list.filter(r => !handledIds.has(r.id));
      if (unhandled.length > 1) {
        const sorted = [...unhandled].sort((a, b) => scoreRow(b) - scoreRow(a));
        const canonical = sorted[0];
        const duplicates = sorted.slice(1);

        deDuplicationPlan.push({
          canonical,
          toDelete: duplicates,
          reason: `Identical URL match "${url}"`
        });

        for (const r of list) handledIds.add(r.id);
      }
    }
  }

  console.log(`Found ${deDuplicationPlan.length} duplicate groups representing ${deDuplicationPlan.reduce((acc, p) => acc + p.toDelete.length, 0)} duplicate rows to remove.\n`);

  for (const plan of deDuplicationPlan) {
    console.log(`🎯 KEEP CANONICAL: "${plan.canonical.company_name}" [${plan.canonical.provider}] (Jobs: ${jobCounts[plan.canonical.company_name] || plan.canonical.total_jobs_found || 0}, Users: ${userCounts[plan.canonical.company_name] || 0})`);
    for (const d of plan.toDelete) {
      console.log(`   ❌ DELETE DUPLICATE: "${d.company_name}" [${d.provider}] (Jobs: ${jobCounts[d.company_name] || d.total_jobs_found || 0}, Users: ${userCounts[d.company_name] || 0}) [Reason: ${plan.reason}]`);
    }
    console.log("");
  }
}

main().catch(console.error);
