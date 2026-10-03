import assert from "assert";
import { checkEmailRateLimit, recordEmailSent, generateContextEmail } from "../lib/email-templates";

async function runValidationTests() {
  console.log("==================================================================");
  console.log("🧪 VALIDATION TEST: Rate Limit Updates & Profile Clubbing");
  console.log("==================================================================\n");

  // TEST 1: Hard Daily Email Cap is Removed
  console.log("[Test 1] Verifying hard daily email cap is removed...");
  const user1 = `test-user-daily-cap-${Date.now()}`;
  for (let i = 1; i <= 25; i++) {
    const result = checkEmailRateLimit(user1, `custom_notif_${i}`);
    assert.strictEqual(
      result.allowed,
      true,
      `Email ${i} should be allowed because hard daily cap is removed (got: ${result.reason})`
    );
    recordEmailSent(user1, `custom_notif_${i}`);
  }
  console.log("✅ Passed: User dispatched 25 consecutive daily emails without hitting any daily cap.\n");

  // TEST 2: Digest Cooldown is Removed
  console.log("[Test 2] Verifying digest cooldown is removed...");
  const user2 = `test-user-digest-cooldown-${Date.now()}`;
  const digestTypes = [
    "weekly_digest_top_roles",
    "daily_engagement_nudge",
    "referral_network_nudge",
    "weekly_digest_community",
  ];

  for (const dtype of digestTypes) {
    const res1 = checkEmailRateLimit(user2, dtype);
    assert.strictEqual(res1.allowed, true, `First ${dtype} should be allowed`);
    recordEmailSent(user2, dtype);

    // Immediately check again (0ms delay) - previously blocked by 4-hour cooldown
    const res2 = checkEmailRateLimit(user2, dtype);
    assert.strictEqual(
      res2.allowed,
      true,
      `Subsequent ${dtype} should be allowed immediately with digest cooldown removed`
    );
  }
  console.log("✅ Passed: Consecutive digests and nudges dispatched without 4-hour cooldown.\n");

  // TEST 3: Real-Time Chat Cooldown Preserved (Anti-spam for rapid back-and-forth)
  console.log("[Test 3] Verifying chat cooldown behavior...");
  const user3 = `test-user-chat-${Date.now()}`;
  const chatCheck1 = checkEmailRateLimit(user3, "chat_message");
  assert.strictEqual(chatCheck1.allowed, true, "First chat email allowed");
  recordEmailSent(user3, "chat_message");

  const chatCheck2 = checkEmailRateLimit(user3, "chat_message");
  assert.strictEqual(chatCheck2.allowed, false, "Immediate second chat email in same minute suppressed");
  assert(chatCheck2.reason?.includes("Chat email cooldown active"), "Reason cites chat cooldown");

  const chatForce = checkEmailRateLimit(user3, "chat_message", true);
  assert.strictEqual(chatForce.allowed, true, "forceEmail: true bypasses chat cooldown");
  console.log("✅ Passed: Chat rapid-fire cooldown behaves as expected.\n");

  // TEST 4: Morning Top 3 Jobs Email Template & Clubbed Profile Completion
  console.log("[Test 4] Verifying Morning Top 3 Jobs email template with clubbed profile banner...");

  // 4A: Incomplete Profile Case (Missing resume & location)
  const incompleteJobEmail = generateContextEmail({
    recipientName: "Alex Morgan",
    recipientEmail: "alex@example.com",
    title: "🎯 Top 3 Job Opportunities Today",
    body: "1. Senior Frontend Engineer @ Stripe (92%) | 2. Lead Product Designer @ Figma (88%) | 3. Staff Architect @ Uber (85%)",
    url: "/jobs?highlight=job-stripe-123&wizard=profile",
    data: {
      type: "daily_top_3_jobs",
      jobIds: ["job-stripe-123", "job-figma-456", "job-uber-789"],
      scores: [92, 88, 85],
      incompleteProfile: true,
      missingProfileFields: ["resume", "location"],
    },
  });

  assert(
    incompleteJobEmail.html.includes("TOP 3 DAILY JOBS"),
    "Email contains TOP 3 DAILY JOBS badge"
  );
  assert(
    incompleteJobEmail.html.includes("Boost Your Job Match Accuracy"),
    "Email clubs the profile completion card when profile is incomplete"
  );
  assert(
    incompleteJobEmail.html.includes("resume &amp; location") || incompleteJobEmail.html.includes("resume & location"),
    "Email mentions specific missing profile fields"
  );
  assert(
    incompleteJobEmail.html.includes("Complete Profile"),
    "Email includes Complete Profile CTA button"
  );
  console.log("✅ Passed: Incomplete profile correctly clubs profile completion card into Top 3 email.");

  // 4B: Complete Profile Case
  const completeJobEmail = generateContextEmail({
    recipientName: "Taylor Swift",
    recipientEmail: "taylor@example.com",
    title: "🎯 Top 3 Job Opportunities Today",
    body: "1. VP Engineering @ Microsoft (96%) | 2. Director of Ops @ Google (94%) | 3. Principal Architect @ Amazon (91%)",
    url: "/jobs?highlight=job-msft-001",
    data: {
      type: "daily_top_3_jobs",
      jobIds: ["job-msft-001", "job-goog-002", "job-amzn-003"],
      scores: [96, 94, 91],
      incompleteProfile: false,
      missingProfileFields: [],
    },
  });

  assert(
    completeJobEmail.html.includes("TOP 3 DAILY JOBS"),
    "Complete profile email contains TOP 3 DAILY JOBS badge"
  );
  assert(
    !completeJobEmail.html.includes("Boost Your Job Match Accuracy"),
    "Complete profile email does NOT include the profile completion nudge"
  );
  console.log("✅ Passed: Complete profile email does not show unnecessary profile completion banner.\n");

  // TEST 5: Morning Job Brief with Clubbed Profile Guidance
  console.log("[Test 5] Verifying Morning Job Brief email template...");
  const briefEmail = generateContextEmail({
    recipientName: "Priya Sharma",
    recipientEmail: "priya@example.com",
    title: "🌅 Morning Brief: 3 Strong Matches found!",
    body: "3 new 75%+ matches for your profile. 14 total new roles across 5 companies. 💡 Tip: Add your current designation to sharpen match accuracy & direct referrals!",
    url: "/jobs?morning_brief=1&wizard=profile",
    data: {
      type: "morning_job_brief",
      newJobCount: 14,
      strongMatchCount: 3,
      incompleteProfile: true,
      missingProfileFields: ["current designation"],
    },
  });

  assert(
    briefEmail.html.includes("Boost Your Job Match Accuracy"),
    "Morning Job Brief clubs profile completion banner when incomplete"
  );
  assert(
    briefEmail.html.includes("current designation"),
    "Morning Job Brief identifies current designation as missing field"
  );
  console.log("✅ Passed: Morning Job Brief clubs profile completion guidance properly.\n");

  console.log("==================================================================");
  console.log("🎉 ALL VALIDATION TESTS PASSED SUCCESSFULLY!                      ");
  console.log("==================================================================");
}

runValidationTests().catch((err) => {
  console.error("❌ Validation test failed:", err);
  process.exit(1);
});
