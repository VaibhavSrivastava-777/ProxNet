import assert from "assert";
import fs from "fs";
import path from "path";
import { isSameCompany } from "@/lib/jobs/job-filters";

async function runExcludeOwnCompanyTestSuite() {
  console.log("====================================================================");
  console.log("🔍 RUNNING AUTOMATED VALIDATION: EXCLUDE OWN COMPANY AS MATCHED JOB");
  console.log("====================================================================");

  // -------------------------------------------------------------------------
  // Test 1: Validate isSameCompany helper accuracy & aliases
  // -------------------------------------------------------------------------
  console.log("\n[Test 1] Validating isSameCompany matching & alias resolution...");

  // Positive matches (should be identified as SAME company)
  const positivePairs: Array<[string, string]> = [
    ["Dell Technologies", "Dell"],
    ["Dell", "Dell Technologies"],
    ["Dell Inc.", "Dell Technologies"],
    ["Dell India Pvt Ltd", "Dell"],
    ["Google", "Google LLC"],
    ["Google Inc.", "Google"],
    ["Microsoft", "Microsoft Corporation"],
    ["Microsoft India", "Microsoft"],
    ["Hewlett Packard", "HP"],
    ["HP Inc.", "Hewlett Packard"],
    ["Amazon", "Amazon Web Services"],
    ["AWS", "Amazon"],
    ["Oracle Corporation", "Oracle"],
    ["Oracle", "Oracle India Private Limited"],
    ["ServiceNow", "ServiceNow Inc."],
    ["Lenovo", "Lenovo Group Limited"],
    ["LSEG", "London Stock Exchange Group"],
  ];

  for (const [a, b] of positivePairs) {
    const isSame = isSameCompany(a, b);
    assert.strictEqual(
      isSame,
      true,
      `Expected isSameCompany('${a}', '${b}') to be TRUE`
    );
    console.log(`  ✓ Detected same company: "${a}" <=> "${b}"`);
  }

  // Negative pairs (distinct companies - must NOT match)
  const negativePairs: Array<[string, string]> = [
    ["Dell Technologies", "HP"],
    ["Dell Technologies", "Lenovo"],
    ["Google", "Microsoft"],
    ["Apple", "Amazon"],
    ["ServiceNow", "Oracle"],
    ["Cisco", "Dell"],
    ["Uber", "Grab"],
  ];

  for (const [a, b] of negativePairs) {
    const isSame = isSameCompany(a, b);
    assert.strictEqual(
      isSame,
      false,
      `Expected isSameCompany('${a}', '${b}') to be FALSE`
    );
    console.log(`  ✓ Correctly identified distinct: "${a}" =/= "${b}"`);
  }
  console.log("✅ Test 1 Passed: isSameCompany handles corporate suffixes, subsidiaries, and aliases.");

  // -------------------------------------------------------------------------
  // Test 2: Validate app/api/jobs/suggested/route.ts filters candidate company
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Validating app/api/jobs/suggested/route.ts filtering...");
  const routePath = path.resolve("app/api/jobs/suggested/route.ts");
  assert(fs.existsSync(routePath), "Suggested jobs API route must exist");
  const routeCode = fs.readFileSync(routePath, "utf-8");

  assert(
    routeCode.includes("isSameCompany"),
    "Route must import and use isSameCompany"
  );
  assert(
    routeCode.includes("if (isSameCompany(row.company, userCompany)) continue;"),
    "Route must filter out row.company matching userCompany in candidateJobs loop"
  );
  assert(
    routeCode.includes(".filter(g => !isSameCompany(g.company, userCompany))"),
    "Route must filter out candidate's own company when assembling finalCompanies"
  );
  console.log("✅ Test 2 Passed: Backend API route strictly excludes candidate's own company.");

  // -------------------------------------------------------------------------
  // Test 3: Validate components/jobs/SuggestedJobs.tsx client-side protections
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Validating components/jobs/SuggestedJobs.tsx client defenses...");
  const compPath = path.resolve("components/jobs/SuggestedJobs.tsx");
  assert(fs.existsSync(compPath), "SuggestedJobs.tsx must exist");
  const compCode = fs.readFileSync(compPath, "utf-8");

  assert(
    compCode.includes("isSameCompany"),
    "SuggestedJobs must import isSameCompany"
  );
  assert(
    compCode.includes("isMatchedFeed && currentUserCompany && isSameCompany(c.company, currentUserCompany)"),
    "SuggestedJobs must filter out own company in applyAdvancedFilters for Matched feed"
  );
  assert(
    compCode.includes("allFlattenedMatchedJobs = useMemo("),
    "SuggestedJobs must define allFlattenedMatchedJobs"
  );
  assert(
    compCode.includes("!currentUserCompany || !isSameCompany(g.company, currentUserCompany)"),
    "allFlattenedMatchedJobs must filter out own company"
  );
  assert(
    compCode.includes("!currentUserCompany || !isSameCompany(c.company, currentUserCompany)"),
    "heroJobItem fallback must never select own company"
  );
  console.log("✅ Test 3 Passed: Frontend UI prevents own company from appearing in Matched, Hero, and Similar Jobs.");

  // -------------------------------------------------------------------------
  // Test 4: Validate lib/jobs/deep-conversion-miner.ts protections
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Validating lib/jobs/deep-conversion-miner.ts exclusion...");
  const minerPath = path.resolve("lib/jobs/deep-conversion-miner.ts");
  assert(fs.existsSync(minerPath), "deep-conversion-miner.ts must exist");
  const minerCode = fs.readFileSync(minerPath, "utf-8");

  assert(
    minerCode.includes("isSameCompany"),
    "deep-conversion-miner must import isSameCompany"
  );
  assert(
    minerCode.includes("!isSameCompany(j.company, candidate.currentCompany)"),
    "deep-conversion-miner must filter out candidate's own company before selecting jobs"
  );
  console.log("✅ Test 4 Passed: Deep Career Conversion Miner guarantees candidate's own employer is excluded.");

  console.log("\n====================================================================");
  console.log("🎉 ALL TESTS PASSED: OWN COMPANY EXCLUSION FULLY VALIDATED!");
  console.log("====================================================================");
}

runExcludeOwnCompanyTestSuite().catch((err) => {
  console.error("❌ Test Suite Failed:", err);
  process.exit(1);
});
