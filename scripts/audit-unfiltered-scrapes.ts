import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { STRATEGIES, ScrapedJob } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("================================================================================");
  console.log("PROXNET COMPREHENSIVE UNFILTERED JOB SCRAPE AUDIT");
  console.log("================================================================================\n");

  // 1. Fetch from company_ats_config
  const { data: configs } = await supabase.from("company_ats_config").select("*");

  // 2. Fetch from users.company
  const { data: users } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const invalidStrings = ["retired", "student", "freelance", "self-employed", "n/a", "none", "independent advisory", "cron_status"];
  const userCompanies = new Set(
    (users || [])
      .map((u) => u.company?.trim())
      .filter((c): c is string => Boolean(c) && !invalidStrings.some((inv) => c.toLowerCase().includes(inv)))
  );

  // 3. Fetch from user_target_companies
  const { data: targetRows } = await supabase.from("user_target_companies").select("*");

  // 4. Existing scraped_jobs in DB
  const { data: existingJobs } = await supabase.from("scraped_jobs").select("company");
  const countInDb = new Map<string, number>();
  (existingJobs || []).forEach(j => {
    if (!j.company) return;
    const k = j.company.toLowerCase().trim();
    countInDb.set(k, (countInDb.get(k) || 0) + 1);
  });

  // Consolidate into master company map
  interface CompanyRecord {
    displayName: string;
    provider: string;
    boardTokenOrUrl: string;
    jobsInDb: number;
    sources: string[];
  }

  const master = new Map<string, CompanyRecord>();

  for (const c of configs || []) {
    if (invalidStrings.some((inv) => c.company_name.toLowerCase().includes(inv))) continue;
    const k = c.company_name.toLowerCase().trim();
    master.set(k, {
      displayName: c.company_name,
      provider: c.provider || "none",
      boardTokenOrUrl: c.board_token_or_url || "",
      jobsInDb: countInDb.get(k) || 0,
      sources: ["company_ats_config"],
    });
  }

  for (const comp of userCompanies) {
    const k = comp.toLowerCase().trim();
    if (master.has(k)) {
      master.get(k)!.sources.push("users.company");
    } else {
      master.set(k, {
        displayName: comp,
        provider: "none",
        boardTokenOrUrl: "",
        jobsInDb: countInDb.get(k) || 0,
        sources: ["users.company"],
      });
    }
  }

  for (const t of targetRows || []) {
    const k = t.company_name.toLowerCase().trim();
    if (master.has(k)) {
      master.get(k)!.sources.push("user_target_companies");
      // If user_target_companies has a specific provider, record it
      if (t.ats_provider && t.ats_provider !== "none") {
        master.get(k)!.provider = t.ats_provider;
      }
      if (t.ats_board_token || t.careers_url) {
        master.get(k)!.boardTokenOrUrl = t.ats_board_token || t.careers_url;
      }
    } else {
      master.set(k, {
        displayName: t.company_name,
        provider: t.ats_provider || "none",
        boardTokenOrUrl: t.ats_board_token || t.careers_url || "",
        jobsInDb: countInDb.get(k) || 0,
        sources: ["user_target_companies"],
      });
    }
  }

  const allCompanies = Array.from(master.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  console.log(`Total Master Companies in ProxNet: ${allCompanies.length}\n`);

  // Categorize
  const nativeApiProviders = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "breezy", "recruitee", "amazon", "successfactors_sitemap"];
  const customProviders = ["custom", "workday", "phenom", "ibm", "oracle", "eightfold", "icims", "successfactors", "myworkdayjobs"];
  const unconfigured = allCompanies.filter(c => c.provider === "none" || !c.provider || !c.boardTokenOrUrl);

  console.log(`Summary by Category:`);
  console.log(`- Native API Strategy Companies: ${allCompanies.filter(c => nativeApiProviders.includes(c.provider)).length}`);
  console.log(`- Custom / Firecrawl Strategy Companies: ${allCompanies.filter(c => customProviders.includes(c.provider)).length}`);
  console.log(`- Unconfigured (No ATS / No URL): ${unconfigured.length}\n`);

  // Let's test all Native API strategy companies right now with ZERO filters
  console.log("================================================================================");
  console.log("TESTING ALL NATIVE API STRATEGIES (ZERO FILTERS)");
  console.log("================================================================================\n");

  const results: Array<{
    name: string;
    provider: string;
    board: string;
    rawJobsCount: number;
    sampleJob?: string;
    error?: string;
    jobsInDb: number;
  }> = [];

  for (const c of allCompanies.filter(c => nativeApiProviders.includes(c.provider))) {
    const strategy = STRATEGIES[c.provider];
    if (!strategy) {
      results.push({ name: c.displayName, provider: c.provider, board: c.boardTokenOrUrl, rawJobsCount: 0, error: "No strategy found", jobsInDb: c.jobsInDb });
      continue;
    }

    try {
      // Abort after 10s per API call so nothing hangs
      const jobs: ScrapedJob[] = await Promise.race([
        strategy(c.boardTokenOrUrl, c.displayName),
        new Promise<ScrapedJob[]>((_, reject) => setTimeout(() => reject(new Error("Timeout (10s)")), 10000))
      ]);

      results.push({
        name: c.displayName,
        provider: c.provider,
        board: c.boardTokenOrUrl,
        rawJobsCount: jobs.length,
        sampleJob: jobs.length > 0 ? jobs[0].title : undefined,
        jobsInDb: c.jobsInDb,
      });
      console.log(`[PASS] ${c.displayName} (${c.provider}): ${jobs.length} raw jobs (Sample: ${jobs[0]?.title || "N/A"})`);
    } catch (e: any) {
      results.push({
        name: c.displayName,
        provider: c.provider,
        board: c.boardTokenOrUrl,
        rawJobsCount: 0,
        error: e.message,
        jobsInDb: c.jobsInDb,
      });
      console.log(`[FAIL] ${c.displayName} (${c.provider}, token: "${c.boardTokenOrUrl}"): ${e.message}`);
    }
  }

  console.log("\n--- NATIVE API RESULTS SUMMARY ---");
  const nativeSuccess = results.filter(r => r.rawJobsCount > 0);
  const nativeZeroOrFail = results.filter(r => r.rawJobsCount === 0);
  console.log(`Native API Companies Tested: ${results.length}`);
  console.log(`Companies returning >= 1 raw job: ${nativeSuccess.length}`);
  console.log(`Companies returning 0 or failing: ${nativeZeroOrFail.length}`);

  if (nativeZeroOrFail.length > 0) {
    console.log("\nDetails of Native API failures / 0 jobs:");
    nativeZeroOrFail.forEach(f => {
      console.log(`- ${f.name} (${f.provider}, token: "${f.board}"): ${f.error || "0 jobs returned"}`);
    });
  }
}

main().catch(console.error);
