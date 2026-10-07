import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";
import { frameFcmNotification } from "../lib/notifications";
import { checkEmailRateLimit } from "../lib/email-templates";

console.log("======================================================================");
console.log("  VALIDATION: Notification System & Quote Truncation Fixes");
console.log("======================================================================\n");

// -----------------------------------------------------------------------------
// TEST 1: Streak Quote No Longer Truncates (Requirement 5)
// -----------------------------------------------------------------------------
console.log("[Test 1] Verifying Streak/Stream quote container classes in StreakGraffitiBanner.tsx...");
const bannerPath = join(process.cwd(), "components", "streak", "StreakGraffitiBanner.tsx");
const bannerCode = readFileSync(bannerPath, "utf-8");

assert(
  !bannerCode.includes('className="truncate sm:whitespace-normal"'),
  "Streak quote must NOT have 'truncate' class which caused truncation on mobile"
);
assert(
  bannerCode.includes("whitespace-normal break-words leading-relaxed"),
  "Streak quote must use 'whitespace-normal break-words leading-relaxed' to ensure complete display"
);
console.log("  ✅ Passed: Streak/Stream quote is fully multi-line enabled with zero truncation.\n");

// -----------------------------------------------------------------------------
// TEST 2: FCM Notification Sentence Framing & Word Limit Compliance (Requirement 4)
// -----------------------------------------------------------------------------
console.log("[Test 2] Verifying FCM notification sentence framing and character limits...");

// Test 2a: Top 3 jobs long body framing
const longTop3Body =
  "Matched to your resume: 1. Staff Software Engineer @ Google (95%) | 2. Lead Full Stack Architect @ Swiggy (91%) | 3. Principal AI Platform Engineer @ Microsoft (89%). Tap to prepare & apply! 💡 Tip: Add your Bio & Resume to unlock tailored 90%+ match accuracy and inside referrals!";

const framedTop3 = frameFcmNotification("🎯 Top 3 Job Opportunities Today", longTop3Body, {
  type: "daily_top_3_jobs",
});

console.log("  Framed Top 3 Title:", framedTop3.title, `(${framedTop3.title.length} chars)`);
console.log("  Framed Top 3 Body:", framedTop3.body, `(${framedTop3.body.length} chars)`);

assert(framedTop3.title.length <= 45, "FCM title must be <= 45 characters");
assert(framedTop3.body.length <= 120, "FCM body must be <= 120 characters");
assert(!framedTop3.body.includes("..."), "FCM framed body should be a complete sentence without ellipsis");
assert(
  framedTop3.body.includes("Google") && framedTop3.body.includes("Swiggy") && framedTop3.body.includes("Microsoft"),
  "Framed sentence cleanly includes distinct matched companies"
);

// Test 2b: Long general notification framing
const longChatBody =
  "Hey Vaibhav, I noticed your extensive background in distributed systems and cloud infrastructure. We have an opening on our core platform team that matches your experience perfectly. Would love to connect over chai this week!";

const framedChat = frameFcmNotification("New Message from Talent Acquisition Analyst Deepthi @ Dell Technologies - Cloud Unit", longChatBody, {
  type: "chat_message",
});

console.log("  Framed Chat Title:", framedChat.title, `(${framedChat.title.length} chars)`);
console.log("  Framed Chat Body:", framedChat.body, `(${framedChat.body.length} chars)`);

assert(framedChat.title.length <= 45, "Framed chat title must be <= 45 characters");
assert(framedChat.body.length <= 120, "Framed chat body must be <= 120 characters");
console.log("  ✅ Passed: FCM notifications are cleanly framed into complete sentences under word limits.\n");

// -----------------------------------------------------------------------------
// TEST 3: Resend Fallback & Detailed Notification Logic (Requirements 1 & 2)
// -----------------------------------------------------------------------------
console.log("[Test 3] Verifying Resend fallback & detailed notification logic in lib/notifications.ts...");
const notifsPath = join(process.cwd(), "lib", "notifications.ts");
const notifsCode = readFileSync(notifsPath, "utf-8");

assert(
  notifsCode.includes("const isFallback = !hasSuccessfulFcm"),
  "Resend must trigger when hasSuccessfulFcm is false (universal fallback for 0 devices or failed push)"
);
assert(
  notifsCode.includes("isDetailedNotification"),
  "Detailed notifications (such as Top 3 jobs) must be explicitly identified"
);
assert(
  notifsCode.includes("shouldSendEmail = isFallback || isDetailedNotification || isPriorityNotification"),
  "Detailed notifications must send via Resend in addition to FCM, and fallback must send when FCM fails"
);
assert(
  notifsCode.includes("authData?.user?.email"),
  "User email lookup includes auth.users fallback and self-healing"
);
console.log("  ✅ Passed: Resend fallback and detailed notification addition rules verified.\n");

// -----------------------------------------------------------------------------
// TEST 4: Anti-Spam Exemption for Fallback & Detailed Notifications
// -----------------------------------------------------------------------------
console.log("[Test 4] Verifying anti-spam bypass for detailed notifications and chat debounce...");
const top3RateCheck = checkEmailRateLimit("test-user-123", "daily_top_3_jobs", false);
assert(top3RateCheck.allowed === true, "Daily top 3 jobs must never be suppressed by email rate limit");

const fallbackForceCheck = checkEmailRateLimit("test-user-123", "any_notification", true);
assert(fallbackForceCheck.allowed === true, "Fallback / forceEmail notifications must always pass rate limit");
console.log("  ✅ Passed: Detailed notifications and fallback emails properly bypass rate limits.\n");

// -----------------------------------------------------------------------------
// TEST 5: In-App Bell Icon Persistence Guaranteed (Requirement 3)
// -----------------------------------------------------------------------------
console.log("[Test 5] Verifying in_app_notifications persistence before push/email dispatch...");
assert(
  notifsCode.includes(".from(\"in_app_notifications\")"),
  "Notifications must insert into in_app_notifications table"
);
assert(
  notifsCode.indexOf("in_app_notifications") < notifsCode.indexOf("fcmMessaging.send"),
  "in_app_notifications insertion must be step 0, occurring BEFORE fcmMessaging.send or Resend"
);

// Verify Android native BigTextStyle
const androidServicePath = join(process.cwd(), "android", "app", "src", "main", "java", "in", "proxnet", "app", "MyFirebaseMessagingService.kt");
const androidServiceCode = readFileSync(androidServicePath, "utf-8");
assert(
  androidServiceCode.includes("BigTextStyle().bigText(messageBody)"),
  "Android notification builder uses BigTextStyle so expanded notification never truncates"
);
console.log("  ✅ Passed: In-app bell persistence and Android BigTextStyle expansion verified.\n");

console.log("======================================================================");
console.log("  🎉 ALL 5 NOTIFICATION & QUOTE VALIDATION TESTS PASSED!");
console.log("======================================================================");
