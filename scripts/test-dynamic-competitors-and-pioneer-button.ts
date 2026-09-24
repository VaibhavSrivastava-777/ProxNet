import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import {
  discoverCompetitorsForCompany,
  extractAtsFromUrl,
  isValidEnterprise,
  normalizeCompanyName,
} from "../lib/competitors/discover-competitors";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION TEST: DYNAMIC GENAI COMPETITORS & PIONEER BOUNTY BUTTON");
  console.log("================================================================================\n");

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

  // --- Test 1: Extract ATS & Career Portal URL Parsing ---
  console.log("[Test 1] Testing Career Portal URL & ATS Parser...");
  const ghResult = extractAtsFromUrl("https://boards.greenhouse.io/swiggy", "Swiggy");
  assert(ghResult.provider === "greenhouse" && ghResult.boardTokenOrUrl === "swiggy", "Correctly extracts Greenhouse provider and board token");

  const leverResult = extractAtsFromUrl("https://jobs.lever.co/meesho", "Meesho");
  assert(leverResult.provider === "lever" && leverResult.boardTokenOrUrl === "meesho", "Correctly extracts Lever provider and board token");

  const workdayResult = extractAtsFromUrl("https://dell.wd1.myworkdayjobs.com/dellcareers", "Dell");
  assert(workdayResult.provider === "workday", "Correctly identifies Workday careers portal");

  const customResult = extractAtsFromUrl("https://careers.google.com/jobs", "Google");
  assert(customResult.provider === "custom", "Correctly handles custom career portal URL");

  // --- Test 2: Dynamic GenAI Competitor Discovery ---
  console.log("\n[Test 2] Testing Dynamic GenAI Competitor Discovery (Swiggy)...");
  const swiggyRes = await discoverCompetitorsForCompany("Swiggy");
  console.log(`  Discovered ${swiggyRes.competitors.length} competitors dynamically:`);
  for (const c of swiggyRes.competitors) {
    console.log(`    - ${c.name} (Source: ${c.source}, Portal: ${c.careers_url || "N/A"})`);
  }

  assert(swiggyRes.competitors.length >= 2, "Discovered at least 2 competitors dynamically");
  assert(swiggyRes.competitors.some(c => c.source === "claude" || c.source === "openai"), "Competitor discovery used GenAI (Claude or OpenAI)");
  assert(swiggyRes.competitors.some(c => Boolean(c.careers_url)), "At least one competitor has a discovered careers portal link");

  // --- Test 3: UI Replacement in SuggestedJobs.tsx ---
  console.log("\n[Test 3] Verifying UI changes in SuggestedJobs.tsx...");
  const suggestedJobsPath = path.join(process.cwd(), "components", "jobs", "SuggestedJobs.tsx");
  const suggestedJobsCode = fs.readFileSync(suggestedJobsPath, "utf-8");

  assert(
    !suggestedJobsCode.includes("View {group.jobs.length} Opening"),
    "Removed old 'View X Opening(s)' button"
  );

  assert(
    suggestedJobsCode.includes("Pioneer +10 pts"),
    "Added 'Pioneer +10 pts' button"
  );

  assert(
    !suggestedJobsCode.includes("📂 {group.jobs.length} Opening{group.jobs.length > 1 ? \"s\" : \"\"} Available\n                  </button>"),
    "Removed bulky clickable label under company name taking horizontal space"
  );

  assert(
    suggestedJobsCode.includes("setActiveCompanyModal(group)"),
    "Clicking company or Pioneer button opens openings detail modal"
  );

  console.log("\n================================================================================");
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
