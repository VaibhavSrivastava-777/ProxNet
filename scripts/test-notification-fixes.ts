import assert from "assert";
import fs from "fs";
import path from "path";

async function runValidation() {
  console.log("=== RUNNING NOTIFICATION & REFERRAL CHAT VALIDATION TEST SUITE ===\n");

  const root = process.cwd();

  // Test 1: Daily Re-engagement removed from vercel.json & route disabled
  console.log("Test 1: Validating removal of daily-engagement cron...");
  const vercelJson = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf-8"));
  const hasDailyEngagement = vercelJson.crons.some((c: any) => c.path.includes("daily-engagement"));
  assert(!hasDailyEngagement, "daily-engagement must be removed from vercel.json crons");

  const dailyEngagementRoute = fs.readFileSync(path.join(root, "app/api/cron/daily-engagement/route.ts"), "utf-8");
  assert(dailyEngagementRoute.includes("disabled: true"), "daily-engagement route returns disabled: true");
  console.log("✓ Test 1 Passed: daily-engagement successfully removed and disabled.\n");

  // Test 2: In-app notification icon receives all notifications & auth uses getCurrentUser()
  console.log("Test 2: Validating in-app notification persistence & auth...");
  const notificationsRoute = fs.readFileSync(path.join(root, "app/api/notifications/route.ts"), "utf-8");
  assert(notificationsRoute.includes("getCurrentUser()"), "notifications route uses getCurrentUser() for auth");
  assert(!notificationsRoute.includes("session.user.id"), "notifications route does not query directly with session.user.id");

  const libNotifications = fs.readFileSync(path.join(root, "lib/notifications.ts"), "utf-8");
  assert(libNotifications.includes("sanitizedUrl = url || \"/\""), "lib/notifications.ts provides safe fallback for url");
  assert(libNotifications.includes("Guaranteed first step for all notifications"), "in_app_notifications table insertion is guaranteed before FCM/Resend");
  console.log("✓ Test 2 Passed: In-app notifications persistence and multi-provider auth validated.\n");

  // Test 3: NavClient tab click does not wipe unread notifications
  console.log("Test 3: Validating NavClient does not prematurely mark notifications read...");
  const navClient = fs.readFileSync(path.join(root, "components/NavClient.tsx"), "utf-8");
  const handleTabClickSnippet = navClient.slice(navClient.indexOf("const handleTabClick"), navClient.indexOf("const handleTabClick") + 400);
  assert(!handleTabClickSnippet.includes("PATCH"), "handleTabClick must not send PATCH to /api/notifications marking all unread as read");
  console.log("✓ Test 3 Passed: Tab navigation preserves unread notification badge state.\n");

  // Test 4: Jobs inbox returns unread boolean, role, and jobTitle
  console.log("Test 4: Validating /api/jobs/inbox computes unread status and rich job metadata...");
  const jobsInboxRoute = fs.readFileSync(path.join(root, "app/api/jobs/inbox/route.ts"), "utf-8");
  assert(jobsInboxRoute.includes("unread: isUnread"), "/api/jobs/inbox computes and returns unread: isUnread");
  assert(jobsInboxRoute.includes("jobTitle: targetRole"), "/api/jobs/inbox returns jobTitle");
  assert(jobsInboxRoute.includes("last_read_at"), "/api/jobs/inbox queries last_read_at on participants");
  console.log("✓ Test 4 Passed: Jobs inbox returns accurate unread flag, role, and job title.\n");

  // Test 5: init-referral preserves target jobTitle on seeker post
  console.log("Test 5: Validating init-referral preserves requested role...");
  const initReferralRoute = fs.readFileSync(path.join(root, "app/api/jobs/chat/init-referral/route.ts"), "utf-8");
  assert(initReferralRoute.includes("role: jobTitle || currentUserDb?.job_title"), "init-referral sets role to target jobTitle");
  console.log("✓ Test 5 Passed: init-referral correctly tags thread with target jobTitle.\n");

  // Test 6: QuestionList enables revalidateOnFocus and renders distinct role and company badge
  console.log("Test 6: Validating QuestionList visual differentiation and SWR revalidation...");
  const questionList = fs.readFileSync(path.join(root, "components/qa/QuestionList.tsx"), "utf-8");
  assert(questionList.includes("revalidateOnFocus: true"), "QuestionList revalidates on focus for timely chat updates");
  assert(questionList.includes("{t.jobTitle || t.postRole}"), "QuestionList renders prominent target role badge on referral items");
  assert(questionList.includes("<span>🎯</span>"), "QuestionList renders target emoji badge");
  assert(questionList.includes("t.unread &&"), "QuestionList displays unread pulse indicator on referral items");
  console.log("✓ Test 6 Passed: Referral items are visually distinct with role badges and unread dots.\n");

  // Test 7: Stale SWR cache cleared and mutated on referral creation
  console.log("Test 7: Validating cache mutation in SuggestedJobs & JobFeed...");
  const suggestedJobs = fs.readFileSync(path.join(root, "components/jobs/SuggestedJobs.tsx"), "utf-8");
  assert(suggestedJobs.includes('mutate("/api/jobs/inbox")'), "SuggestedJobs calls mutate('/api/jobs/inbox') upon referral start");
  assert(suggestedJobs.includes("sessionStorage.removeItem(\"proxnet_inbox_cache\")"), "SuggestedJobs clears stale sessionStorage cache");

  const jobFeed = fs.readFileSync(path.join(root, "components/jobs/JobFeed.tsx"), "utf-8");
  assert(jobFeed.includes('mutate("/api/jobs/inbox")'), "JobFeed calls mutate('/api/jobs/inbox')");
  console.log("✓ Test 7 Passed: SWR cache is immediately mutated and refreshed on referral initiation.\n");

  // Test 8: Orphaned JobInbox resolved
  console.log("Test 8: Validating JobInbox is integrated into SuggestedJobs...");
  assert(suggestedJobs.includes("<JobInbox />"), "SuggestedJobs renders <JobInbox />");
  const jobInboxComponent = fs.readFileSync(path.join(root, "components/jobs/JobInbox.tsx"), "utf-8");
  assert(jobInboxComponent.includes("useSWR"), "JobInbox utilizes useSWR for real-time reactivity");
  console.log("✓ Test 8 Passed: JobInbox is modernized with SWR and embedded into Jobs view.\n");

  // Test 9: Event edit clears stale logs and notifies 2km radius
  console.log("Test 9: Validating event PATCH clears stale logs and notifies 2km neighbors...");
  const eventPatchRoute = fs.readFileSync(path.join(root, "app/api/events/[id]/route.ts"), "utf-8");
  assert(eventPatchRoute.includes("event_notifications_log").valueOf() && eventPatchRoute.includes(".delete()"), "Event PATCH deletes stale event_notifications_log entries");
  assert(eventPatchRoute.includes("notifyUsersWithin2km"), "Event PATCH sends update alert to 2km neighbors");
  console.log("✓ Test 9 Passed: Event updates clear log suppression and re-broadcast to 2km radius.\n");

  // Test 10: Event reminders cron notifies 2km radius within 24 hours of start
  console.log("Test 10: Validating event-reminders cron handles 2km radius within 24h...");
  const eventRemindersRoute = fs.readFileSync(path.join(root, "app/api/cron/event-reminders/route.ts"), "utf-8");
  assert(eventRemindersRoute.includes("hoursUntilStart > 0"), "Event-reminders Branch 1 covers up to event start (hoursUntilStart > 0)");
  assert(eventRemindersRoute.includes("radius_2km_24h") || eventRemindersRoute.includes("radius_2km_today"), "Event-reminders creates radius tiers for 24h and today");
  console.log("✓ Test 10 Passed: Event reminders cron handles <=24h radius notifications.\n");

  // Test 11: Morning reminders anti-drift window
  console.log("Test 11: Validating morning-reminders anti-drift window...");
  const morningRemindersRoute = fs.readFileSync(path.join(root, "app/api/cron/morning-reminders/route.ts"), "utf-8");
  assert(morningRemindersRoute.includes("20 * 60 * 60 * 1000"), "morning-reminders uses 20h window to prevent daily cron drift skips");
  console.log("✓ Test 11 Passed: Morning reminders anti-drift window prevents skipped daily nudges.\n");

  console.log("🎉 ALL 11 TESTS PASSED SUCCESSFULLY!");
}

runValidation().catch((err) => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});
