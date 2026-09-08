import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { discoverAts } from "../lib/ats-discovery";
import { STRATEGIES, stripHtml } from "../lib/scrape-strategies";
import { getScraper } from "../lib/scrapers/registry";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

interface ScrapingResult {
  company: string;
  provider: string;
  boardUrl: string;
  jobsFound: number;
  status: "Success" | "Zero Jobs" | "Error" | "No Scraper Strategy";
  notes: string;
  sampleJobTitle?: string;
  sampleJobLocation?: string;
}

const IGNORE_LIST = [
  "retired",
  "independent advisory practice",
  "none",
  "n/a",
  "null",
  "student",
  "self employed",
  "freelance",
  "dropout academy",
  "proxnet",
];

async function main() {
  console.log("================================================================================");
  console.log("🌐 PROXNET NETWORK COMPANY SCRAPING TEST");
  console.log("================================================================================\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ Missing Supabase credentials in environment variables.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Fetch all distinct companies from users table
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("company")
    .not("company", "is", null);

  if (userErr) {
    console.error("❌ Failed to query users table:", userErr.message);
    process.exit(1);
  }

  // Deduplicate and filter noise
  const companyMap = new Map<string, string>(); // lower -> cleanOriginal
  (users || []).forEach(u => {
    if (!u.company) return;
    const clean = u.company.trim();
    const lower = clean.toLowerCase();
    if (IGNORE_LIST.includes(lower) || lower.length < 2) return;
    if (!companyMap.has(lower)) {
      companyMap.set(lower, clean);
    }
  });

  const proxnetCompanies = Array.from(companyMap.values());
  console.log(`📋 Discovered ${proxnetCompanies.length} valid ProxNet Network Companies from users table:`);
  proxnetCompanies.forEach((c, idx) => console.log(`   ${idx + 1}. ${c}`));
  console.log("");

  // 2. Fetch existing ATS configs from database
  const { data: existingConfigs } = await supabase
    .from("company_ats_config")
    .select("*");

  const configMap = new Map<string, any>();
  (existingConfigs || []).forEach(cfg => {
    configMap.set(cfg.company_name.toLowerCase().trim(), cfg);
  });

  const results: ScrapingResult[] = [];

  // 3. Iterate through each ProxNet network company and test scraping
  for (let i = 0; i < proxnetCompanies.length; i++) {
    const compName = proxnetCompanies[i];
    const compLower = compName.toLowerCase().trim();
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${proxnetCompanies.length}] 🧪 Testing Scraper for "${compName}"...`);

    let config = configMap.get(compLower);
    let provider = config?.provider;
    let boardUrl = config?.board_token_or_url;

    // If missing ATS config, attempt auto-discovery
    if (!config || !provider || provider === "none") {
      console.log(`  🔍 No existing config. Running ATS auto-discovery for "${compName}"...`);
      const discovered = await discoverAts(compName);
      if (discovered) {
        provider = discovered.provider;
        boardUrl = discovered.board;
        console.log(`  ✅ Discovered ATS: ${provider} | Board: ${boardUrl}`);
      } else {
        provider = "custom";
        boardUrl = `https://careers.google.com/jobs/results/?q=${encodeURIComponent(compName)}`;
        console.log(`  ℹ️ Defaulting fallback custom strategy | URL: ${boardUrl}`);
      }

      // Upsert new config into company_ats_config
      const { data: upserted } = await supabase
        .from("company_ats_config")
        .upsert(
          {
            company_name: compName,
            provider,
            board_token_or_url: boardUrl,
            last_scraped_at: new Date().toISOString(),
            scrape_notes: `Auto-discovered during network test.`,
          },
          { onConflict: "company_name" }
        )
        .select()
        .single();

      config = upserted || { company_name: compName, provider, board_token_or_url: boardUrl };
    } else {
      console.log(`  ℹ️ Existing ATS Config: ${provider} | Board: ${boardUrl}`);
    }

    // Determine scraping strategy
    const strategy = STRATEGIES[provider] || STRATEGIES["custom"];
    let jobs: any[] = [];
    let status: ScrapingResult["status"] = "Success";
    let notes = "OK";

    if (!strategy) {
      status = "No Scraper Strategy";
      notes = `No strategy available for provider: ${provider}`;
      console.log(`  ⚠️ ${notes}`);
    } else {
      try {
        // Run scraper with a 45 second timeout per company
        const scrapePromise = strategy(boardUrl || "", compName);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scrape operation timed out after 45s")), 45000)
        );

        jobs = await Promise.race([scrapePromise, timeoutPromise]);
        console.log(`  🎉 Scraped ${jobs.length} jobs.`);

        if (jobs.length === 0) {
          status = "Zero Jobs";
          notes = "No jobs returned by scraper strategy";
        }
      } catch (e: any) {
        status = "Error";
        notes = e.message ? e.message.replace(/[\r\n]+/g, " ") : "Unknown error";
        console.error(`  ❌ Scraper failed for "${compName}": ${notes}`);
      }
    }

    // Update config metadata in database
    await supabase
      .from("company_ats_config")
      .upsert(
        {
          company_name: compName,
          provider: provider || "custom",
          board_token_or_url: boardUrl || "",
          total_jobs_found: jobs.length,
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Test status: ${status}. Found ${jobs.length} jobs. ${notes}`,
        },
        { onConflict: "company_name" }
      );

    const sampleJob = jobs[0];
    results.push({
      company: compName,
      provider: provider || "unknown",
      boardUrl: boardUrl || "N/A",
      jobsFound: jobs.length,
      status,
      notes,
      sampleJobTitle: sampleJob?.title,
      sampleJobLocation: sampleJob?.location,
    });
  }

  // 4. Generate markdown report
  let report = `# ProxNet Network Companies Scraping Test Report\n\n`;
  report += `**Test Executed:** ${new Date().toISOString()}\n`;
  report += `**Total ProxNet Companies Tested:** ${results.length}\n\n`;

  const totalSuccessful = results.filter(r => r.status === "Success").length;
  const totalZero = results.filter(r => r.status === "Zero Jobs").length;
  const totalErrors = results.filter(r => r.status === "Error").length;
  const totalJobs = results.reduce((sum, r) => sum + r.jobsFound, 0);

  report += `### Summary\n`;
  report += `- **Companies with Jobs Found:** ${totalSuccessful}\n`;
  report += `- **Companies with Zero Jobs:** ${totalZero}\n`;
  report += `- **Companies with Errors:** ${totalErrors}\n`;
  report += `- **Total Raw Jobs Scraped Across Network:** ${totalJobs}\n\n`;

  report += `### Detailed Results Table\n\n`;
  report += `| # | Company Name | ATS Provider | Board Token / URL | Jobs Found | Status | Sample Job Title | Notes |\n`;
  report += `|---|---|---|---|---|---|---|---|\n`;

  results.forEach((r, idx) => {
    const sampleStr = r.sampleJobTitle ? `"${r.sampleJobTitle}" (${r.sampleJobLocation || "Remote"})` : "—";
    report += `| ${idx + 1} | ${r.company} | ${r.provider} | ${r.boardUrl} | ${r.jobsFound} | ${r.status} | ${sampleStr} | ${r.notes} |\n`;
  });

  fs.writeFileSync("scraping_test_results.md", report);
  console.log("\n================================================================================");
  console.log("📄 Wrote detailed test report to scraping_test_results.md");
  console.log("================================================================================\n");

  console.log(`📊 TEST RESULTS SUMMARY:`);
  console.log(`  - Total Network Companies: ${results.length}`);
  console.log(`  - Companies returning jobs: ${totalSuccessful}`);
  console.log(`  - Companies returning 0 jobs: ${totalZero}`);
  console.log(`  - Companies throwing errors: ${totalErrors}`);
  console.log(`  - Total Jobs Scraped: ${totalJobs}\n`);
}

main();
