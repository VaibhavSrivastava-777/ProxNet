import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { STRATEGIES } from "../lib/scrape-strategies";
import { isJobEligible } from "../lib/jobs/job-filters";

async function validateLiveScrapers() {
  console.log("================================================================================");
  console.log("🧪 LIVE SCRAPER VALIDATION ACROSS PROVIDERS");
  console.log("================================================================================\n");

  const supabase = createAdminClient();

  // Test targets across each active ATS provider in ProxNet
  const targets = [
    { company: "Applause", provider: "ashby", fallbackToken: "applause" },
    { company: "Paytm", provider: "lever", fallbackToken: "paytm" },
    { company: "Coursera", provider: "greenhouse", fallbackToken: "coursera" },
    { company: "Five9", provider: "greenhouse", fallbackToken: "five9" },
    { company: "ServiceNow", provider: "smartrecruiters", fallbackToken: "ServiceNow" },
    { company: "Kotak Mahindra Bank", provider: "oracle", fallbackToken: "https://ejim.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1" },
    { company: "Verint systems Pvt Ltd", provider: "oracle", fallbackToken: "https://verint.taleo.net/careersection/2/jobsearch.ftl" },
    { company: "Microsoft", provider: "custom", fallbackToken: "https://careers.microsoft.com" },
    { company: "Google", provider: "custom", fallbackToken: "https://www.google.com/about/careers/applications/jobs/results" },
    { company: "Amazon", provider: "amazon", fallbackToken: "amazon" },
  ];

  const results: Array<{
    company: string;
    provider: string;
    jobsFetched: number;
    eligibleCount: number;
    sampleRole?: string;
    status: "PASS" | "WARN" | "FAIL";
    timeMs: number;
    error?: string;
  }> = [];

  for (const t of targets) {
    // Check DB for existing token
    const { data: cfg } = await supabase
      .from("company_ats_config")
      .select("provider, board_token_or_url")
      .ilike("company_name", `%${t.company}%`)
      .limit(1)
      .maybeSingle();

    const provider = cfg?.provider || t.provider;
    const token = cfg?.board_token_or_url || t.fallbackToken;
    const strategy = STRATEGIES[provider];

    if (!strategy) {
      results.push({
        company: t.company,
        provider,
        jobsFetched: 0,
        eligibleCount: 0,
        status: "FAIL",
        timeMs: 0,
        error: `No scraper strategy found for provider '${provider}'`,
      });
      continue;
    }

    process.stdout.write(`Testing [${provider.toUpperCase()}] ${t.company.padEnd(25)} ... `);
    const start = Date.now();

    try {
      const jobs = await strategy(token, t.company);
      const timeMs = Date.now() - start;

      const eligible = (jobs || []).filter((j: any) => {
        const { eligible } = isJobEligible({
          title: j.title,
          location: j.location,
          description: j.description,
          posted_at: j.posted_at,
        });
        return eligible;
      });

      const sampleRole = jobs?.[0]?.title ? String(jobs[0].title).slice(0, 45) : undefined;
      const status = jobs.length > 0 ? "PASS" : "WARN";

      console.log(`✅ ${status} (${jobs.length} jobs, ${eligible.length} eligible, ${timeMs}ms)`);
      if (sampleRole) {
        console.log(`   Sample: "${sampleRole}" in ${jobs[0].location || "N/A"}`);
      }

      results.push({
        company: t.company,
        provider,
        jobsFetched: jobs.length,
        eligibleCount: eligible.length,
        sampleRole,
        status,
        timeMs,
      });
    } catch (err: any) {
      const timeMs = Date.now() - start;
      console.log(`❌ FAIL (${timeMs}ms) - ${err.message}`);
      results.push({
        company: t.company,
        provider,
        jobsFetched: 0,
        eligibleCount: 0,
        status: "FAIL",
        timeMs,
        error: err.message,
      });
    }
  }

  console.log("\n================================================================================");
  console.log("📋 LIVE SCRAPER TEST SCORECARD");
  console.log("================================================================================\n");

  for (const r of results) {
    const icon = r.status === "PASS" ? "🟢" : r.status === "WARN" ? "🟡" : "🔴";
    console.log(
      `${icon} ${r.company.padEnd(25)} | Provider: ${r.provider.padEnd(15)} | Fetched: ${String(r.jobsFetched).padStart(3)} | Eligible: ${String(r.eligibleCount).padStart(3)} | ${r.timeMs}ms`
    );
    if (r.error) {
      console.log(`   └─ Error: ${r.error}`);
    }
  }

  const passCount = results.filter(r => r.status === "PASS").length;
  console.log("\n================================================================================");
  console.log(`Summary: ${passCount}/${results.length} Scraper targets functional.`);
  console.log("================================================================================\n");
}

validateLiveScrapers();
