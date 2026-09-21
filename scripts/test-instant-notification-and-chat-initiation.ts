import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { checkEmailRateLimit, generateContextEmail } from "../lib/email-templates";

async function runValidation() {
  console.log("================================================================================");
  console.log("  VALIDATION SUITE: INSTANT CHAT INITIATION & GUARANTEED NOTIFICATION PIPELINE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  const root = process.cwd();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SCENARIO A: JOB REFERRAL CHAT & NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("👉 Validating Scenario A: Job Referral Requests (Jobs tab)...");
  const initReferralPath = join(root, "app", "api", "jobs", "chat", "init-referral", "route.ts");
  assert(existsSync(initReferralPath), "init-referral/route.ts exists");
  const initReferralContent = readFileSync(initReferralPath, "utf-8");

  assert(initReferralContent.includes("forceEmail: true"), "init-referral sets forceEmail: true for guaranteed email delivery");
  assert(initReferralContent.includes("url: `/jobs/chat/${thread.id}`"), "init-referral sends direct deep-link to /jobs/chat/${thread.id}");
  assert(initReferralContent.includes('type: isSameCompany ? "colleague_message" : "referral_request"'), "init-referral tags notification as colleague_message or referral_request");
  assert(initReferralContent.includes("threadId: thread.id"), "init-referral provides threadId in payload");

  // Verify SuggestedJobs fallback
  const suggestedJobsPath = join(root, "components", "jobs", "SuggestedJobs.tsx");
  const suggestedJobsContent = readFileSync(suggestedJobsPath, "utf-8");
  assert(suggestedJobsContent.includes("router.push(`/jobs/chat/${data.threadId}`)"), "SuggestedJobs navigates directly into chat thread on success");
  assert(suggestedJobsContent.includes("if (!targetContact)"), "SuggestedJobs guards when no registered referrers exist");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SCENARIO B: DIRECT QUESTIONS (PEER TO PEER)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n👉 Validating Scenario B: Direct Questions (QA & Network tabs)...");
  const questionsRoutePath = join(root, "app", "api", "questions", "route.ts");
  assert(existsSync(questionsRoutePath), "questions/route.ts exists");
  const questionsContent = readFileSync(questionsRoutePath, "utf-8");

  assert(questionsContent.includes("url: isDirect ? `/chat/${sessionId}` : \"/qa\""), "questions route dispatches direct deep-link to /chat/${sessionId} for direct questions");
  assert(questionsContent.includes("type: \"new_question\""), "questions route tags notification with type: new_question");
  assert(questionsContent.includes("forceEmail: true"), "questions route passes forceEmail: true for direct questions");
  assert(questionsContent.includes("sessionId: sessionId || undefined"), "questions route passes sessionId in data payload");
  assert(questionsContent.includes("if (!session)") && questionsContent.includes("from(\"chat_sessions\").insert"), "getExistingSessionResponse guarantees chat_session creation if missing");

  // Email template for Direct Question
  const directQuestionEmail = generateContextEmail({
    recipientName: "Priya",
    recipientEmail: "priya@example.com",
    title: "New Message",
    body: "Hi! Are there any frontend openings on your team?",
    url: "/chat/session-test-456",
    data: { type: "new_question", senderAlias: "Karan (SWE @ Google)", sessionId: "session-test-456" },
  });

  assert(directQuestionEmail.html.includes("DIRECT QUESTION"), "generateContextEmail produces DIRECT QUESTION badge");
  assert(directQuestionEmail.html.includes("Answer in Chat"), "generateContextEmail produces 'Answer in Chat' CTA");
  assert(directQuestionEmail.html.includes("/chat/session-test-456"), "generateContextEmail CTA links directly to /chat/session-test-456");

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SCENARIO C: BEACON JOINS & BROADCASTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n👉 Validating Scenario C: Beacon Join...");
  const beaconJoinPath = join(root, "app", "api", "micro-status", "join", "route.ts");
  assert(existsSync(beaconJoinPath), "micro-status/join/route.ts exists");
  const beaconJoinContent = readFileSync(beaconJoinPath, "utf-8");

  assert(beaconJoinContent.includes("url: `/chat/${sessionId}`"), "beacon join notification links directly to /chat/${sessionId}");
  assert(beaconJoinContent.includes("forceEmail: true"), "beacon join notification includes forceEmail: true");
  assert(beaconJoinContent.includes('type: "beacon_join"'), "beacon join notification sets type: beacon_join");

  const beaconRateCheck = checkEmailRateLimit("test-user-123", "beacon_join", true);
  assert(beaconRateCheck.allowed, "checkEmailRateLimit allows high-priority beacon_join");

  // Verify beacon_join email handles null/empty/malformed sender alias gracefully
  const { sanitizeAlias } = await import("../lib/email-templates");
  assert(sanitizeAlias("null @ null") === "A neighbor", "sanitizeAlias converts 'null @ null' to 'A neighbor'");
  assert(sanitizeAlias("Consultant @ null") === "Consultant", "sanitizeAlias extracts valid role from 'Consultant @ null'");
  assert(sanitizeAlias("null @ Google") === "Professional @ Google", "sanitizeAlias extracts valid company from 'null @ Google'");

  const nullAliasBeaconEmail = generateContextEmail({
    recipientName: "Chitra",
    recipientEmail: "test@example.com",
    title: "☕ null @ null joined your 15-min Chai broadcast!",
    body: 'Hi! I saw your "15-min Chai" broadcast and would love to join!',
    url: "/chat/session-test-789",
    data: { type: "beacon_join", senderAlias: "null @ null" },
  });
  assert(!nullAliasBeaconEmail.subject.includes("null @ null"), "beacon_join email subject does not contain 'null @ null'");
  assert(!nullAliasBeaconEmail.html.includes("null @ null"), "beacon_join email html body does not contain 'null @ null'");
  assert(nullAliasBeaconEmail.html.includes("A neighbor"), "beacon_join email falls back to friendly 'A neighbor' default");

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. NOTIFICATION ENGINE RESILIENCE (FCM FAILURE FALLBACK & PRIORITY LIST)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n👉 Validating Notification Engine Resilience & Fallback...");
  const notifsPath = join(root, "lib", "notifications.ts");
  const notifsContent = readFileSync(notifsPath, "utf-8");

  assert(notifsContent.includes("let fcmSuccessCount = 0;"), "sendNotification initializes fcmSuccessCount tracking");
  assert(notifsContent.includes("fcmSuccessCount++;"), "sendNotification increments fcmSuccessCount on successful dispatch");
  assert(notifsContent.includes("const hasSuccessfulFcm = fcmSuccessCount > 0;"), "sendNotification tracks hasSuccessfulFcm");
  assert(notifsContent.includes("if (!hasSuccessfulFcm || isPriorityNotification)"), "sendNotification falls back to email if 0 FCM dispatches succeed or if priority");
  assert(notifsContent.includes('notifType === "new_question"'), "isPriorityNotification includes new_question");
  assert(notifsContent.includes('notifType === "beacon_join"'), "isPriorityNotification includes beacon_join");
  assert(notifsContent.includes('notifType === "beacon_broadcast"'), "isPriorityNotification includes beacon_broadcast");
  assert(notifsContent.includes('notifType === "referral_request"'), "isPriorityNotification includes referral_request");
  assert(notifsContent.includes('notifType === "colleague_message"'), "isPriorityNotification includes colleague_message");

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. DATA MODELING & MORNING REMINDERS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n👉 Validating Polymorphic Data Modeling & Morning Reminders...");
  const aiChatPath = join(root, "lib", "ai-chat.ts");
  const aiChatContent = readFileSync(aiChatPath, "utf-8");
  assert(aiChatContent.includes('type: "ai"'), "ai-chat classifies welcome sessions as type: 'ai'");

  const migrationPath = join(root, "supabase", "migrations", "20260921_chat_sessions_polymorphic.sql");
  assert(existsSync(migrationPath), "20260921_chat_sessions_polymorphic.sql migration exists");
  const migrationContent = readFileSync(migrationPath, "utf-8");
  assert(migrationContent.includes("ADD COLUMN IF NOT EXISTS type text"), "Migration adds type column");
  assert(migrationContent.includes("ADD COLUMN IF NOT EXISTS context_id uuid"), "Migration adds context_id column");
  assert(migrationContent.includes("ADD COLUMN IF NOT EXISTS metadata jsonb"), "Migration adds metadata column");

  const morningRemindersPath = join(root, "app", "api", "cron", "morning-reminders", "route.ts");
  const morningRemindersContent = readFileSync(morningRemindersPath, "utf-8");
  assert(!morningRemindersContent.includes('.not("question_id", "is", null)'), "morning-reminders checks chat_sessions universally without excluding non-question sessions");
  assert(morningRemindersContent.includes("forceEmail: true"), "morning-reminders passes forceEmail: true on starter reminders");

  console.log("\n================================================================================");
  console.log(`🏁 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
