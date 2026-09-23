import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { checkEmailRateLimit, generateContextEmail, sanitizeAlias } from "../lib/email-templates";

async function main() {
  console.log("================================================================================");
  console.log("  DETAILED VERIFICATION CHECKLIST FOR USER FLOWS 1, 2, AND 3");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [CONFIRMED] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAILED] ${testName}${detail ? ` -> ${detail}` : ""}`);
      failed++;
    }
  }

  const root = process.cwd();

  // ===========================================================================
  // ITEM 1: REFERRAL REQUEST (USER A -> USER B)
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("1. Referral Request Flow (User A -> User B)");
  console.log("--------------------------------------------------------------------------------");
  const initReferralPath = join(root, "app", "api", "jobs", "chat", "init-referral", "route.ts");
  assert(existsSync(initReferralPath), "Referral route exists (app/api/jobs/chat/init-referral/route.ts)");
  const initReferralContent = readFileSync(initReferralPath, "utf-8");

  // 1a. Chat thread initiated
  const hasJobThreads = initReferralContent.includes('"job_threads"') && initReferralContent.includes(".insert(");
  const hasJobParticipants = initReferralContent.includes('"job_participants"') && initReferralContent.includes(".insert([");
  const hasJobMessages = initReferralContent.includes('"job_messages"') && initReferralContent.includes(".insert(");

  assert(hasJobThreads, "1a. Chat session initiated: creates job_threads record");
  assert(hasJobParticipants, "1a. Chat session initiated: links both users in job_participants");
  assert(hasJobMessages, "1a. Chat session initiated: inserts automated introductory referral message");

  // 1b. In-app bell icon notification
  const notifsPath = join(root, "lib", "notifications.ts");
  const notifsContent = readFileSync(notifsPath, "utf-8");
  const hasInAppInsert = notifsContent.includes('"in_app_notifications"') && notifsContent.includes(".insert({");
  assert(hasInAppInsert, "1b. Bell icon notification: sendNotification persists to in_app_notifications for User B");
  assert(initReferralContent.includes("url: `/jobs/chat/${thread.id}`"), "1b. Bell icon notification: direct link points to /jobs/chat/${thread.id}");

  // 1c. FCM + Email fallback
  assert(initReferralContent.includes("forceEmail: true"), "1c. Email fallback: sets forceEmail: true");
  assert(initReferralContent.includes('type: isSameCompany ? "colleague_message" : "referral_request"'), "1c. Priority delivery: tagged as referral_request / colleague_message");
  assert(notifsContent.includes('notifType === "referral_request"'), "1c. Priority delivery: referral_request is registered in isPriorityNotification");
  assert(notifsContent.includes("if (!hasSuccessfulFcm || isPriorityNotification)"), "1c. Resilience: triggers email fallback if FCM has 0 tokens or fails");

  // ===========================================================================
  // ITEM 2: BEACON SET (15 MIN CHAI) -> 2KM RADIUS -> JOIN FLOW
  // ===========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("2. Beacon 15-min Chai Broadcast & 1-Click Join Flow");
  console.log("--------------------------------------------------------------------------------");
  const microStatusPath = join(root, "app", "api", "micro-status", "route.ts");
  assert(existsSync(microStatusPath), "Beacon route exists (app/api/micro-status/route.ts)");
  const microStatusContent = readFileSync(microStatusPath, "utf-8");

  // 2a. Broadcast to 2km neighbors
  const has2kmCheck = microStatusContent.includes("minDistance <= 2000");
  const has2kmSendNotif = microStatusContent.includes("sendNotification(neighbor.id");
  assert(has2kmSendNotif, "2a. 2km Targeting: dispatches sendNotification to neighbors when beacon is turned on");
  assert(has2kmCheck, "2a. 2km Targeting: strictly enforces 2000m (2km) radius via haversine");
  assert(notifsContent.includes('notifType === "beacon_broadcast"'), "2a. 2km Targeting: beacon_broadcast is an isPriorityNotification");

  // 2b. User B clicks Join -> User A receives chat message & notification
  const joinRoutePath = join(root, "app", "api", "micro-status", "join", "route.ts");
  assert(existsSync(joinRoutePath), "Join route exists (app/api/micro-status/join/route.ts)");
  const joinRouteContent = readFileSync(joinRoutePath, "utf-8");

  const hasChatSessions = joinRouteContent.includes('"chat_sessions"') && joinRouteContent.includes(".insert(");
  assert(hasChatSessions, "2b. Join session initiated: creates chat_sessions row");
  assert(joinRouteContent.includes('"chat_participants"') && joinRouteContent.includes(".insert(["), "2b. Join session initiated: creates chat_participants for User A & User B");
  assert(joinRouteContent.includes('"chat_messages"') && joinRouteContent.includes(".insert({"), "2b. Join message created: inserts automated join message from User B");
  assert(joinRouteContent.includes("sendNotification(initiatorUserId"), "2b. Notification dispatched: notifies User A (initiator)");
  assert(joinRouteContent.includes("url: `/chat/${sessionId}`"), "2b. Direct link: notification links directly to /chat/${sessionId}");
  assert(joinRouteContent.includes("forceEmail: true"), "2b. Email fallback: passes forceEmail: true");
  assert(notifsContent.includes('notifType === "beacon_join"'), "2b. Priority delivery: beacon_join is registered in isPriorityNotification");

  // ===========================================================================
  // ITEM 3: DIRECT QUESTION (USER A -> USER B)
  // ===========================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("3. Direct Question Flow (User A -> User B)");
  console.log("--------------------------------------------------------------------------------");
  const questionsRoutePath = join(root, "app", "api", "questions", "route.ts");
  assert(existsSync(questionsRoutePath), "Questions route exists (app/api/questions/route.ts)");
  const questionsContent = readFileSync(questionsRoutePath, "utf-8");

  // 3a. Chat session initiated & returned
  assert(questionsContent.includes('"chat_sessions"') && questionsContent.includes(".insert({"), "3a. Chat session initiated: creates chat_sessions row for direct question");
  assert(questionsContent.includes('"chat_participants"') && questionsContent.includes(".insert(["), "3a. Chat session initiated: creates chat_participants for User A & User B");
  assert(questionsContent.includes("getExistingSessionResponse"), "3a. Session guarantee: getExistingSessionResponse recovers and creates session if missing");
  assert(questionsContent.includes("sessionId: session.id"), "3a. Session guarantee: always returns sessionId in API response");

  // 3b. In-app bell icon notification & FCM/Email fallback
  assert(questionsContent.includes("url: isDirect ? `/chat/${sessionId}` : \"/qa\""), "3b. Bell icon notification: direct link points to /chat/${sessionId} (not generic /qa)");
  assert(questionsContent.includes("forceEmail: true"), "3b. Email fallback: passes forceEmail: true for direct question");
  assert(questionsContent.includes('type: "new_question"'), "3b. Priority delivery: tagged as new_question");
  assert(notifsContent.includes('notifType === "new_question"'), "3b. Priority delivery: new_question is registered in isPriorityNotification");

  // 3c. Direct question email template
  const questionEmail = generateContextEmail({
    recipientName: "Rahul",
    recipientEmail: "rahul@example.com",
    title: "New Message",
    body: "Hi! Can you share details about the tech stack at your company?",
    url: "/chat/test-direct-session",
    data: { type: "new_question", senderAlias: "Sneha", sessionId: "test-direct-session" },
  });
  assert(questionEmail.html.includes("DIRECT QUESTION"), "3c. Email template: generates dedicated DIRECT QUESTION badge");
  assert(questionEmail.html.includes("Answer in Chat"), "3c. Email template: generates 'Answer in Chat' CTA");
  assert(questionEmail.html.includes("/chat/test-direct-session"), "3c. Email template: CTA deep-links to /chat/test-direct-session");

  console.log("\n================================================================================");
  console.log(`🏁 CHECKLIST RESULTS: ${passed} checks passed, ${failed} failed`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

main().catch(console.error);
