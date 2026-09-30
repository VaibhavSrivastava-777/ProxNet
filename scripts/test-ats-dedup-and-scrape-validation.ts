import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("======================================================");
  console.log("🧪 RUNNING ATS DEDUPLICATION & SCRAPE VALIDATION TESTS");
  console.log("======================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // TEST SUITE 1: DEDUPLICATION INTEGRITY
  console.log("\n▶ TEST SUITE 1: Deduplication & Canonical Names");
  const { data: boards } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, total_jobs_found")
    .neq("provider", "cron_status");

  assert(!!boards && boards.length > 0, "company_ats_config rows retrieved successfully");

  // Check 1.1: No duplicate company names (case-insensitive)
  const nameOccurrences = new Map<string, string[]>();
  for (const b of boards || []) {
    const key = b.company_name.toLowerCase().trim();
    if (!nameOccurrences.has(key)) nameOccurrences.set(key, []);
    nameOccurrences.get(key)!.push(b.company_name);
  }
  const duplicateClusters = Array.from(nameOccurrences.entries()).filter(([_, list]) => list.length > 1);
  assert(duplicateClusters.length === 0, "Zero duplicate company names in company_ats_config", `Found: ${JSON.stringify(duplicateClusters)}`);

  // Check 1.2: Specific duplicate names from user prompt are gone
  const specificRemovedDuplicates = [
    "Dell",
    "dell",
    "dell technologies",
    "Microsoft Corporation",
    "Microsoft (Last Company)",
    "amazon",
    "Amazon India",
    "Wipro Limited",
    "Wipro Technologies",
    "Tcs",
    "TCS",
    "Tata Consultancy Services",
    "PwC",
    "PwC (PricewaterhouseCoopers)",
    "PricewaterhouseCoopers (PwC) India",
    "Infosys",
    "Ibm",
    "IBM Corporation",
    "Google Inc.",
    "Deloitte Consulting",
    "Deloitte Touché Tohmatsu India LLP",
    "EY",
    "EY (Ernst & Young)",
    "Ernst & Young (EY) India",
    "Kotak Mahindra Bank",
    "Cognizant",
    "Verint systems Pvt Ltd",
    "Wellsfargo",
    "State Bank of India",
    "Zoho",
    "Retired",
    "Independent Advisory Practice",
    "CYB ENGINEER LLP",
    "Ex TCS n Tech Mahindra , Consulting"
  ];
  const boardNames = new Set((boards || []).map(b => b.company_name));
  const lingeringDuplicates = specificRemovedDuplicates.filter(d => boardNames.has(d));
  assert(lingeringDuplicates.length === 0, "Known duplicate names completely excised", `Lingering: ${lingeringDuplicates.join(", ")}`);

  // Check 1.3: Canonical entries exist
  const requiredCanonicalNames = [
    "Dell Technologies",
    "Microsoft",
    "Amazon",
    "Wipro",
    "Tata Consultancy Services (TCS)",
    "PricewaterhouseCoopers (PwC)",
    "Infosys Ltd.",
    "IBM",
    "Google",
    "Deloitte",
    "Ernst & Young (EY)",
    "Kotak Mahindra Bank Ltd",
    "Cognizant Technology Solutions",
    "Verint Systems",
    "Wells Fargo",
    "State Bank of India (SBI)",
    "Zoho Corporation",
  ];
  const missingCanonicals = requiredCanonicalNames.filter(c => !boardNames.has(c));
  assert(missingCanonicals.length === 0, "All canonical company entries exist", `Missing: ${missingCanonicals.join(", ")}`);

  // TEST SUITE 2: CONFIG & URL HEALTH
  console.log("\n▶ TEST SUITE 2: Configuration & Career URL Health");

  // Check 2.1: No provider 'none'
  const noneProviders = (boards || []).filter(b => b.provider === "none");
  assert(noneProviders.length === 0, "No boards with provider 'none'", `Found ${noneProviders.length}`);

  // Check 2.2: No Google Search query URLs
  const googleUrls = (boards || []).filter(b => (b.board_token_or_url || "").includes("google.com/search"));
  assert(googleUrls.length === 0, "No boards with Google Search query URLs", `Found ${googleUrls.length}`);

  // Check 2.3: No blank or empty URLs
  const emptyUrls = (boards || []).filter(b => !(b.board_token_or_url || "").trim());
  assert(emptyUrls.length === 0, "No boards with empty/blank tokens or URLs", `Found ${emptyUrls.length}`);

  // TEST SUITE 3: SCRAPE ACCURACY & LIVE ENDPOINTS
  console.log("\n▶ TEST SUITE 3: Live Scrape Endpoint Verification");

  // Verify that previously broken/misconfigured boards now have active working ATS endpoints
  const endpointsToValidate = [
    { name: "Swiggy", url: "https://api.smartrecruiters.com/v1/companies/swiggy/postings", minJobs: 1 },
    { name: "Freshworks", url: "https://api.smartrecruiters.com/v1/companies/freshworks/postings", minJobs: 1 },
    { name: "Scale AI", url: "https://boards-api.greenhouse.io/v1/boards/scaleai/jobs", minJobs: 1 },
    { name: "Together AI", url: "https://boards-api.greenhouse.io/v1/boards/togetherai/jobs", minJobs: 1 },
    { name: "Notion", url: "https://api.ashbyhq.com/posting-api/job-board/notion", minJobs: 1 },
    { name: "Slice", url: "https://boards-api.greenhouse.io/v1/boards/slice/jobs", minJobs: 1 },
    { name: "HubSpot", url: "https://boards-api.greenhouse.io/v1/boards/hubspotjobs/jobs", minJobs: 1 },
    { name: "InMobi", url: "https://boards-api.greenhouse.io/v1/boards/inmobi/jobs", minJobs: 1 },
    { name: "Datadog", url: "https://boards-api.greenhouse.io/v1/boards/datadog/jobs", minJobs: 1 },
    { name: "Figma", url: "https://boards-api.greenhouse.io/v1/boards/figma/jobs", minJobs: 1 },
    { name: "Cloudflare", url: "https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs", minJobs: 1 },
    { name: "Elastic", url: "https://boards-api.greenhouse.io/v1/boards/elastic/jobs", minJobs: 1 },
    { name: "Stripe", url: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs", minJobs: 1 },
  ];

  for (const ep of endpointsToValidate) {
    try {
      const res = await fetch(ep.url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) });
      let count = 0;
      if (res.ok) {
        const json = await res.json();
        count = Array.isArray(json) ? json.length : (json.jobs?.length || json.content?.length || 0);
      }
      assert(res.ok && count >= ep.minJobs, `${ep.name} ATS endpoint is active and returns postings (${count} postings)`);
    } catch (e: any) {
      assert(false, `${ep.name} ATS endpoint check failed`, e.message);
    }
  }

  // TEST SUITE 4: SCRAPED JOBS INTEGRITY
  console.log("\n▶ TEST SUITE 4: Scraped Jobs Persistence");
  const { data: swiggyJobs } = await supabase
    .from("scraped_jobs")
    .select("id, title, company, location, url")
    .eq("company", "Swiggy");

  assert(!!swiggyJobs && swiggyJobs.length >= 50, `Swiggy has verified saved jobs in scraped_jobs table (${swiggyJobs?.length || 0} jobs)`);

  const { data: dellJobs } = await supabase
    .from("scraped_jobs")
    .select("id")
    .eq("company", "Dell Technologies");
  assert(!!dellJobs && dellJobs.length > 0, `Dell Technologies jobs migrated and preserved (${dellJobs?.length || 0} jobs)`);

  // Final summary
  console.log("\n======================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("======================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
