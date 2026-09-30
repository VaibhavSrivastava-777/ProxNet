import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runTests() {
  console.log("======================================================");
  console.log("🧪 TESTING CRON SCHEDULE & WORKFLOW CONFIGURATION");
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

  // 1. Check .github/workflows/scrape-jobs.yml
  console.log("\n▶ TEST 1: GitHub Actions Scrape Schedule");
  const workflowContent = fs.readFileSync(".github/workflows/scrape-jobs.yml", "utf8");
  assert(workflowContent.includes("cron: '0 0 * * *'"), "Daily morning schedule '0 0 * * *' (05:30 AM IST) is present");
  assert(workflowContent.includes("npx tsx scripts/scrape-jobs.ts"), "Runs active engine scripts/scrape-jobs.ts");

  // 2. Check scripts/run-scraper.ts
  console.log("\n▶ TEST 2: Scraper Disabled Block Removal");
  const runScraperContent = fs.readFileSync("scripts/run-scraper.ts", "utf8");
  assert(!runScraperContent.includes("GitHub Actions Job Scraper is DISABLED"), "run-scraper.ts does not contain disabled early return");

  // 3. Check scripts/scrape-jobs.ts
  console.log("\n▶ TEST 3: Cron Status Upsert in Scraper");
  const scrapeJobsContent = fs.readFileSync("scripts/scrape-jobs.ts", "utf8");
  assert(scrapeJobsContent.includes('company_name: "cron_status"'), "scrape-jobs.ts updates cron_status row for admin dashboard");

  // 4. Check app/api/cron/scrape-network-and-competitors/route.ts
  console.log("\n▶ TEST 4: Vercel Scraper Timeout & URL Guards");
  const netCompContent = fs.readFileSync("app/api/cron/scrape-network-and-competitors/route.ts", "utf8");
  assert(netCompContent.includes("Date.now() - startTime > 45000"), "scrape-network-and-competitors has 45s execution timeout guard");
  assert(!netCompContent.includes("google.com/search?q="), "scrape-network-and-competitors has no Google Search URL fallback");

  // 5. Check app/api/cron/scrape-user-targets/route.ts
  console.log("\n▶ TEST 5: User Targets Route Optimization");
  const userTargetsContent = fs.readFileSync("app/api/cron/scrape-user-targets/route.ts", "utf8");
  assert(userTargetsContent.includes("Date.now() - startTime > 45000"), "scrape-user-targets has 45s execution timeout guard");
  assert(userTargetsContent.includes(".slice(0, 10)"), "scrape-user-targets caps batch size to 10 companies");

  console.log("\n======================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("======================================================");

  if (failed > 0) process.exit(1);
}

runTests();
