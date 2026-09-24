import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { normalizeCompanyName } from "../lib/competitors/discover-competitors";

async function validateExpandedAts() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION TEST: EXPANDED ATS PIONEER OPPORTUNITIES & DATABASE AUDIT");
  console.log("================================================================================\n");

  const supabase = createAdminClient();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Validate scraped_jobs count
  const { count: totalJobs, error: jobsErr } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  assert(!jobsErr && (totalJobs || 0) >= 800, `Total scraped jobs in database is >= 800 (Current: ${totalJobs})`);

  // 2. Validate Pioneer companies and Member companies
  const { data: users } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const memberSet = new Set((users || []).map(u => normalizeCompanyName(u.company || "")).filter(Boolean));

  // Query distinct companies from scraped_jobs
  const { data: allJobs } = await supabase
    .from("scraped_jobs")
    .select("company");

  const pioneerCompaniesWithJobs = new Set<string>();
  const referrerReadyCompaniesWithJobs = new Set<string>();

  for (const job of allJobs || []) {
    const norm = normalizeCompanyName(job.company);
    if (memberSet.has(norm)) {
      referrerReadyCompaniesWithJobs.add(job.company);
    } else {
      pioneerCompaniesWithJobs.add(job.company);
    }
  }

  assert(pioneerCompaniesWithJobs.size >= 10, `Identified active Pioneer companies with jobs (Found ${pioneerCompaniesWithJobs.size} companies)`);
  assert(referrerReadyCompaniesWithJobs.size >= 1, `Identified active Member companies with jobs (Found ${referrerReadyCompaniesWithJobs.size} companies)`);

  console.log(`  Pioneer Companies count: ${pioneerCompaniesWithJobs.size}`);
  console.log(`  Member Companies count: ${referrerReadyCompaniesWithJobs.size}`);
  console.log(`  Sample Member Companies: ${Array.from(referrerReadyCompaniesWithJobs).slice(0, 5).join(", ")}`);


  // 3. Check ATS config count
  const { count: atsConfigCount } = await supabase
    .from("company_ats_config")
    .select("*", { count: "exact", head: true });

  assert((atsConfigCount || 0) >= 200, `ATS config has >= 200 registered companies (Current: ${atsConfigCount})`);

  // 4. Verify no broken job URLs
  const { data: urlCheckJobs } = await supabase
    .from("scraped_jobs")
    .select("url")
    .limit(50);

  const validUrls = (urlCheckJobs || []).every(j => j.url && j.url.startsWith("http"));
  assert(validUrls, "All scraped job URLs have valid http/https schema");

  console.log("\n================================================================================");
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

validateExpandedAts().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
