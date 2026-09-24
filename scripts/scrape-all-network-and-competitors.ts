import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import {
  getNetworkCompanies,
  discoverCompetitorsForCompany,
  normalizeCompanyName,
  extractAtsFromUrl,
} from "../lib/competitors/discover-competitors";
import { STRATEGIES } from "../lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "../lib/jobs/job-filters";
import { discoverAts } from "../lib/ats-discovery";

async function main() {
  console.log("================================================================================");
  console.log("🌐 PROXNET FULL PIPELINE: ALL COMPANIES + COMPETITORS DISCOVERY & SCRAPE");
  console.log("================================================================================\n");

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  // ── STEP 1: FETCH ALL PROXNET NETWORK COMPANIES ─────────────────────────────
  const allNetworkCompanies = await getNetworkCompanies(supabase);
  console.log(`[Step 1] Identified ${allNetworkCompanies.length} enterprise network companies in ProxNet.`);

  // Check existing mapped competitors in DB to avoid redundant LLM calls
  const { data: existingCompetitorRows } = await supabase
    .from("company_competitors")
    .select("company_name, competitor_name");

  const existingCompanyMap = new Map<string, Set<string>>();
  for (const row of existingCompetitorRows || []) {
    const pKey = normalizeCompanyName(row.company_name);
    if (!existingCompanyMap.has(pKey)) {
      existingCompanyMap.set(pKey, new Set());
    }
    existingCompanyMap.get(pKey)!.add(normalizeCompanyName(row.competitor_name));
  }

  console.log(`Found ${existingCompetitorRows?.length || 0} competitor relationships already persisted.\n`);

  // ── STEP 2: LOOP THROUGH ALL PROXNET COMPANIES WITH GENAI ───────────────────
  console.log("--------------------------------------------------------------------------------");
  console.log("🔍 DISCOVERING COMPETITORS & CAREER PORTALS (GENAI / CLAUDE / OPENAI)");
  console.log("--------------------------------------------------------------------------------");

  let newlyDiscoveredCount = 0;
  const competitorInsertBuffer: Array<{
    company_name: string;
    competitor_name: string;
    industry?: string | null;
    discovery_source: string;
    is_active: boolean;
    updated_at: string;
  }> = [];

  const atsConfigsToUpsert = new Map<string, {
    company_name: string;
    provider: string;
    board_token_or_url: string;
    scrape_notes: string;
  }>();

  for (let i = 0; i < allNetworkCompanies.length; i++) {
    const company = allNetworkCompanies[i];
    const normKey = normalizeCompanyName(company);
    const existingSet = existingCompanyMap.get(normKey);

    // If company already has at least 3 competitors, skip LLM call to save quota & time
    if (existingSet && existingSet.size >= 3) {
      console.log(`[${i + 1}/${allNetworkCompanies.length}] "${company}" already has ${existingSet.size} competitors mapped. Skipping LLM.`);
      continue;
    }

    console.log(`[${i + 1}/${allNetworkCompanies.length}] 🤖 Querying GenAI for "${company}" competitors & career portal links...`);
    try {
      const result = await discoverCompetitorsForCompany(company, openaiKey);
      console.log(`   Discovered ${result.competitors.length} competitors for "${company}":`);

      for (const comp of result.competitors) {
        console.log(`     • ${comp.name} [${comp.provider || "custom"}] -> ${comp.careers_url || comp.boardTokenOrUrl || "N/A"}`);
        competitorInsertBuffer.push({
          company_name: company,
          competitor_name: comp.name,
          industry: comp.industry || null,
          discovery_source: comp.source,
          is_active: true,
          updated_at: new Date().toISOString(),
        });

        const compKey = normalizeCompanyName(comp.name);
        const atsProvider = comp.provider || "custom";
        const atsBoardOrUrl = comp.boardTokenOrUrl || comp.careers_url || "";

        if (atsBoardOrUrl && !atsConfigsToUpsert.has(compKey)) {
          atsConfigsToUpsert.set(compKey, {
            company_name: comp.name,
            provider: atsProvider,
            board_token_or_url: atsBoardOrUrl,
            scrape_notes: `Discovered as competitor of ${company} via GenAI (${comp.source})`,
          });
        }
        newlyDiscoveredCount++;
      }
    } catch (llmErr: any) {
      console.warn(`   ⚠️ Warning querying GenAI for "${company}":`, llmErr.message);
    }
  }

  // Batch insert competitor relationships
  if (competitorInsertBuffer.length > 0) {
    console.log(`\nPersisting ${competitorInsertBuffer.length} new competitor relationships...`);
    const CHUNK = 50;
    for (let c = 0; c < competitorInsertBuffer.length; c += CHUNK) {
      const chunk = competitorInsertBuffer.slice(c, c + CHUNK);
      await supabase
        .from("company_competitors")
        .upsert(chunk, { onConflict: "company_name,competitor_name" });
    }
  }

  // Also ensure every ProxNet company itself has a company_ats_config entry
  console.log("\nEnsuring all ProxNet network companies have ATS configurations...");
  for (const company of allNetworkCompanies) {
    const compKey = normalizeCompanyName(company);
    const { data: existingAts } = await supabase
      .from("company_ats_config")
      .select("id, provider, board_token_or_url")
      .ilike("company_name", company)
      .maybeSingle();

    if (!existingAts || existingAts.provider === "none") {
      const discovered = await discoverAts(company);
      if (discovered && discovered.provider && discovered.provider !== "none") {
        if (!existingAts) {
          await supabase.from("company_ats_config").insert({
            company_name: company,
            provider: discovered.provider,
            board_token_or_url: discovered.board,
            total_jobs_found: 0,
            scrape_notes: "Auto-discovered for ProxNet member company",
          });
        } else {
          await supabase
            .from("company_ats_config")
            .update({
              provider: discovered.provider,
              board_token_or_url: discovered.board,
              scrape_notes: "Auto-discovered for ProxNet member company",
            })
            .eq("id", existingAts.id);
        }
      }
    }
  }

  // Upsert new competitor ATS configurations
  for (const [_, ats] of atsConfigsToUpsert.entries()) {
    try {
      const { data: existing } = await supabase
        .from("company_ats_config")
        .select("id, provider, board_token_or_url")
        .ilike("company_name", ats.company_name)
        .maybeSingle();

      if (!existing) {
        await supabase.from("company_ats_config").insert({
          company_name: ats.company_name,
          provider: ats.provider,
          board_token_or_url: ats.board_token_or_url,
          scrape_notes: ats.scrape_notes,
          total_jobs_found: 0,
        });
      } else if (existing.provider === "none" || !existing.board_token_or_url) {
        await supabase
          .from("company_ats_config")
          .update({
            provider: ats.provider,
            board_token_or_url: ats.board_token_or_url,
            scrape_notes: ats.scrape_notes,
          })
          .eq("id", existing.id);
      }
    } catch {}
  }

  const { count: totalCompetitorsCount } = await supabase
    .from("company_competitors")
    .select("*", { count: "exact", head: true });

  console.log(`\n✅ Competitor Discovery Phase Complete! Total competitor relationships in database: ${totalCompetitorsCount}`);

  // ── STEP 3: SCRAPE FOR ALL COMPANIES (PROXNET + COMPETITORS) ───────────────
  console.log("\n================================================================================");
  console.log("⚡ SCRAPING FOR ALL COMPANIES (PROXNET NETWORK + COMPETITORS)");
  console.log("================================================================================\n");

  const { data: allScrapeConfigs, error: atsFetchErr } = await supabase
    .from("company_ats_config")
    .select("*")
    .not("provider", "in", '("none","error")');

  if (atsFetchErr || !allScrapeConfigs) {
    console.error("Failed to query company_ats_config:", atsFetchErr?.message);
    process.exit(1);
  }

  // Separate API-based scrapers (Lever, Greenhouse, Ashby, Workday, Oracle, Amazon, IBM) from custom crawlers
  const apiProviders = new Set(["lever", "greenhouse", "ashby", "workday", "oracle", "amazon", "ibm"]);
  const fastConfigs = allScrapeConfigs.filter((c) => apiProviders.has(c.provider.toLowerCase()));
  const customConfigs = allScrapeConfigs.filter((c) => !apiProviders.has(c.provider.toLowerCase()));

  console.log(`Found ${allScrapeConfigs.length} total scrapeable companies in database:`);
  console.log(`  - ⚡ API Scrapers (Greenhouse, Lever, Ashby, Workday, Oracle, Amazon, IBM): ${fastConfigs.length}`);
  console.log(`  - 🌐 Custom Web Crawlers: ${customConfigs.length}`);
  console.log("\nBeginning scrape execution...\n");

  // Fetch all user companies to identify member vs non-member (Pioneer) status
  const { data: usersData } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const memberCompanies = new Set(
    (usersData || [])
      .map((u) => normalizeCompanyName(u.company || ""))
      .filter(Boolean)
  );

  let totalScrapedJobs = 0;
  let totalEligibleSaved = 0;
  const companiesWithOpenings = new Map<string, { total: number; eligible: number; isMemberCompany: boolean }>();

  // Prioritize fast API scrapers first (these return live jobs with 100% reliability)
  const scrapeList = [...fastConfigs, ...customConfigs.slice(0, 15)]; // scrape all fast + top 15 custom

  for (let idx = 0; idx < scrapeList.length; idx++) {
    const cfg = scrapeList[idx];
    const strategy = STRATEGIES[cfg.provider];
    if (!strategy) continue;

    const normKey = normalizeCompanyName(cfg.company_name);
    const isMember = memberCompanies.has(normKey);

    console.log(`[${idx + 1}/${scrapeList.length}] Scraping "${cfg.company_name}" (${cfg.provider}) [${isMember ? "ProxNet Member" : "Competitor"}]...`);

    try {
      const jobs = await strategy(cfg.board_token_or_url, cfg.company_name);
      console.log(`   Fetched ${jobs.length} postings.`);

      if (jobs && jobs.length > 0) {
        totalScrapedJobs += jobs.length;

        // Filter for India / Remote, seniority, and freshness
        const eligible = jobs.filter((j) => {
          const { eligible } = isJobEligible({
            title: j.title,
            location: j.location,
            description: j.description,
            posted_at: j.posted_at,
          });
          return eligible;
        });

        console.log(`   ${eligible.length} matched eligibility criteria.`);

        // Save top eligible jobs (up to 15 per company) into scraped_jobs
        const toSave = eligible.slice(0, 15).map((j) => ({
          company: cfg.company_name,
          title: normalizeJobTitle(j.title),
          location: j.location || "India / Remote",
          url: normalizeJobUrl(j.url),
          description: (j.description || j.title).slice(0, 2000),
          posted_at: j.posted_at || new Date().toISOString(),
          keywords: isMember ? ["ProxNet Network Job", "Referral Eligible"] : ["Competitor Opportunity", "Pioneer Role"],
        }));

        let savedForThis = 0;
        for (const job of toSave) {
          const { error: upsertErr } = await supabase
            .from("scraped_jobs")
            .upsert(job, { onConflict: "url" });
          if (!upsertErr) {
            savedForThis++;
            totalEligibleSaved++;
          }
        }

        companiesWithOpenings.set(cfg.company_name, {
          total: jobs.length,
          eligible: eligible.length,
          isMemberCompany: isMember,
        });

        // Update company_ats_config
        await supabase
          .from("company_ats_config")
          .update({
            total_jobs_found: jobs.length,
            last_scraped_at: new Date().toISOString(),
            scrape_notes: `Scraped ${jobs.length} total, saved ${savedForThis} eligible.`,
          })
          .eq("id", cfg.id);
      }
    } catch (err: any) {
      console.warn(`   ⚠️ Scrape warning for ${cfg.company_name}:`, err.message);
    }
  }

  // ── STEP 4: PIONEER BOUNTY & SUMMARY AUDIT ──────────────────────────────────
  console.log("\n================================================================================");
  console.log("🏆 AUDIT & PIONEER BOUNTY REPORT");
  console.log("================================================================================\n");

  const pioneerCompanies: Array<{ name: string; jobsFound: number; eligibleSaved: number }> = [];
  const memberOpenings: Array<{ name: string; jobsFound: number; eligibleSaved: number }> = [];

  for (const [comp, info] of companiesWithOpenings.entries()) {
    if (!info.isMemberCompany) {
      pioneerCompanies.push({ name: comp, jobsFound: info.total, eligibleSaved: info.eligible });
    } else {
      memberOpenings.push({ name: comp, jobsFound: info.total, eligibleSaved: info.eligible });
    }
  }

  console.log(`📌 ProxNet Member Companies with Openings (${memberOpenings.length}):`);
  for (const m of memberOpenings) {
    console.log(`   🤝 ${m.name} -> ${m.eligibleSaved} eligible jobs (Referrers Available on ProxNet)`);
  }

  console.log(`\n🌟 Competitor Companies with Openings (PIONEER BOUNTY +10 PTS) (${pioneerCompanies.length}):`);
  for (const p of pioneerCompanies) {
    console.log(`   🏆 ${p.name} -> ${p.eligibleSaved} eligible jobs (No member yet -> Pioneer +10 pts)`);
  }

  const { count: finalTotalScrapedJobs } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  console.log("\n================================================================================");
  console.log("📊 FINAL STATS:");
  console.log(`   • ProxNet Network Companies Scanned: ${allNetworkCompanies.length}`);
  console.log(`   • Competitor Relationships in DB: ${totalCompetitorsCount}`);
  console.log(`   • Total Scrapeable Companies Configured: ${allScrapeConfigs.length}`);
  console.log(`   • Jobs Scraped in this run: ${totalScrapedJobs}`);
  console.log(`   • Eligible Jobs Saved: ${totalEligibleSaved}`);
  console.log(`   • Total Live Jobs in Database: ${finalTotalScrapedJobs}`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
