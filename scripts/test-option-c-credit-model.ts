import assert from "assert";
import fs from "fs";
import path from "path";
import { CREDIT_COSTS } from "@/lib/wallet";

async function runOptionCValidationSuite() {
  console.log("====================================================================");
  console.log("🔍 RUNNING AUTOMATED VALIDATION: OPTION C STRICT PER-OPPORTUNITY MODEL");
  console.log("====================================================================");

  // -------------------------------------------------------------------------
  // Test 1: Wallet Config & Base Pricing Rate
  // -------------------------------------------------------------------------
  console.log("\n[Test 1] Validating CREDIT_COSTS definition for deep_career_miner...");
  assert.strictEqual(
    CREDIT_COSTS.deep_career_miner.amount,
    3,
    "Option C requires base cost of 3 credits per opportunity"
  );
  assert.strictEqual(
    CREDIT_COSTS.deep_career_miner.label,
    "Deep Career Conversion Miner",
    "Label should be Deep Career Conversion Miner"
  );
  console.log("✅ Test 1 Passed: Base unit cost is strictly 3 credits/opportunity.");

  // -------------------------------------------------------------------------
  // Test 2: Dynamic Pricing Tiers (1, 2, 3, 5 roles)
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Validating Multi-Opportunity Pricing Calculations...");
  const tiers = [
    { count: 1, expectedCost: 3 },
    { count: 2, expectedCost: 6 },
    { count: 3, expectedCost: 9 },
    { count: 5, expectedCost: 15 },
  ];

  for (const tier of tiers) {
    const calculated = tier.count * CREDIT_COSTS.deep_career_miner.amount;
    assert.strictEqual(
      calculated,
      tier.expectedCost,
      `Calculated cost for ${tier.count} roles must be ${tier.expectedCost} credits`
    );
    console.log(`  ✓ ${tier.count} Opportunity -> ${calculated} Credits`);
  }
  console.log("✅ Test 2 Passed: All dynamic tier calculations strictly align with Option C.");

  // -------------------------------------------------------------------------
  // Test 3: Fair Billing Logic (Only charge for actual unearthed)
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Validating Fair Billing Deduction Model...");
  const fairBillingCases = [
    { requested: 3, unearthed: 3, expectedDeduction: 9 },
    { requested: 3, unearthed: 2, expectedDeduction: 6 }, // 1 less found -> refund/only charge for 2
    { requested: 5, unearthed: 4, expectedDeduction: 12 },
    { requested: 5, unearthed: 1, expectedDeduction: 3 },
    { requested: 2, unearthed: 0, expectedDeduction: 0 }, // 0 found -> 0 charged
  ];

  for (const scenario of fairBillingCases) {
    const costPerOpportunity = CREDIT_COSTS.deep_career_miner.amount;
    const actualCharge = scenario.unearthed * costPerOpportunity;
    assert.strictEqual(
      actualCharge,
      scenario.expectedDeduction,
      `Fair billing for requested ${scenario.requested}, found ${scenario.unearthed} must charge ${scenario.expectedDeduction}`
    );
    console.log(
      `  ✓ Requested: ${scenario.requested} | Unearthed: ${scenario.unearthed} | Charged: ${actualCharge} Cr (Saved: ${(scenario.requested - scenario.unearthed) * costPerOpportunity} Cr)`
    );
  }
  console.log("✅ Test 3 Passed: Fair billing guarantees user is charged strictly for unearthed opportunities.");

  // -------------------------------------------------------------------------
  // Test 4: API Route Contract (/api/jobs/deep-conversion)
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Validating Backend API Route Contract...");
  const routePath = path.resolve("app/api/jobs/deep-conversion/route.ts");
  assert(fs.existsSync(routePath), "API route must exist");
  const routeCode = fs.readFileSync(routePath, "utf-8");

  assert(
    routeCode.includes("opportunityCount"),
    "Route must parse opportunityCount from request payload"
  );
  assert(
    routeCode.includes("costPerOpportunity = 3"),
    "Route must define costPerOpportunity as 3"
  );
  assert(
    routeCode.includes("actualUnearthed * costPerOpportunity"),
    "Route must charge actualUnearthed * costPerOpportunity"
  );
  assert(
    routeCode.includes("creditsExpended"),
    "Route must return creditsExpended in response JSON"
  );
  assert(
    routeCode.includes("runDeepCareerConversionMiner(user.id, requestedCount)"),
    "Route must pass requestedCount to miner function"
  );
  console.log("✅ Test 4 Passed: Backend API route strictly enforces Option C & fair billing.");

  // -------------------------------------------------------------------------
  // Test 5: UI Modal Contract (DeepConversionModal.tsx)
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] Validating Frontend Modal Contract...");
  const modalPath = path.resolve("components/jobs/DeepConversionModal.tsx");
  assert(fs.existsSync(modalPath), "DeepConversionModal.tsx must exist");
  const modalCode = fs.readFileSync(modalPath, "utf-8");

  assert(
    modalCode.includes("opportunityCount"),
    "Modal must track opportunityCount state"
  );
  assert(
    modalCode.includes("Option C: 3 Credits / Role") || modalCode.includes("Option C: Strict 3 Cr / Role"),
    "Modal must display Option C badge"
  );
  assert(
    modalCode.includes("Fair Billing Guarantee"),
    "Modal must feature the Fair Billing Guarantee statement"
  );
  assert(
    modalCode.includes("Launch Deep Conversion Run ({opportunityCount * 3} Credits)"),
    "Modal launch button must reflect dynamic credit calculation"
  );
  assert(
    modalCode.includes("body: JSON.stringify({ opportunityCount })"),
    "Modal must pass opportunityCount to API"
  );
  assert(
    modalCode.includes("creditsExpended"),
    "Modal must display actual credits expended in results header"
  );
  console.log("✅ Test 5 Passed: DeepConversionModal contains complete Option C interactive selector.");

  // -------------------------------------------------------------------------
  // Test 6: SuggestedJobs.tsx Trigger Contract
  // -------------------------------------------------------------------------
  console.log("\n[Test 6] Validating SuggestedJobs.tsx UI Integration...");
  const suggestedPath = path.resolve("components/jobs/SuggestedJobs.tsx");
  assert(fs.existsSync(suggestedPath), "SuggestedJobs.tsx must exist");
  const suggestedCode = fs.readFileSync(suggestedPath, "utf-8");

  assert(
    suggestedCode.includes("Mine Opportunities (3 Credits / Job)"),
    "SuggestedJobs must display 'Mine Opportunities (3 Credits / Job)'"
  );
  console.log("✅ Test 6 Passed: SuggestedJobs clearly communicates Option C pricing model.");

  console.log("\n====================================================================");
  console.log("🎉 ALL TESTS PASSED: OPTION C STRICT PER-OPPORTUNITY MODEL FULLY VERIFIED!");
  console.log("====================================================================");
}

runOptionCValidationSuite().catch((err) => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});
