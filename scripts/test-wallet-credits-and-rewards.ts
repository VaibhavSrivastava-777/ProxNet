import { createAdminClient } from "@/lib/supabase/admin";
import { awardWalletCredits, CREDIT_REWARDS } from "@/lib/wallet";
import assert from "assert";

async function runTest() {
  console.log("=== Starting Wallet Credits & Rewards Validation ===");
  const supabase = createAdminClient();

  // Find or create a test user
  const { data: testUser, error: userError } = await supabase
    .from("users")
    .select("id, email, wallet, profile_digest")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (userError || !testUser) {
    console.error("No test user found to validate wallet rewards:", userError);
    process.exit(1);
  }

  console.log(`Testing with user: ${testUser.email} (${testUser.id})`);
  const initialWallet = testUser.wallet ?? 0;
  const initialDigest = testUser.profile_digest || {};

  try {
    // 1. Test Push Notification Enable Reward (+5 credits)
    console.log("\n--- 1. Testing Push Notifications Enable Reward ---");
    // Reset push claim status for this test
    await supabase.from("users").update({
      profile_digest: { ...initialDigest, push_reward_claimed: false }
    }).eq("id", testUser.id);

    const pushReward1 = await awardWalletCredits(testUser.id, "push_notifications_enabled");
    assert(pushReward1.success === true, "First push reward should succeed");
    assert(pushReward1.creditsAwarded === CREDIT_REWARDS.push_notifications_enabled.amount, "Should award 5 credits");
    console.log(`✓ Push reward awarded successfully (+${pushReward1.creditsAwarded} credits, new balance: ${pushReward1.newBalance})`);

    // Deduplication check: second claim should be rejected
    const pushReward2 = await awardWalletCredits(testUser.id, "push_notifications_enabled");
    assert(pushReward2.success === false, "Second push reward claim must be blocked");
    assert(pushReward2.creditsAwarded === 0, "Duplicate claim should award 0 credits");
    console.log("✓ Push reward deduplication passed");

    // 2. Test Sharing a Job Opportunity Reward (+5 credits)
    console.log("\n--- 2. Testing Shared Job Opportunity Reward ---");
    const testJobId = "test-job-" + Date.now();
    const jobReward1 = await awardWalletCredits(testUser.id, "shared_job_opportunity", testJobId);
    assert(jobReward1.success === true, "Job opportunity reward should succeed");
    assert(jobReward1.creditsAwarded === CREDIT_REWARDS.shared_job_opportunity.amount, "Should award 5 credits");
    console.log(`✓ Job share reward awarded successfully (+${jobReward1.creditsAwarded} credits)`);

    // Deduplication on same job
    const jobReward2 = await awardWalletCredits(testUser.id, "shared_job_opportunity", testJobId);
    assert(jobReward2.success === false && jobReward2.creditsAwarded === 0, "Duplicate job reward must award 0 credits");
    console.log("✓ Job share deduplication passed");

    // 3. Test Responding to Referral Ask Reward (+5 credits)
    console.log("\n--- 3. Testing Responding to Referral Ask Reward ---");
    const testThreadId = "test-thread-" + Date.now();
    const referralReward1 = await awardWalletCredits(testUser.id, "responded_referral_ask", testThreadId);
    assert(referralReward1.success === true, "Referral response reward should succeed");
    assert(referralReward1.creditsAwarded === CREDIT_REWARDS.responded_referral_ask.amount, "Should award 5 credits");
    console.log(`✓ Referral ask response reward awarded successfully (+${referralReward1.creditsAwarded} credits)`);

    // Deduplication on same thread
    const referralReward2 = await awardWalletCredits(testUser.id, "responded_referral_ask", testThreadId);
    assert(referralReward2.success === false && referralReward2.creditsAwarded === 0, "Duplicate referral ask reward must award 0 credits");
    console.log("✓ Referral ask response deduplication passed");

    // 4. Test Answering a Career Question Reward (+3 credits)
    console.log("\n--- 4. Testing Answering Career Question Reward ---");
    const testQuestionId = "test-q-" + Date.now();
    const questionReward1 = await awardWalletCredits(testUser.id, "answered_career_question", testQuestionId);
    assert(questionReward1.success === true, "Career question reward should succeed");
    assert(questionReward1.creditsAwarded === CREDIT_REWARDS.answered_career_question.amount, "Should award 3 credits");
    console.log(`✓ Question response reward awarded successfully (+${questionReward1.creditsAwarded} credits)`);

    // Deduplication on same question
    const questionReward2 = await awardWalletCredits(testUser.id, "answered_career_question", testQuestionId);
    assert(questionReward2.success === false && questionReward2.creditsAwarded === 0, "Duplicate question reward must award 0 credits");
    console.log("✓ Career question response deduplication passed");

    console.log("\n--- 5. Static Code & Integration Assertions ---");
    const fs = await import("fs");

    // Check fcm register route
    const fcmCode = fs.readFileSync("app/api/fcm/register/route.ts", "utf-8");
    assert(fcmCode.includes("awardWalletCredits"), "FCM register route must import and call awardWalletCredits");
    assert(fcmCode.includes("push_notifications_enabled"), "FCM register route must award push_notifications_enabled");
    console.log("✓ FCM register route awards credits");

    // Check job-posts route
    const jobPostCode = fs.readFileSync("app/api/job-posts/route.ts", "utf-8");
    assert(jobPostCode.includes("shared_job_opportunity"), "job-posts route must award shared_job_opportunity");
    console.log("✓ job-posts route awards credits");

    // Check chat send route
    const chatSendCode = fs.readFileSync("app/api/jobs/chat/send/route.ts", "utf-8");
    assert(chatSendCode.includes("responded_referral_ask"), "chat send route must award responded_referral_ask");
    console.log("✓ jobs/chat/send route awards credits");

    // Check questions respond route
    const qRespondCode = fs.readFileSync("app/api/questions/respond/route.ts", "utf-8");
    assert(qRespondCode.includes("answered_career_question"), "questions/respond route must award answered_career_question");
    console.log("✓ questions/respond route awards credits");

    // Check RechargeModal
    const rechargeCode = fs.readFileSync("components/RechargeModal.tsx", "utf-8");
    assert(rechargeCode.includes("currentBalance"), "RechargeModal must calculate and use currentBalance");
    assert(rechargeCode.includes("Earn Free Community Credits"), "RechargeModal must display community earning actions");
    console.log("✓ RechargeModal dynamically reflects balance and rewards");

    // Check NavClient
    const navCode = fs.readFileSync("components/NavClient.tsx", "utf-8");
    assert(navCode.includes("fetchWalletBalance"), "NavClient must implement fetchWalletBalance");
    assert(navCode.includes("proxnet_low_credits_login_warned"), "NavClient must check low credits on login");
    assert(navCode.includes("proxnet:wallet-updated"), "NavClient must listen to proxnet:wallet-updated event");
    console.log("✓ NavClient fetches wallet balance, triggers low-credits login toast, and handles updates");

    // Check ProfileForm
    const profileCode = fs.readFileSync("components/profile/ProfileForm.tsx", "utf-8");
    assert(profileCode.includes("setShowRechargeModal"), "ProfileForm must toggle RechargeModal");
    assert(profileCode.includes("RechargeModal"), "ProfileForm must render RechargeModal");
    assert(profileCode.includes("Credits"), "ProfileForm must display Credits");
    console.log("✓ ProfileForm displays Credits and opens RechargeModal with current balance");

    console.log("\n=== All Wallet Reward Actions and Deduplications Validated Successfully! ===");
  } finally {
    // Restore user wallet and profile_digest to clean up
    await supabase.from("users").update({
      wallet: initialWallet,
      profile_digest: initialDigest,
    }).eq("id", testUser.id);
    console.log("Cleaned up test user state.");
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
