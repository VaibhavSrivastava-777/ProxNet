import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { normalizeCompanyName } from "../lib/competitors/discover-competitors";

async function audit() {
  console.log("================================================================================");
  console.log("🔍 PROXNET FULL AUDIT: NETWORK COMPANIES, COMPETITORS & SCRAPER VALIDATION");
  console.log("================================================================================\n");

  const supabase = createAdminClient();

  // 1. Fetch all active users with company
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, full_name, company, job_title")
    .eq("is_active", true)
    .not("company", "is", null);

  if (userErr) {
    console.error("Error fetching users:", userErr);
    process.exit(1);
  }

  const invalidStrings = ["retired", "student", "freelance", "self-employed", "n/a", "none", "independent", "seeking", "looking"];
  const userCompanyCounts = new Map<string, { rawName: string; userCount: number }>();

  for (const u of users || []) {
    const raw = u.company?.trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    if (invalidStrings.some(inv => lower.includes(inv))) continue;

    const key = normalizeCompanyName(raw);
    if (!userCompanyCounts.has(key)) {
      userCompanyCounts.set(key, { rawName: raw, userCount: 0 });
    }
    userCompanyCounts.get(key)!.userCount++;
  }

  console.log(`[1] Identified ${userCompanyCounts.size} active ProxNet Network Companies from users.`);

  // 2. Fetch all competitor mappings
  const { data: competitorRows, error: compErr } = await supabase
    .from("company_competitors")
    .select("company_name, competitor_name, is_active");

  if (compErr) {
    console.error("Error fetching competitors:", compErr);
  }

  const companyToCompetitors = new Map<string, string[]>();
  for (const row of competitorRows || []) {
    const pKey = normalizeCompanyName(row.company_name);
    if (!companyToCompetitors.has(pKey)) {
      companyToCompetitors.set(pKey, []);
    }
    companyToCompetitors.get(pKey)!.push(row.competitor_name);
  }

  console.log(`[2] Found ${competitorRows?.length || 0} competitor mappings in company_competitors.`);

  // 3. Fetch all ATS configurations
  const { data: atsConfigs, error: atsErr } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, total_jobs_found, last_scraped_at, scrape_notes");

  if (atsErr) {
    console.error("Error fetching ATS configs:", atsErr);
  }

  const atsConfigMap = new Map<string, any>();
  for (const c of atsConfigs || []) {
    atsConfigMap.set(normalizeCompanyName(c.company_name), c);
  }

  console.log(`[3] Found ${atsConfigs?.length || 0} company ATS configurations in company_ats_config.`);

  // 4. Fetch scraped_jobs summary grouped by company
  const { data: scrapedJobs, error: jobsErr } = await supabase
    .from("scraped_jobs")
    .select("id, company, created_at");

  if (jobsErr) {
    console.error("Error fetching scraped jobs:", jobsErr);
  }

  const jobsCountByCompany = new Map<string, number>();
  for (const j of scrapedJobs || []) {
    const raw = (j.company || "").trim();
    if (!raw) continue;
    const k = normalizeCompanyName(raw);
    jobsCountByCompany.set(k, (jobsCountByCompany.get(k) || 0) + 1);
  }

  console.log(`[4] Total active jobs in scraped_jobs table: ${scrapedJobs?.length || 0}.\n`);

  // ── AUDIT REPORT PER NETWORK COMPANY ──────────────────────────────────────────
  console.log("================================================================================");
  console.log("🏢 NETWORK COMPANIES & COMPETITORS STATUS TABLE");
  console.log("================================================================================\n");

  let companiesWithAts = 0;
  let companiesWithJobs = 0;
  let companiesWithCompetitors = 0;
  let totalCompetitors = 0;
  let competitorsWithJobs = 0;

  const sortedNetworkCompanies = Array.from(userCompanyCounts.entries()).sort(
    (a, b) => b[1].userCount - a[1].userCount
  );

  for (const [key, { rawName, userCount }] of sortedNetworkCompanies) {
    const ats = atsConfigMap.get(key);
    const jobsCount = jobsCountByCompany.get(key) || 0;
    const competitors = companyToCompetitors.get(key) || [];

    if (ats) companiesWithAts++;
    if (jobsCount > 0) companiesWithJobs++;
    if (competitors.length > 0) companiesWithCompetitors++;

    totalCompetitors += competitors.length;

    // Check competitor jobs
    const competitorDetails = competitors.map((comp) => {
      const cKey = normalizeCompanyName(comp);
      const cAts = atsConfigMap.get(cKey);
      const cJobs = jobsCountByCompany.get(cKey) || 0;
      if (cJobs > 0) competitorsWithJobs++;
      return {
        name: comp,
        provider: cAts?.provider || "unconfigured",
        jobs: cJobs,
      };
    });

    const statusIcon = jobsCount > 0 ? "🟢" : ats ? "🟡" : "⚪";
    console.log(
      `${statusIcon} ${rawName.padEnd(25)} | Users: ${String(userCount).padStart(2)} | ATS: ${(ats?.provider || "None").padEnd(14)} | Jobs: ${String(jobsCount).padStart(3)} | Competitors: ${competitors.length}`
    );

    if (competitors.length > 0) {
      const compSummary = competitorDetails
        .map(c => `${c.name} (${c.jobs} jobs [${c.provider}])`)
        .join(", ");
      console.log(`   └─ ⚔️  Competitors: ${compSummary}`);
    }
  }

  console.log("\n================================================================================");
  console.log("📊 SUMMARY METRICS");
  console.log("================================================================================");
  console.log(`• Total ProxNet Network Companies: ${userCompanyCounts.size}`);
  console.log(`• Companies with ATS Configured:   ${companiesWithAts} (${Math.round((companiesWithAts / userCompanyCounts.size) * 100)}%)`);
  console.log(`• Companies with Active Scraped Jobs: ${companiesWithJobs} (${Math.round((companiesWithJobs / userCompanyCounts.size) * 100)}%)`);
  console.log(`• Companies with Mapped Competitors:  ${companiesWithCompetitors} (${Math.round((companiesWithCompetitors / userCompanyCounts.size) * 100)}%)`);
  console.log(`• Total Competitor Relationships:     ${totalCompetitors}`);
  console.log(`• Competitors with Active Jobs:       ${competitorsWithJobs}`);
  console.log(`• Total Scraped Jobs in DB:           ${scrapedJobs?.length || 0}`);
  console.log("================================================================================\n");
}

audit();
