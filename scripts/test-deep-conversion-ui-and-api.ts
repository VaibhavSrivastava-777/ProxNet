import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import fs from "fs";
import path from "path";
import { CREDIT_COSTS, deductWalletCredits } from "../lib/wallet";
import { createAdminClient } from "../lib/supabase/admin";

async function validateDeepConversionFeature() {
  console.log("🧪 RUNNING VALIDATION TEST: Deep Conversion Miner UI/UX & API");
  console.log("-------------------------------------------------------------");

  // 1. Validate Wallet Configuration
  console.log("Test 1: Validating Credit Configuration in lib/wallet.ts...");
  assert(CREDIT_COSTS.deep_career_miner, "deep_career_miner must be defined in CREDIT_COSTS");
  assert.strictEqual(CREDIT_COSTS.deep_career_miner.amount, 3, "Cost must be exactly 3 credits");
  assert.strictEqual(CREDIT_COSTS.deep_career_miner.label, "Deep Career Conversion Miner");
  console.log("✅ Test 1 Passed: deep_career_miner is configured with 3 credits cost.");

  // 2. Validate Modal Source Code (Phases, 100s Countdown, Ticks)
  console.log("\nTest 2: Validating DeepConversionModal.tsx implementation...");
  const modalPath = path.resolve("components/jobs/DeepConversionModal.tsx");
  assert(fs.existsSync(modalPath), "DeepConversionModal.tsx must exist");
  const modalCode = fs.readFileSync(modalPath, "utf-8");

  assert(modalCode.includes("100"), "Must include 100 seconds tentative time");
  assert(modalCode.includes("countdown"), "Must track countdown timer state");
  assert(modalCode.includes("Tentative Finish in ~{countdown}s"), "Must display tentative countdown timer to user");
  assert(modalCode.includes("✓"), "Must render tick checkmarks for completed phases");
  assert(modalCode.includes("Phase {phase.id}: {phase.title}"), "Must render dynamic Phase title");
  assert(modalCode.includes("Candidate Profile & Resume Ingestion"), "Must declare Phase 1 title");
  assert(modalCode.includes("Recursive Competitor & Peer Ecosystem Discovery"), "Must declare Phase 2 title");
  assert(modalCode.includes("Live Enterprise ATS & Workday Portal Crawling"), "Must declare Phase 3 title");
  assert(modalCode.includes("Conversion Playbook Synthesis (Focus X, Y, Z)"), "Must declare Phase 4 title");
  assert(modalCode.includes("Warm Insider Mapping & Pitch Drafting"), "Must declare Phase 5 title");

  assert(modalCode.includes("Focus X (Resume Hook)"), "Must support Focus X tab");
  assert(modalCode.includes("Focus Y (ATS Optimization)"), "Must support Focus Y tab");
  assert(modalCode.includes("Focus Z (Interview Strategy)"), "Must support Focus Z tab");
  assert(modalCode.includes("copyToClipboard"), "Must include 1-click clipboard copy for Mr. A pitch");
  console.log("✅ Test 2 Passed: DeepConversionModal contains 100s countdown, 5-phase ticks, Focus X/Y/Z tabs & copy tools.");

  // 3. Validate SuggestedJobs UI Integration
  console.log("\nTest 3: Validating SuggestedJobs.tsx UI integration...");
  const suggestedJobsPath = path.resolve("components/jobs/SuggestedJobs.tsx");
  const suggestedCode = fs.readFileSync(suggestedJobsPath, "utf-8");

  assert(suggestedCode.includes("DeepConversionModal"), "Must import DeepConversionModal");
  assert(suggestedCode.includes("Mine Opportunities (3 Credits / Job)") || suggestedCode.includes("Mine Opportunities (3 Credits)"), "Fetch button must be replaced with Mine Opportunities");
  assert(suggestedCode.includes("deep-conversion-results"), "Must render deep-conversion-results section");
  assert(suggestedCode.includes("deepConversionBlueprints"), "Must manage deepConversionBlueprints state");
  console.log("✅ Test 3 Passed: SuggestedJobs UI has replaced 'Fetch Matches' with 'Mine Opportunities (3 Credits / Job)' and embedded conversion blueprints.");

  // 4. Validate API Route
  console.log("\nTest 4: Validating app/api/jobs/deep-conversion/route.ts...");
  const apiPath = path.resolve("app/api/jobs/deep-conversion/route.ts");
  assert(fs.existsSync(apiPath), "API route file must exist");
  const apiCode = fs.readFileSync(apiPath, "utf-8");

  assert(apiCode.includes("maxDuration = 120"), "Must set maxDuration >= 100s");
  assert(apiCode.includes("deep_career_miner"), "Must deduct deep_career_miner credit");
  assert(apiCode.includes("runDeepCareerConversionMiner"), "Must call runDeepCareerConversionMiner");
  console.log("✅ Test 4 Passed: API route configured with 120s timeout and credit deduction.");

  // 5. Test Live Supabase Profile Blueprints Hydration
  console.log("\nTest 5: Verifying Supabase profile_digest deep_career_blueprints persistence...");
  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("profile_digest")
    .ilike("full_name", "%vaibhav%")
    .single();

  const blueprints = user?.profile_digest?.deep_career_blueprints;
  assert(Array.isArray(blueprints), "deep_career_blueprints must be saved in Supabase");
  assert(blueprints.length > 0, "Must contain at least 1 saved blueprint");
  console.log(`✅ Test 5 Passed: Verified ${blueprints.length} saved conversion blueprints in Supabase for Vaibhav.`);
  console.log(`   Sample Job 1: [${blueprints[0].company}] ${blueprints[0].title} (${blueprints[0].matchScore}% Match)`);

  console.log("\n🎉 ALL 5 VALIDATION TESTS PASSED PERFECTLY!");
}

validateDeepConversionFeature().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
