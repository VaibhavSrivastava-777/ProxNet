import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { getScraper } from "../lib/scrapers/registry";

dotenv.config({ path: ".env.local" });

// Helper to run code with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errMsg)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Get unique companies from users table
  const { data: users, error: usersError } = await supabase.from("users").select("company");
  if (usersError) {
    console.error("Failed to fetch users:", usersError.message);
    process.exit(1);
  }

  const proxNetCompanies = Array.from(new Set(users.map((u: any) => {
    if (!u.company) return "";
    const clean = u.company.trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }).filter(Boolean)));

  console.log(`Found ${proxNetCompanies.length} unique ProxNet companies in users table.\n`);

  // 2. Fetch configurations for all these companies
  const { data: configs, error: configsError } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status");

  if (configsError) {
    console.error("Failed to fetch configs:", configsError.message);
    process.exit(1);
  }

  const configMap = new Map<string, any>();
  configs.forEach(c => {
    configMap.set(c.company_name.toLowerCase().trim(), c);
  });

  const results: Array<{
    company: string;
    hasConfig: boolean;
    provider?: string;
    status: "SUCCESS" | "FAILED" | "NO_CONFIG" | "NO_SCRAPER";
    jobsFound?: number;
    error?: string;
    sampleJobs?: string[];
  }> = [];

  for (const company of proxNetCompanies) {
    const cleanName = company.toLowerCase().trim();
    const config = configMap.get(cleanName);

    if (!config) {
      results.push({
        company,
        hasConfig: false,
        status: "NO_CONFIG"
      });
      continue;
    }

    const scraper = getScraper(company, config);
    if (!scraper) {
      results.push({
        company,
        hasConfig: true,
        provider: config.provider,
        status: "NO_SCRAPER",
        error: "No scraper strategy found or registered for this provider/company"
      });
      continue;
    }

    console.log(`Testing scraper for "${company}" (Provider: ${config.provider}, URL/Token: ${config.board_token_or_url})...`);
    
    try {
      // Run the scraper with limit 2, and a timeout of 45 seconds to be safe
      const jobs = await withTimeout(
        scraper.scrape(2),
        90000,
        "Scraping timed out after 90 seconds"
      );

      results.push({
        company,
        hasConfig: true,
        provider: config.provider,
        status: "SUCCESS",
        jobsFound: jobs.length,
        sampleJobs: jobs.map(j => j.title)
      });
      console.log(`  ✅ Success: found ${jobs.length} jobs.`);
    } catch (e: any) {
      console.error(`  ❌ Failed: ${e.message || e}`);
      results.push({
        company,
        hasConfig: true,
        provider: config.provider,
        status: "FAILED",
        error: e.message || String(e)
      });
    }
  }

  console.log("\n================ TEST SUMMARY =================\n");
  
  console.log("WORKING SCRAPERS:");
  results.filter(r => r.status === "SUCCESS").forEach(r => {
    console.log(`- ✅ ${r.company} (${r.provider}): ${r.jobsFound} jobs found (Samples: ${JSON.stringify(r.sampleJobs)})`);
  });

  console.log("\nFAILED SCRAPERS:");
  results.filter(r => r.status === "FAILED").forEach(r => {
    console.log(`- ❌ ${r.company} (${r.provider}): ${r.error}`);
  });

  console.log("\nNO ATS CONFIGURATION IN DB:");
  results.filter(r => r.status === "NO_CONFIG").forEach(r => {
    console.log(`- ⚠️ ${r.company}`);
  });

  console.log("\nNO STRATEGY REGISTERED:");
  results.filter(r => r.status === "NO_SCRAPER").forEach(r => {
    console.log(`- 🛑 ${r.company} (${r.provider}): ${r.error}`);
  });
}

main();
