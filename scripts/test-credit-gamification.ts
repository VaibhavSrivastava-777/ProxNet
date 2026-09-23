import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import fs from "fs";
import path from "path";
import { CREDIT_REWARDS, CREDIT_COSTS, deductWalletCredits, transferCredits, checkAndAwardPioneerBounty } from "../lib/wallet";
import { createAdminClient } from "../lib/supabase/admin";

async function runValidationTests() {
  console.log("==================================================");
  console.log("🧪 STARTING CREDIT GAMIFICATION VALIDATION SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`, err.message);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`, err.message);
      failed++;
    }
  }

  // 1. Reward & Cost Tables Configuration
  test("CREDIT_REWARDS contains onboarding_bounty (+10 credits)", () => {
    assert(CREDIT_REWARDS.onboarding_bounty, "onboarding_bounty must exist");
    assert.strictEqual(CREDIT_REWARDS.onboarding_bounty.amount, 10, "onboarding_bounty must award 10 credits");
  });

  test("CREDIT_REWARDS responded_referral_ask is set to +3 credits (matching transfer)", () => {
    assert(CREDIT_REWARDS.responded_referral_ask, "responded_referral_ask must exist");
    assert.strictEqual(CREDIT_REWARDS.responded_referral_ask.amount, 3, "responded_referral_ask must be 3 credits");
  });

  test("CREDIT_COSTS contains referral_request_cost (-1 credit) & referral_response_transfer (-3 credits)", () => {
    assert(CREDIT_COSTS.referral_request_cost, "referral_request_cost must exist");
    assert.strictEqual(CREDIT_COSTS.referral_request_cost.amount, 1, "referral_request_cost must cost 1 credit");

    assert(CREDIT_COSTS.referral_response_transfer, "referral_response_transfer must exist");
    assert.strictEqual(CREDIT_COSTS.referral_response_transfer.amount, 3, "referral_response_transfer must transfer 3 credits");
  });

  // 2. File Verification & Route Integration
  test("init-referral route calls deductWalletCredits and returns deduction details", () => {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "app/api/jobs/chat/init-referral/route.ts"), "utf-8");
    assert(fileContent.includes("deductWalletCredits"), "Must import and call deductWalletCredits");
    assert(fileContent.includes('"referral_request_cost"'), "Must deduct referral_request_cost");
    assert(fileContent.includes("creditsDeducted: deductResult.creditsDeducted"), "Must return creditsDeducted in JSON");
  });

  test("chat send route calls transferCredits on first referral response", () => {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "app/api/jobs/chat/send/route.ts"), "utf-8");
    assert(fileContent.includes("transferCredits"), "Must import and call transferCredits");
    assert(fileContent.includes('"referral_response_transfer"'), "Must transfer for referral_response_transfer");
    assert(fileContent.includes("transferCredits(requesterId, user.id, 3,"), "Must move 3 credits from requester to responder");
  });

  test("OAuth signup in lib/users.ts calls checkAndAwardPioneerBounty", () => {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "lib/users.ts"), "utf-8");
    assert(fileContent.includes("checkAndAwardPioneerBounty"), "Must import and call checkAndAwardPioneerBounty");
    assert(fileContent.includes("checkAndAwardPioneerBounty(data.id, data.company)"), "Must invoke with user id and company");
  });

  test("Profile update in app/api/profile/route.ts calls checkAndAwardPioneerBounty", () => {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "app/api/profile/route.ts"), "utf-8");
    assert(fileContent.includes("checkAndAwardPioneerBounty"), "Must import and call checkAndAwardPioneerBounty");
    assert(fileContent.includes("checkAndAwardPioneerBounty(user.id, body.company.trim())"), "Must trigger on company update");
  });

  test("Suggested and All jobs APIs select and return user inviteCode", () => {
    const suggestedContent = fs.readFileSync(path.join(process.cwd(), "app/api/jobs/suggested/route.ts"), "utf-8");
    const allContent = fs.readFileSync(path.join(process.cwd(), "app/api/jobs/all/route.ts"), "utf-8");
    assert(suggestedContent.includes("invite_code") && suggestedContent.includes("inviteCode:"), "suggested route must return inviteCode");
    assert(allContent.includes("invite_code") && allContent.includes("inviteCode:"), "all route must return inviteCode");
  });

  test("SuggestedJobs UI includes Pioneer Bounty CTA and colleague invite handler", () => {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "components/jobs/SuggestedJobs.tsx"), "utf-8");
    assert(fileContent.includes("handleInviteColleague"), "Must have handleInviteColleague function");
    assert(fileContent.includes("Pioneer Bounty: +10 Credits"), "Must display Pioneer Bounty banner");
    assert(fileContent.includes("Invite Colleague"), "Must have button to invite colleague");
  });

  test("ReferralPitchModal displays -1 Credit demand tax notice", () => {
    const fileContent = fs.readFileSync(path.join(process.cwd(), "components/jobs/ReferralPitchModal.tsx"), "utf-8");
    assert(fileContent.includes("-1 Credit"), "Must show -1 Credit badge in modal footer");
  });

  // 3. Database & Wallet Functions End-to-End Simulation
  await testAsync("Database integration: deductWalletCredits debits balance and prevents duplicate debit", async () => {
    const supabase = createAdminClient();
    const { data: user } = await supabase.from("users").select("id, wallet, profile_digest").limit(1).single();
    if (!user) {
      console.log("Skipping DB test: no user available");
      return;
    }

    const testRef = `test-deduct-${Date.now()}`;
    const initialBal = user.wallet ?? 0;

    // 1st deduction
    const res1 = await deductWalletCredits(user.id, "referral_request_cost", testRef);
    assert.strictEqual(res1.success, true, "First deduction must succeed");
    assert.strictEqual(res1.creditsDeducted, 1, "Must deduct 1 credit");
    assert.strictEqual(res1.newBalance, initialBal - 1, "New balance must be initial - 1");

    // Duplicate deduction with same referenceId should be rejected
    const res2 = await deductWalletCredits(user.id, "referral_request_cost", testRef);
    assert.strictEqual(res2.success, false, "Duplicate deduction should be blocked");
    assert.strictEqual(res2.creditsDeducted, 0, "Duplicate deduction must deduct 0");

    // Restore user wallet
    await supabase.from("users").update({ wallet: initialBal, profile_digest: user.profile_digest }).eq("id", user.id);
  });

  await testAsync("Database integration: transferCredits moves credits from requester to responder", async () => {
    const supabase = createAdminClient();
    const { data: users } = await supabase.from("users").select("id, wallet, profile_digest").limit(2);
    if (!users || users.length < 2) {
      console.log("Skipping transfer test: need at least 2 users");
      return;
    }

    const [u1, u2] = users;
    const testThreadId = `test-thread-${Date.now()}`;
    const u1Initial = u1.wallet ?? 0;
    const u2Initial = u2.wallet ?? 0;

    const res = await transferCredits(u1.id, u2.id, 3, "referral_response_transfer", testThreadId);
    assert.strictEqual(res.success, true, "Transfer must succeed");
    assert.strictEqual(res.transferredAmount, 3, "Must transfer 3 credits");
    assert.strictEqual(res.fromBalance, u1Initial - 3, "Requester must be debited 3 credits");
    assert.strictEqual(res.toBalance, u2Initial + 3, "Responder must be credited 3 credits");

    // Clean up / restore test users
    await supabase.from("users").update({ wallet: u1Initial, profile_digest: u1.profile_digest }).eq("id", u1.id);
    await supabase.from("users").update({ wallet: u2Initial, profile_digest: u2.profile_digest }).eq("id", u2.id);
  });

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
