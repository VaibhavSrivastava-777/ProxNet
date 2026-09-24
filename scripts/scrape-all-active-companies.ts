import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { STRATEGIES } from "../lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "../lib/jobs/job-filters";
import { normalizeCompanyName } from "../lib/competitors/discover-competitors";

async function scrapeAll() {
  console.log("================================================================================");
  console.log("🚀 COMPREHENSIVE SCRAPE FOR ALL CONFIGURED COMPANIES (PROXNET + COMPETITORS)");
  console.log("================================================================================\n");

  const supabase = createAdminClient();

  // 1. Fetch all valid scrape targets
  const { data: allConfigs, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .not("provider", "in", '("none","error","cron_status")')
    .not("board_token_or_url", "is", null);

  if (error || !allConfigs) {
    console.error("Failed to query configs:", error?.message);
    return;
  }

  // Fetch member companies to classify Pioneer vs Referral Ready
  const { data: usersData } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const memberCompanySet = new Set(
    (usersData || []).map(u => normalizeCompanyName(u.company || "")).filter(Boolean)
  );

  // Group into High-Priority Direct API Providers (Greenhouse, Lever, Ashby, SmartRecruiters, Oracle, Amazon, IBM) and Custom
  const apiProviders = new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "oracle", "amazon", "ibm"]);
  const apiConfigs = allConfigs.filter(c => apiProviders.has(c.provider.toLowerCase()));
  const customConfigs = allConfigs.filter(c => !apiProviders.has(c.provider.toLowerCase()));

  console.log(`Total Target Companies to Scrape: ${allConfigs.length}`);
  console.log(`  ⚡ High-Yield API Companies (Greenhouse/Lever/Ashby/SmartRecruiters/Oracle/Amazon): ${apiConfigs.length}`);
  console.log(`  🌐 Custom Web Portals: ${customConfigs.length}\n`);

  let totalScrapedAcrossAll = 0;
  let totalEligibleSavedAcrossAll = 0;
  const companyResults: Array<{
    company: string;
    provider: string;
    jobsFetched: number;
    eligibleSaved: number;
    isMemberCompany: boolean;
    status: string;
  }> = [];

  // Scrape all API configs first with concurrency (5 at a time)
  console.log("--------------------------------------------------------------------------------");
  console.log("⚡ PHASE 1: SCRAPING HIGH-YIELD DIRECT API PROVIDERS");
  console.log("--------------------------------------------------------------------------------");

  async function scrapeOne(cfg: any) {
    const strategy = STRATEGIES[cfg.provider.toLowerCase()];
    if (!strategy) {
      companyResults.push({
        company: cfg.company_name,
        provider: cfg.provider,
        jobsFetched: 0,
        eligibleSaved: 0,
        isMemberCompany: memberCompanySet.has(normalizeCompanyName(cfg.company_name)),
        status: `No strategy for ${cfg.provider}`,
      });
      return;
    }

    const isMember = memberCompanySet.has(normalizeCompanyName(cfg.company_name));
    try {
      const jobs = await strategy(cfg.board_token_or_url, cfg.company_name);
      const jobsCount = jobs?.length || 0;
      totalScrapedAcrossAll += jobsCount;

      let eligibleSaved = 0;
      if (jobsCount > 0) {
        const eligible = jobs.filter((j: any) => {
          const { eligible } = isJobEligible({
            title: j.title,
            location: j.location,
            description: j.description,
            posted_at: j.posted_at,
          });
          return eligible;
        });

        const toSave = eligible.slice(0, 20).map((j: any) => ({
          company: cfg.company_name,
          title: normalizeJobTitle(j.title),
          location: j.location || "India / Remote",
          url: normalizeJobUrl(j.url),
          description: (j.description || j.title).slice(0, 2000),
          posted_at: j.posted_at || new Date().toISOString(),
          keywords: isMember ? ["ProxNet Network Job", "Referral Eligible"] : ["Competitor Opportunity", "Pioneer Role"],
        }));

        for (const item of toSave) {
          const { error: upsertErr } = await supabase
            .from("scraped_jobs")
            .upsert(item, { onConflict: "url" });
          if (!upsertErr) {
            eligibleSaved++;
            totalEligibleSavedAcrossAll++;
          }
        }

        // Update company_ats_config
        await supabase
          .from("company_ats_config")
          .update({
            total_jobs_found: jobsCount,
            last_scraped_at: new Date().toISOString(),
            scrape_notes: `Scraped ${jobsCount} total, saved ${eligibleSaved} eligible.`,
          })
          .eq("id", cfg.id);
      } else {
        await supabase
          .from("company_ats_config")
          .update({
            last_scraped_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
      }

      companyResults.push({
        company: cfg.company_name,
        provider: cfg.provider,
        jobsFetched: jobsCount,
        eligibleSaved,
        isMemberCompany: isMember,
        status: jobsCount > 0 ? "SUCCESS" : "0_JOBS",
      });

      console.log(`  [${cfg.provider.toUpperCase()}] ${cfg.company_name}: ${jobsCount} fetched -> ${eligibleSaved} eligible saved`);
    } catch (err: any) {
      companyResults.push({
        company: cfg.company_name,
        provider: cfg.provider,
        jobsFetched: 0,
        eligibleSaved: 0,
        isMemberCompany: isMember,
        status: `ERROR: ${err.message}`,
      });
      console.warn(`  ⚠️ Error scraping ${cfg.company_name} (${cfg.provider}): ${err.message}`);
    }
  }

  // Process in chunks of 5
  const API_CONCURRENCY = 5;
  for (let i = 0; i < apiConfigs.length; i += API_CONCURRENCY) {
    const chunk = apiConfigs.slice(i, i + API_CONCURRENCY);
    await Promise.all(chunk.map(c => scrapeOne(c)));
  }

  // Also scrape top custom configs that have valid URLs
  console.log("\n--------------------------------------------------------------------------------");
  console.log("🌐 PHASE 2: SCRAPING TOP CUSTOM WEB PORTALS");
  console.log("--------------------------------------------------------------------------------");

  const validCustom = customConfigs.filter(c => c.board_token_or_url?.startsWith("http"));
  const CUSTOM_LIMIT = 20;
  for (const c of validCustom.slice(0, CUSTOM_LIMIT)) {
    await scrapeOne(c);
  }

  console.log("\n================================================================================");
  console.log("🏆 FINAL AUDIT REPORT: PROXNET + COMPETITORS SCRAPE");
  console.log("================================================================================\n");

  const successfulCompanies = companyResults.filter(r => r.jobsFetched > 0);
  const pioneerCompanies = successfulCompanies.filter(r => !r.isMemberCompany);
  const memberCompaniesWithJobs = successfulCompanies.filter(r => r.isMemberCompany);

  console.log(`Companies Successfully Scraped With Jobs: ${successfulCompanies.length}`);
  console.log(`  🤝 ProxNet Member Companies (Referrals Ready): ${memberCompaniesWithJobs.length}`);
  console.log(`  🏆 Competitor Companies (Pioneer Bounty +10 pts): ${pioneerCompanies.length}\n`);

  console.log("Top Competitor Companies with Pioneer Bounties:");
  for (const p of pioneerCompanies.slice(0, 25)) {
    console.log(`  🏆 ${p.company} [${p.provider}]: ${p.jobsFetched} fetched, ${p.eligibleSaved} eligible (PIONEER +10 PTS)`);
  }

  const { count: finalTotalJobs } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  console.log(`\nTotal Scraped Jobs Fetched Across Run: ${totalScrapedAcrossAll}`);
  console.log(`Total Eligible Jobs Saved in this run: ${totalEligibleSavedAcrossAll}`);
  console.log(`Total Live Jobs in Database: ${finalTotalJobs}`);
  console.log("================================================================================\n");
}

scrapeAll().catch(console.error);
