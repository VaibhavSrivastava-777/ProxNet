import assert from "assert";
import {
  isProfileComplete,
  isProfileIncomplete,
  calculateProfileCompleteness,
  prioritizeUsersByProfileCompleteness,
} from "../lib/profile-validation";
import { checkEmailRateLimit, recordEmailSent } from "../lib/email-templates";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("=================================================================");
  console.log("   TEST SUITE: RESEND EMAIL PRIORITIZATION FOR COMPLETE PROFILES ");
  console.log("=================================================================\n");

  // TEST 1: Profile Completeness Helper Validation
  console.log("Test 1: isProfileComplete and calculateProfileCompleteness");
  const completeUser = {
    id: "usr_comp_1",
    full_name: "Anita Sharma",
    email: "anita@example.com",
    job_title: "Staff Engineer",
    company: "Google",
    home_lat: 12.9716,
    home_lng: 77.5946,
    resume_text: "Experienced distributed systems engineer with 10 years experience",
    linkedin_profile_url: "https://linkedin.com/in/anita",
    profile_photo_url: "https://example.com/photo.jpg",
    professional_bio: "Passionate about high-throughput networking",
  };

  const partialUser = {
    id: "usr_part_2",
    full_name: "Rahul Verma",
    email: "rahul@example.com",
    job_title: "Product Manager",
    company: "Microsoft",
    home_lat: null,
    home_lng: null, // missing home location
    resume_text: "PM with 5 years experience",
  };

  const emptyUser = {
    id: "usr_empty_3",
    email: "empty@example.com",
  };

  assert.strictEqual(isProfileComplete(completeUser), true, "completeUser should be recognized as complete");
  assert.strictEqual(isProfileIncomplete(completeUser), false, "completeUser should not be incomplete");
  assert.strictEqual(isProfileComplete(partialUser), false, "partialUser should be recognized as incomplete");
  assert.strictEqual(isProfileComplete(emptyUser), false, "emptyUser should be recognized as incomplete");

  const completeScore = calculateProfileCompleteness(completeUser);
  const partialScore = calculateProfileCompleteness(partialUser);
  const emptyScore = calculateProfileCompleteness(emptyUser);

  console.log(`  - Complete profile score: ${completeScore}%`);
  console.log(`  - Partial profile score: ${partialScore}%`);
  console.log(`  - Empty profile score: ${emptyScore}%`);
  assert(completeScore >= 80, "Complete profile score should be >= 80%");
  assert(completeScore > partialScore, "Complete score must be higher than partial score");
  assert(partialScore > emptyScore, "Partial score must be higher than empty score");
  console.log("  ✅ Test 1 Passed.\n");

  // TEST 2: User Prioritization Queue Ordering
  console.log("Test 2: prioritizeUsersByProfileCompleteness Batch Ordering");
  const testBatch = [
    { ...emptyUser, id: "empty" },
    { ...partialUser, id: "partial" },
    { ...completeUser, id: "complete_100", resume_url: "https://example.com/res.pdf" },
    {
      id: "complete_basic",
      full_name: "Siddharth Sen",
      email: "sid@example.com",
      job_title: "Developer",
      company: "Flipkart",
      home_lat: 12.93,
      home_lng: 77.62,
    },
  ];

  const prioritized = prioritizeUsersByProfileCompleteness(testBatch);
  console.log("  Order of users in prioritized batch:");
  prioritized.forEach((u, idx) => {
    console.log(`    [${idx + 1}] User ${u.id} (complete: ${isProfileComplete(u)}, score: ${calculateProfileCompleteness(u)}%)`);
  });

  // Complete profiles must always be first
  assert.strictEqual(isProfileComplete(prioritized[0]), true, "First user in queue must have complete profile");
  assert.strictEqual(isProfileComplete(prioritized[1]), true, "Second user in queue must have complete profile");
  assert.strictEqual(isProfileComplete(prioritized[2]), false, "Third user in queue must be incomplete profile");
  assert.strictEqual(isProfileComplete(prioritized[3]), false, "Fourth user in queue must be incomplete profile");

  // Within complete profiles, higher score comes first
  assert.strictEqual(prioritized[0].id, "complete_100", "Highest completeness user must be #1");
  assert.strictEqual(prioritized[1].id, "complete_basic", "Basic complete user must be #2");

  // Within incomplete profiles, partial profile comes before empty profile
  assert.strictEqual(prioritized[2].id, "partial", "Partial incomplete user must come before empty");
  assert.strictEqual(prioritized[3].id, "empty", "Empty profile user must come last");
  console.log("  ✅ Test 2 Passed.\n");

  // TEST 3: Email Rate Limiter Prioritization & Deprioritization
  console.log("Test 3: checkEmailRateLimit for Complete vs Incomplete Profiles");

  const completedUserId = "user_complete_priority_test";
  const incompleteUserId = "user_incomplete_priority_test";

  // 3A: Complete profile receives detailed job brief and digest
  const completeCheck1 = checkEmailRateLimit(completedUserId, "morning_job_brief", {
    isProfileComplete: true,
    completenessScore: 90,
  });
  console.log(`  - Complete profile morning_job_brief: allowed = ${completeCheck1.allowed}, priority = ${completeCheck1.priority}`);
  assert.strictEqual(completeCheck1.allowed, true, "Complete profile should be allowed morning_job_brief");
  assert.strictEqual(completeCheck1.priority, "high", "Complete profile should receive high priority");

  // 3B: Incomplete profile receives generic activity digest -> Should be DEPRIORITIZED / SUPPRESSED
  const incompleteCheck1 = checkEmailRateLimit(incompleteUserId, "weekly_digest_activity", {
    isProfileComplete: false,
    completenessScore: 20,
  });
  console.log(`  - Incomplete profile weekly_digest_activity: allowed = ${incompleteCheck1.allowed}, reason = "${incompleteCheck1.reason}"`);
  assert.strictEqual(incompleteCheck1.allowed, false, "Incomplete profile non-essential digest should be suppressed");
  assert(incompleteCheck1.reason?.includes("Deprioritized"), "Reason should indicate deprioritization for complete profiles");

  // 3C: Incomplete profile receives critical peer message (e.g. chat or direct question) -> Allowed!
  const incompletePeerCheck = checkEmailRateLimit(incompleteUserId, "chat_message", {
    isProfileComplete: false,
    completenessScore: 20,
  });
  console.log(`  - Incomplete profile chat_message: allowed = ${incompletePeerCheck.allowed}`);
  assert.strictEqual(incompletePeerCheck.allowed, true, "Incomplete profile must still receive direct peer chat messages");

  // 3D: Incomplete profile receives profile completion reminder -> Allowed (up to 1/day)
  const incompleteReminderCheck = checkEmailRateLimit(incompleteUserId, "profile_reminder", {
    isProfileComplete: false,
    completenessScore: 20,
  });
  console.log(`  - Incomplete profile profile_reminder: allowed = ${incompleteReminderCheck.allowed}`);
  assert.strictEqual(incompleteReminderCheck.allowed, true, "Incomplete profile must be allowed 1 profile completion reminder per day");

  // Simulate recordEmailSent for incomplete profile
  recordEmailSent(incompleteUserId, "profile_reminder");

  // Next non-essential email for incomplete profile should now be throttled (daily cap of 1 reached)
  const incompleteSecondCheck = checkEmailRateLimit(incompleteUserId, "job_match", {
    isProfileComplete: false,
    completenessScore: 20,
  });
  console.log(`  - Incomplete profile second email (job_match): allowed = ${incompleteSecondCheck.allowed}, reason = "${incompleteSecondCheck.reason}"`);
  assert.strictEqual(incompleteSecondCheck.allowed, false, "Incomplete profile should be capped at 1 email per day");
  assert(incompleteSecondCheck.reason?.includes("Daily email limit (1) reached for incomplete profile"));

  // Complete profile still has headroom
  recordEmailSent(completedUserId, "morning_job_brief");
  const completeSecondCheck = checkEmailRateLimit(completedUserId, "job_match", {
    isProfileComplete: true,
    completenessScore: 90,
  });
  console.log(`  - Complete profile second email (job_match): allowed = ${completeSecondCheck.allowed}, priority = ${completeSecondCheck.priority}`);
  assert.strictEqual(completeSecondCheck.allowed, true, "Complete profile should continue to receive emails within high limit");
  console.log("  ✅ Test 3 Passed.\n");

  // TEST 4: Codebase Verification for Cron Integration & Resend Priority Headers
  console.log("Test 4: Codebase Integration Verification");
  const notificationsPath = path.resolve(process.cwd(), "lib/notifications.ts");
  const notifSrc = fs.readFileSync(notificationsPath, "utf-8");

  assert(notifSrc.includes("isProfileComplete(user)"), "lib/notifications.ts checks isProfileComplete");
  assert(notifSrc.includes("userProfileComplete ? \"1\" : \"3\""), "lib/notifications.ts sets X-Priority header based on profile completeness");
  assert(notifSrc.includes("name: \"profile_complete\""), "lib/notifications.ts tags Resend emails with profile_complete");
  console.log("  - lib/notifications.ts verified: Includes priority headers, Resend tags, and profile completeness validation.");

  // Verify cron jobs use prioritizeUsersByProfileCompleteness
  const cronFiles = [
    "lib/notifications/daily-proximity-and-jobs.ts",
    "app/api/cron/job-matches/route.ts",
    "app/api/cron/job-digest/route.ts",
    "app/api/cron/referral-nudges/route.ts",
    "app/api/cron/morning-reminders/route.ts",
    "lib/cronBroadcast.ts",
  ];

  for (const relPath of cronFiles) {
    const fullPath = path.resolve(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert(
      content.includes("prioritizeUsersByProfileCompleteness"),
      `${relPath} must use prioritizeUsersByProfileCompleteness to process complete profiles first`
    );
    console.log(`  - ${relPath} verified: Uses prioritizeUsersByProfileCompleteness.`);
  }

  console.log("  ✅ Test 4 Passed.\n");

  console.log("=================================================================");
  console.log("   ALL RESEND PROFILE PRIORITIZATION TESTS PASSED SUCCESSFULLY!  ");
  console.log("=================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
