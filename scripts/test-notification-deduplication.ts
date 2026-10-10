import assert from "assert";
import fs from "fs";
import path from "path";
import {
  deduplicateNotifications,
  getNotificationDeduplicationKey,
} from "../lib/notification-deduplication";
import { generateContextEmail } from "../lib/email-templates";

async function runTests() {
  console.log("==================================================");
  console.log("   TESTING NOTIFICATION DEDUPLICATION LOGIC       ");
  console.log("==================================================");

  // ── TEST 1: Profile completion notifications deduplication (yesterday vs today) ──
  console.log("\n[Test 1] Profile completion reminder deduplication across days...");
  const profileNotifs = [
    {
      id: "notif-yesterday",
      user_id: "user-1",
      title: "Complete your profile",
      body: "Please add your designation and company to unlock full access.",
      url: "/qa?wizard=profile",
      is_read: false,
      created_at: "2026-10-09T10:00:00.000Z",
    },
    {
      id: "notif-today",
      user_id: "user-1",
      title: "Reminder: Complete your professional profile",
      body: "Add your latest experience to earn 50 bonus credits.",
      url: "/profile",
      is_read: false,
      created_at: "2026-10-10T09:30:00.000Z",
    },
  ];

  const dedupedProfile = deduplicateNotifications(profileNotifs);
  assert.strictEqual(dedupedProfile.length, 1, "Must collapse profile reminders to exactly 1");
  assert.strictEqual(dedupedProfile[0].id, "notif-today", "Must keep the latest notification (today's)");
  assert.strictEqual(dedupedProfile[0].url, "/profile", "Must preserve latest URL");
  console.log("✅ Passed: Profile completion notifications deduplicated to latest set.");

  // ── TEST 2: Unread status propagation ──
  console.log("\n[Test 2] Unread status preservation when latest is read but older was unread...");
  const mixedReadNotifs = [
    {
      id: "notif-old",
      user_id: "user-1",
      title: "Complete your profile",
      body: "Old body",
      url: "/profile",
      is_read: false, // User never read this
      created_at: "2026-10-08T10:00:00.000Z",
    },
    {
      id: "notif-new",
      user_id: "user-1",
      title: "Complete your profile",
      body: "New body",
      url: "/profile",
      is_read: true,
      created_at: "2026-10-10T10:00:00.000Z",
    },
  ];

  const dedupedMixed = deduplicateNotifications(mixedReadNotifs);
  assert.strictEqual(dedupedMixed.length, 1);
  assert.strictEqual(dedupedMixed[0].is_read, false, "Should preserve unread status so action is not lost");
  console.log("✅ Passed: Unread status properly preserved.");

  // ── TEST 3: Chat and messaging thread deduplication ──
  console.log("\n[Test 3] Chat and direct messaging thread deduplication...");
  const chatNotifs = [
    {
      id: "chat-msg-1",
      user_id: "user-1",
      title: "New conversation waiting from Sarah @ Google",
      body: "Hey, are you free for a chai chat?",
      url: "/chat/session-abc-123",
      is_read: false,
      created_at: "2026-10-09T08:00:00.000Z",
    },
    {
      id: "chat-msg-2",
      user_id: "user-1",
      title: "New message from Sarah @ Google",
      body: "Following up on yesterday's invite!",
      url: "/chat/session-abc-123",
      is_read: false,
      created_at: "2026-10-10T11:00:00.000Z",
    },
    {
      id: "chat-msg-different-person",
      user_id: "user-1",
      title: "New message from Alex @ Microsoft",
      body: "Saw your profile on ProxNet!",
      url: "/chat/session-xyz-789",
      is_read: false,
      created_at: "2026-10-10T12:00:00.000Z",
    },
  ];

  const dedupedChat = deduplicateNotifications(chatNotifs);
  assert.strictEqual(dedupedChat.length, 2, "2 distinct chat threads should remain");
  const thread1 = dedupedChat.find((c) => c.url === "/chat/session-abc-123");
  assert(thread1, "Thread abc-123 must be present");
  assert.strictEqual(thread1.id, "chat-msg-2", "Must preserve latest message for thread abc-123");
  console.log("✅ Passed: Chat notifications deduplicated by thread ID.");

  // ── TEST 4: Daily Top Jobs Digest deduplication ──
  console.log("\n[Test 4] Daily Top Job Opportunities deduplication...");
  const jobDigestNotifs = [
    {
      id: "job-digest-day1",
      user_id: "user-1",
      title: "🎯 Top 3 Job Opportunities Today",
      body: "Engineering Manager at Uber, Staff Engineer at Atlassian",
      url: "/jobs?highlight=job-1&wizard=profile",
      is_read: false,
      created_at: "2026-10-08T04:40:00.000Z",
    },
    {
      id: "job-digest-day2",
      user_id: "user-1",
      title: "🎯 Top 3 Job Opportunities Today",
      body: "Principal Architect at Microsoft, Tech Lead at Swiggy",
      url: "/jobs?highlight=job-2&wizard=profile",
      is_read: false,
      created_at: "2026-10-09T04:40:00.000Z",
    },
    {
      id: "job-digest-day3",
      user_id: "user-1",
      title: "🎯 Top 3 Job Opportunities Today",
      body: "Director of Engineering at Google",
      url: "/jobs?highlight=job-3&wizard=profile",
      is_read: false,
      created_at: "2026-10-10T04:40:00.000Z",
    },
  ];

  const dedupedJobs = deduplicateNotifications(jobDigestNotifs);
  assert.strictEqual(dedupedJobs.length, 1, "Must collapse repeated daily job digests into the latest one");
  assert.strictEqual(dedupedJobs[0].id, "job-digest-day3", "Must keep day 3's digest");
  assert(dedupedJobs[0].body.includes("Google"), "Must show latest job summary");
  console.log("✅ Passed: Top job opportunities collapsed into latest set.");

  // ── TEST 5: Email "Also waiting for you" deduplication ──
  console.log("\n[Test 5] Email digest 'Also waiting for you' section deduplication...");
  const emailResult = generateContextEmail({
    recipientName: "Vaibhav",
    recipientEmail: "vaibhav@example.com",
    title: "New Connection Request",
    body: "Aditi @ Cisco wants to connect with you.",
    url: "/network",
    otherUnreadNotifs: [
      {
        id: "profile-1",
        title: "Complete your profile",
        body: "Unlock verified neighbor perks",
        url: "/profile",
        created_at: "2026-10-09T10:00:00.000Z",
      },
      {
        id: "profile-2",
        title: "Reminder: Complete profile",
        body: "Your profile is 60% complete",
        url: "/qa?wizard=profile",
        created_at: "2026-10-10T10:00:00.000Z",
      },
      {
        id: "chat-1",
        title: "Message from Rohan",
        body: "Let's grab a coffee at HSR layout",
        url: "/chat/rohan-session",
        created_at: "2026-10-10T11:00:00.000Z",
      },
    ],
  });

  // Verify header has 2 other updates (not 3!) because profile reminders were deduplicated
  assert(
    emailResult.html.includes("Also waiting for you (2 other updates)"),
    "Header must say 2 other updates after deduplicating the 2 profile reminders"
  );
  assert(emailResult.html.includes("Message from Rohan"), "Must include the distinct chat message");
  assert(
    emailResult.html.includes("Reminder: Complete profile"),
    "Must include the latest profile reminder"
  );
  assert(
    !emailResult.html.includes("Unlock verified neighbor perks"),
    "Older duplicate profile reminder body should be omitted"
  );
  console.log("✅ Passed: Email 'Also waiting for you' section deduplicated.");

  // ── TEST 6: Codebase Integration Verification ──
  console.log("\n[Test 6] Codebase file integration checks...");
  const cwd = process.cwd();

  const apiRoutePath = path.join(cwd, "app", "api", "notifications", "route.ts");
  const apiRouteContent = fs.readFileSync(apiRoutePath, "utf8");
  assert(apiRouteContent.includes("deduplicateNotifications"), "API route must import and use deduplicateNotifications");
  console.log("✓ app/api/notifications/route.ts verifies deduplicateNotifications usage");

  const notifsLibPath = path.join(cwd, "lib", "notifications.ts");
  const notifsLibContent = fs.readFileSync(notifsLibPath, "utf8");
  assert(notifsLibContent.includes("deduplicateNotifications"), "lib/notifications.ts must import and use deduplicateNotifications");
  console.log("✓ lib/notifications.ts verifies deduplicateNotifications usage");

  const emailTemplatesPath = path.join(cwd, "lib", "email-templates.ts");
  const emailTemplatesContent = fs.readFileSync(emailTemplatesPath, "utf8");
  assert(emailTemplatesContent.includes("deduplicateNotifications"), "lib/email-templates.ts must import and use deduplicateNotifications");
  console.log("✓ lib/email-templates.ts verifies deduplicateNotifications usage");

  const notifCenterPath = path.join(cwd, "components", "NotificationCenter.tsx");
  const notifCenterContent = fs.readFileSync(notifCenterPath, "utf8");
  assert(notifCenterContent.includes("deduplicateNotifications"), "components/NotificationCenter.tsx must import and use deduplicateNotifications");
  console.log("✓ components/NotificationCenter.tsx verifies deduplicateNotifications usage");

  const navClientPath = path.join(cwd, "components", "NavClient.tsx");
  const navClientContent = fs.readFileSync(navClientPath, "utf8");
  assert(navClientContent.includes("deduplicateNotifications"), "components/NavClient.tsx must import and use deduplicateNotifications");
  console.log("✓ components/NavClient.tsx verifies deduplicateNotifications usage");

  console.log("\n==================================================");
  console.log("🎉 ALL NOTIFICATION DEDUPLICATION TESTS PASSED!    ");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
