import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import { STRATEGIES } from "../lib/scrape-strategies";
import { discoverAts } from "../lib/ats-discovery";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CompanyTarget {
  name: string;
  provider: string;
  boardTokenOrUrl: string;
  source: string;
}

export interface ScrapeResult {
  company: string;
  provider: string;
  boardTokenOrUrl: string;
  status: "SUCCESS" | "ZERO_JOBS" | "ERROR" | "NO_ATS";
  jobsCount: number;
  sampleJobTitle?: string;
  sampleJobLocation?: string;
  sampleJobUrl?: string;
  error?: string;
  durationMs: number;
}

async function scrapeWithTimeout(
  strategy: (token: string, name: string) => Promise<any[]>,
  token: string,
  name: string,
  timeoutMs = 45000
): Promise<any[]> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
  );
  return Promise.race([strategy(token, name), timeoutPromise]);
}

async function runWorkerPool<T, R>(
  items: T[],
  concurrency: number,
  workerFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await workerFn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  console.log("================================================================================");
  console.log("PROXNET 1-JOB SCRAPER VALIDATION ACROSS ALL COMPANIES");
  console.log("================================================================================\n");

  // 1. Fetch configs from company_ats_config
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status");

  // 2. Fetch user target companies
  const { data: userTargets } = await supabase
    .from("user_target_companies")
    .select("*");

  // 3. Fetch user companies
  const { data: users } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const invalidStrings = ["retired", "student", "freelance", "self-employed", "n/a", "none", "independent advisory", "cron_status"];

  const targetsMap = new Map<string, CompanyTarget>();

  for (const c of configs || []) {
    if (invalidStrings.some(inv => c.company_name.toLowerCase().includes(inv))) continue;
    const key = c.company_name.toLowerCase().trim();
    if (!targetsMap.has(key)) {
      targetsMap.set(key, {
        name: c.company_name,
        provider: c.provider,
        boardTokenOrUrl: c.board_token_or_url || "",
        source: "company_ats_config",
      });
    }
  }

  for (const t of userTargets || []) {
    const key = t.company_name.toLowerCase().trim();
    if (!targetsMap.has(key)) {
      targetsMap.set(key, {
        name: t.company_name,
        provider: t.ats_provider || "custom",
        boardTokenOrUrl: t.ats_board_token || t.careers_url || "",
        source: "user_target_companies",
      });
    }
  }

  for (const u of users || []) {
    const raw = u.company?.trim();
    if (!raw || invalidStrings.some(inv => raw.toLowerCase().includes(inv))) continue;
    const key = raw.toLowerCase().trim();
    if (!targetsMap.has(key)) {
      targetsMap.set(key, {
        name: raw,
        provider: "unconfigured",
        boardTokenOrUrl: "",
        source: "user_profile",
      });
    }
  }

  const allTargets = Array.from(targetsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Total Unique Companies Identified: ${allTargets.length}\n`);

  // Split into Native ATS/Probing vs Custom (Firecrawl)
  const nativeProviders = ["greenhouse", "lever", "ashby", "smartrecruiters", "amazon", "oracle", "successfactors_sitemap", "workday", "ibm", "unconfigured"];
  
  const groupA = allTargets.filter(t => nativeProviders.includes(t.provider) && !t.boardTokenOrUrl.includes("careers.google.com"));
  const groupB = allTargets.filter(t => !groupA.includes(t));

  console.log(`Group A (Native ATS APIs / Discovery): ${groupA.length} companies`);
  console.log(`Group B (Custom / Firecrawl Scraping): ${groupB.length} companies\n`);

  const results: ScrapeResult[] = [];

  const testCompany = async (target: CompanyTarget, label: string): Promise<ScrapeResult> => {
    const start = Date.now();
    let provider = target.provider;
    let boardTokenOrUrl = target.boardTokenOrUrl;

    if (provider === "unconfigured") {
      const discovered = await discoverAts(target.name);
      if (discovered) {
        provider = discovered.provider;
        boardTokenOrUrl = discovered.board;
        console.log(`  [${label}] ${target.name}: Auto-discovered -> ${provider} (${boardTokenOrUrl})`);
      } else {
        const res: ScrapeResult = {
          company: target.name,
          provider: "none",
          boardTokenOrUrl: "",
          status: "NO_ATS",
          jobsCount: 0,
          error: "No ATS or careers URL configured or auto-detected",
          durationMs: Date.now() - start,
        };
        console.log(`  [${label}] ${target.name}: NO ATS DETECTED`);
        return res;
      }
    }

    const strategy = STRATEGIES[provider];
    if (!strategy) {
      const res: ScrapeResult = {
        company: target.name,
        provider,
        boardTokenOrUrl,
        status: "ERROR",
        jobsCount: 0,
        error: `No scraper strategy found for provider: ${provider}`,
        durationMs: Date.now() - start,
      };
      console.log(`  [${label}] ${target.name}: ERROR - No strategy for ${provider}`);
      return res;
    }

    try {
      const timeoutMs = (provider === "custom" || provider === "workday") ? 45000 : 20000;
      const rawJobs = await scrapeWithTimeout(strategy, boardTokenOrUrl, target.name, timeoutMs);
      const jobsCount = rawJobs?.length || 0;

      if (jobsCount > 0) {
        const sample = rawJobs[0];
        const res: ScrapeResult = {
          company: target.name,
          provider,
          boardTokenOrUrl,
          status: "SUCCESS",
          jobsCount,
          sampleJobTitle: sample.title || "Untitled",
          sampleJobLocation: sample.location || "N/A",
          sampleJobUrl: sample.url || boardTokenOrUrl,
          durationMs: Date.now() - start,
        };
        console.log(`  [${label}] ${target.name} (${provider}): SUCCESS -> 1 job: "${sample.title}" in ${sample.location}`);
        return res;
      } else {
        const res: ScrapeResult = {
          company: target.name,
          provider,
          boardTokenOrUrl,
          status: "ZERO_JOBS",
          jobsCount: 0,
          error: "Scraper ran successfully but returned 0 job postings",
          durationMs: Date.now() - start,
        };
        console.log(`  [${label}] ${target.name} (${provider}): ZERO JOBS`);
        return res;
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      const res: ScrapeResult = {
        company: target.name,
        provider,
        boardTokenOrUrl,
        status: "ERROR",
        jobsCount: 0,
        error: msg.length > 150 ? msg.slice(0, 147) + "..." : msg,
        durationMs: Date.now() - start,
      };
      console.log(`  [${label}] ${target.name} (${provider}): ERROR -> ${msg.slice(0, 80)}`);
      return res;
    }
  };

  // Run Group A with concurrency 4
  console.log("--- RUNNING GROUP A: NATIVE ATS & DISCOVERY ---");
  const resA = await runWorkerPool(groupA, 4, async (target, idx) => {
    return testCompany(target, `A:${idx + 1}/${groupA.length}`);
  });
  results.push(...resA);

  // Run Group B with concurrency 2 (to respect Firecrawl rate limits)
  console.log("\n--- RUNNING GROUP B: CUSTOM & FIRECRAWL STRATEGIES ---");
  const resB = await runWorkerPool(groupB, 2, async (target, idx) => {
    const res = await testCompany(target, `B:${idx + 1}/${groupB.length}`);
    await new Promise(r => setTimeout(r, 1000));
    return res;
  });
  results.push(...resB);

  // Write results
  fs.writeFileSync("scrape_validation_report.json", JSON.stringify(results, null, 2));

  // Summary statistics
  const success = results.filter(r => r.status === "SUCCESS");
  const zero = results.filter(r => r.status === "ZERO_JOBS");
  const error = results.filter(r => r.status === "ERROR");
  const noAts = results.filter(r => r.status === "NO_ATS");

  console.log("\n================================================================================");
  console.log("VALIDATION SUMMARY:");
  console.log(`Total Companies: ${results.length}`);
  console.log(`SUCCESS (>= 1 job): ${success.length} (${Math.round((success.length / results.length) * 100)}%)`);
  console.log(`ZERO JOBS: ${zero.length}`);
  console.log(`ERROR: ${error.length}`);
  console.log(`NO ATS / UNCONFIGURED: ${noAts.length}`);
  console.log("================================================================================");
}

main().catch(console.error);
