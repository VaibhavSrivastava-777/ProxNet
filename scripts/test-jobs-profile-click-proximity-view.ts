import fs from "fs";
import path from "path";
import assert from "assert";

console.log("================================================================================");
console.log("🧪 VALIDATION SUITE: Jobs Tab User Profile Click -> Proximity Profile View");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

const cwd = process.cwd();
const suggestedJobsPath = path.join(cwd, "components", "jobs", "SuggestedJobs.tsx");
const suggestedJobsCode = fs.readFileSync(suggestedJobsPath, "utf-8");

// Test 1: User profile click opens ProximityCardModal (Proximity Profile view)
test("1. Clicking helper card on Jobs tab sets selectedPerson and hydrates profile", () => {
  assert(suggestedJobsCode.includes("setSelectedPerson(person)"), "Helper card click sets selectedPerson");
  assert(suggestedJobsCode.includes("handleOpenProximityProfile(person)"), "Helper card click hydrates proximity profile via handleOpenProximityProfile");
  assert(suggestedJobsCode.includes("<ProximityCardModal"), "SuggestedJobs renders ProximityCardModal when selectedPerson is set");
});

// Test 2: Random job referral logic is eradicated from user profile chat
test("2. onStartChat does NOT invoke handleAskReferral with random matchingComp.jobs[0]", () => {
  assert(!suggestedJobsCode.includes("handleAskReferral(matchingComp.jobs[0]"), "Must NOT trigger referral on random job 0");
  assert(!suggestedJobsCode.includes("matchingComp.jobs[0]"), "Must NOT reference matchingComp.jobs[0]");
});

// Test 3: onStartChat transitions to direct messaging with chatTarget
test("3. onStartChat sets chatTarget to open direct messaging", () => {
  assert(suggestedJobsCode.includes("setChatTarget(target)"), "onStartChat sets chatTarget with target person");
  assert(suggestedJobsCode.includes("<QuestionForm"), "SuggestedJobs renders QuestionForm for direct message when chatTarget is set");
  assert(suggestedJobsCode.includes("targetUser={{"), "QuestionForm is bound to targetUser");
  assert(suggestedJobsCode.includes("Direct Message"), "Renders 'Direct Message' modal header");
});

// Test 4: Referrers on hero job, similar jobs, and active company modal open Proximity Profile view
test("4. Referrer links across Jobs tab invoke handleOpenProximityProfile", () => {
  assert(suggestedJobsCode.includes("handleOpenProximityProfile({"), "Referrers invoke handleOpenProximityProfile");
  assert(suggestedJobsCode.includes("title=\"Click to view referrer's Proximity Profile\""), "Hero and similar jobs contain clear proximity profile action");
});

// Test 5: handleOpenProximityProfile fetches enriched profile data
test("5. handleOpenProximityProfile fetches from /api/proximity/people?targetId=", () => {
  assert(suggestedJobsCode.includes("/api/proximity/people?targetId="), "Fetches detailed scrapbook fields using targetId");
});

console.log("\n================================================================================");
console.log(`📊 Validation Summary: ${passed} Passed, ${failed} Failed`);
console.log("================================================================================\n");

if (failed > 0) {
  process.exit(1);
}
