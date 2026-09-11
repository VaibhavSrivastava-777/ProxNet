/**
 * Validation test suite for Notification Center implementation
 * 
 * Verifies:
 * 1. Category color codes and metadata (Jobs, Chats, Events, Carpool, Forum, Growth, System)
 * 2. NavClient placement beside theme toggle in both desktop and mobile views
 * 3. In-App notification schema and PATCH /api/notifications endpoint compatibility
 * 4. Click-to-read and deep-linking routing logic
 */

import { getNotificationMeta } from "../components/NotificationCenter";
import * as fs from "fs";
import * as path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runValidation() {
  console.log("=== STEP 1: Validating Category Color Codes & Metadata ===");

  // 1. Job Notification
  const jobMeta = getNotificationMeta(
    "🔥 Strong Job Match (85%): Senior Engineer at Google",
    "High match with your profile. Tap to apply!",
    "/jobs?jobId=123"
  );
  assert(jobMeta.category === "job", "Job matches classified as 'job'");
  assert(jobMeta.icon === "💼", "Job icon is briefcase 💼");
  assert(jobMeta.badgeClass.includes("emerald"), "Job badge uses emerald color scheme");
  assert(jobMeta.accentBorder.includes("emerald"), "Job border uses emerald accent");

  // 2. Chat Notification
  const chatMeta = getNotificationMeta(
    "New Message from Sneha",
    "Hey, are you attending the meetup today?",
    "/chat/sess_abc123"
  );
  assert(chatMeta.category === "chat", "Chat message classified as 'chat'");
  assert(chatMeta.icon === "💬", "Chat icon is speech bubble 💬");
  assert(chatMeta.badgeClass.includes("sky"), "Chat badge uses sky blue color scheme");
  assert(chatMeta.accentBorder.includes("sky"), "Chat border uses sky accent");

  // 3. Meetup / Event Notification
  const eventMeta = getNotificationMeta(
    "Tech Founders Meetup starts in 24 hours",
    "Join 15 professionals at Starbucks Koramangala",
    "/event/evt_789"
  );
  assert(eventMeta.category === "event", "Meetup classified as 'event'");
  assert(eventMeta.icon === "📅", "Event icon is calendar 📅");
  assert(eventMeta.badgeClass.includes("amber"), "Event badge uses amber color scheme");
  assert(eventMeta.accentBorder.includes("amber"), "Event border uses amber accent");

  // 4. Carpool Notification
  const carpoolMeta = getNotificationMeta(
    "Carpool Ride Request",
    "Someone accepted your ride from Whitefield",
    "/carpool/chat/cp_456"
  );
  assert(carpoolMeta.category === "carpool", "Carpool classified as 'carpool'");
  assert(carpoolMeta.icon === "🚗", "Carpool icon is car 🚗");
  assert(carpoolMeta.badgeClass.includes("teal"), "Carpool badge uses teal color scheme");
  assert(carpoolMeta.accentBorder.includes("teal"), "Carpool border uses teal accent");

  // 5. Forum / Q&A Notification
  const forumMeta = getNotificationMeta(
    "New answer in Community Forum",
    "Your question about Bangalore traffic received 3 answers",
    "/qa?tab=questions"
  );
  assert(forumMeta.category === "forum", "Forum Q&A classified as 'forum'");
  assert(forumMeta.icon === "❓", "Forum icon is question ❓");
  assert(forumMeta.badgeClass.includes("violet"), "Forum badge uses violet color scheme");
  assert(forumMeta.accentBorder.includes("violet"), "Forum border uses violet accent");

  // 6. Network Growth Notification
  const growthMeta = getNotificationMeta(
    "You gained 5 new followers!",
    "Your neighborhood network is growing. +50 points earned",
    "/profile"
  );
  assert(growthMeta.category === "growth", "Network growth classified as 'growth'");
  assert(growthMeta.icon === "🎉", "Growth icon is celebration 🎉");
  assert(growthMeta.badgeClass.includes("pink"), "Growth badge uses pink color scheme");
  assert(growthMeta.accentBorder.includes("pink"), "Growth border uses pink accent");

  // 7. System Notification
  const systemMeta = getNotificationMeta(
    "Welcome to ProxNet!",
    "Complete your profile to get matched with professionals nearby.",
    "/"
  );
  assert(systemMeta.category === "system", "Generic alert classified as 'system'");
  assert(systemMeta.icon === "🔔", "System icon is bell 🔔");
  assert(systemMeta.badgeClass.includes("slate"), "System badge uses slate color scheme");

  console.log("\n=== STEP 2: Validating NavClient Layout & Placement ===");
  const navClientPath = path.resolve(__dirname, "../components/NavClient.tsx");
  const navClientContent = fs.readFileSync(navClientPath, "utf-8");

  assert(navClientContent.includes('import { NotificationCenter } from "./NotificationCenter";'), "NotificationCenter is imported in NavClient.tsx");

  // Verify Desktop placement beside theme toggle
  const desktopThemeToggleIndex = navClientContent.indexOf('data-tour="theme-toggle"');
  assert(desktopThemeToggleIndex !== -1, "Found theme-toggle button");

  const desktopSnippet = navClientContent.substring(desktopThemeToggleIndex, desktopThemeToggleIndex + 800);
  assert(desktopSnippet.includes("<NotificationCenter"), "NotificationCenter is rendered beside theme-toggle in desktop navbar");
  assert(desktopSnippet.includes("isOpen={desktopNotificationsOpen}"), "Desktop NotificationCenter is bound to desktopNotificationsOpen");

  // Verify Mobile placement beside theme toggle
  const mobileThemeToggleIndex = navClientContent.indexOf('data-tour="theme-toggle"', desktopThemeToggleIndex + 100);
  assert(mobileThemeToggleIndex !== -1, "Found mobile theme-toggle button");

  const mobileSnippet = navClientContent.substring(mobileThemeToggleIndex, mobileThemeToggleIndex + 800);
  assert(mobileSnippet.includes("<NotificationCenter"), "NotificationCenter is rendered beside theme-toggle in mobile navbar");
  assert(mobileSnippet.includes("isOpen={mobileNotificationsOpen}"), "Mobile NotificationCenter is bound to mobileNotificationsOpen");

  console.log("\n=== STEP 3: Validating Deep-linking & Realtime Sync ===");
  assert(navClientContent.includes(".channel(\"in-app-notifications\")"), "Realtime in-app-notifications channel is subscribed");
  assert(navClientContent.includes("setInAppNotifications((prev) =>"), "Incoming realtime notifications are prepended to state");
  assert(navClientContent.includes('method: "PATCH"'), "Mark as read fires PATCH /api/notifications");
  assert(navClientContent.includes("router.push(url)"), "Clicking notification deep-links via router.push");

  console.log("\n✅ ALL NOTIFICATION CENTER VALIDATIONS PASSED SUCCESSFULLY!");
}

runValidation().catch((err) => {
  console.error(err);
  process.exit(1);
});
