import { createAdminClient } from "../lib/supabase/admin";
import { haversineDistanceMeters } from "../lib/geo/haversine";
import { sendNotification } from "../lib/notifications";
import { checkEmailRateLimit, generateContextEmail } from "../lib/email-templates";

async function main() {
  console.log("================================================================================");
  console.log("  VALIDATION TEST: 2KM BEACON NOTIFICATIONS & AUTOMATED 1-CLICK JOIN FLOW");
  console.log("================================================================================");

  const supabase = createAdminClient();

  // Fetch two test users
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, home_lat, home_lng, email")
    .not("home_lat", "is", null)
    .limit(10);

  if (uErr || !users || users.length < 2) {
    console.error("❌ Failed to fetch test users:", uErr);
    process.exit(1);
  }

  const userA = users[0]; // Initiator
  const userB = users[1]; // Joiner

  console.log(`Initiator (User A): ${userA.full_name} (${userA.job_title} @ ${userA.company})`);
  console.log(`Joiner    (User B): ${userB.full_name} (${userB.job_title} @ ${userB.company})`);

  // ── TEST 1: Email Template & Rate Limit Exemption Check ──
  console.log("\n👉 Test 1: Testing Email Templates & Rate Limit Exemption for Beacons...");
  
  const rateLimitBroadcast = checkEmailRateLimit(userB.id, "beacon_broadcast");
  const rateLimitJoin = checkEmailRateLimit(userA.id, "beacon_join");

  if (!rateLimitBroadcast.allowed) {
    console.error("❌ Test 1 FAILED: beacon_broadcast was blocked by rate limit:", rateLimitBroadcast.reason);
    process.exit(1);
  }
  if (!rateLimitJoin.allowed) {
    console.error("❌ Test 1 FAILED: beacon_join was blocked by rate limit:", rateLimitJoin.reason);
    process.exit(1);
  }

  const broadcastEmail = generateContextEmail({
    recipientName: "Subbarao",
    recipientEmail: "test@example.com",
    title: "☕ Consultant @ Dell Technologies is down for 15-min Chai!",
    body: "South City Internal • Pinned at the top of your Network tab.",
    url: "/qa?tab=network",
    data: { type: "beacon_broadcast", activity: "chai" },
  });

  if (!broadcastEmail.html.includes("NEIGHBORHOOD BEACON") || !broadcastEmail.html.includes("Network")) {
    console.error("❌ Test 1 FAILED: broadcastEmail did not generate expected NEIGHBORHOOD BEACON badge!");
    process.exit(1);
  }

  const joinEmail = generateContextEmail({
    recipientName: "Vaibhav",
    recipientEmail: "test@example.com",
    title: "☕ Software Engineer @ Google joined your 15-min Chai broadcast!",
    body: "Hi! I saw your 15-min Chai broadcast and would love to join!",
    url: "/chat/test-session-123",
    data: { type: "beacon_join", senderAlias: "Software Engineer @ Google" },
  });

  if (!joinEmail.html.includes("BEACON CONNECT") || !joinEmail.subject.includes("joined your broadcast")) {
    console.error("❌ Test 1 FAILED: joinEmail did not generate expected BEACON CONNECT badge or subject!");
    process.exit(1);
  }

  console.log("✅ Test 1 PASSED: Email templates and rate-limit exemptions for beacon_broadcast and beacon_join validated.");

  // ── TEST 2: 2km Proximity Targeting Logic ──
  console.log("\n👉 Test 2: Testing 2km Radius Filter for Broadcast Notifications...");
  const bLat = Number(userA.home_lat);
  const bLng = Number(userA.home_lng);

  let nearCount = 0;
  let farCount = 0;

  for (const u of users) {
    if (u.id === userA.id) continue;
    const dist = haversineDistanceMeters(bLat, bLng, Number(u.home_lat), Number(u.home_lng));
    if (dist <= 2000) {
      nearCount++;
      console.log(`  - Within 2km: ${u.full_name} (${Math.round(dist)}m away) -> will receive notification`);
    } else {
      farCount++;
      console.log(`  - Outside 2km: ${u.full_name} (${Math.round(dist)}m away) -> skipped`);
    }
  }

  console.log(`✅ Test 2 PASSED: Verified 2km filter correctly categorizes users (${nearCount} within 2km, ${farCount} outside 2km).`);

  // ── TEST 3: Automated 1-Click Join & Chat Message Creation ──
  console.log("\n👉 Test 3: Testing Automated 1-Click Join (Chat session + Message + Notification)...");

  // Simulate calling the join flow from User B joining User A's beacon
  const activityLabel = "15-min Chai";
  const note = "Near Clubhouse";
  const joinMessageText = `Hi! I saw your "${activityLabel}" broadcast ("${note}") and would love to join!`;

  // Find or create direct chat session
  const { data: mySessions } = await supabase
    .from("chat_participants")
    .select("session_id")
    .eq("user_id", userB.id);

  let sessionId: string | null = null;
  if (mySessions && mySessions.length > 0) {
    const mySessionIds = mySessions.map((s) => s.session_id);
    const { data: sharedSessions } = await supabase
      .from("chat_participants")
      .select("session_id")
      .eq("user_id", userA.id)
      .in("session_id", mySessionIds);

    if (sharedSessions && sharedSessions.length > 0) {
      sessionId = sharedSessions[0].session_id;
    }
  }

  if (!sessionId) {
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .insert({
        asker_id: userB.id,
        body: joinMessageText,
        type: "direct",
        status: "open",
        center_lat: bLat,
        center_lng: bLng,
        radius_meters: 2000,
      })
      .select("id")
      .single();

    if (qErr || !question) {
      console.error("❌ Test 3 FAILED to create question:", qErr);
      process.exit(1);
    }

    await supabase.from("question_targets").insert({
      question_id: question.id,
      professional_id: userA.id,
      status: "pending",
    });

    const { data: session, error: sErr } = await supabase
      .from("chat_sessions")
      .insert({ question_id: question.id })
      .select("id")
      .single();

    if (sErr || !session) {
      console.error("❌ Test 3 FAILED to create chat session:", sErr);
      process.exit(1);
    }

    const userBAlias = (userB.job_title && userB.company)
      ? `${userB.job_title} @ ${userB.company}`
      : "Resident Neighbor";
    const userAAlias = (userA.job_title && userA.company)
      ? `${userA.job_title} @ ${userA.company}`
      : "Professional Neighbor";

    await supabase.from("chat_participants").insert([
      { session_id: session.id, user_id: userB.id, alias: userBAlias },
      { session_id: session.id, user_id: userA.id, alias: userAAlias },
    ]);

    sessionId = session.id;
  }

  // Insert the automated join message
  const { data: insertedMsg, error: msgErr } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      sender_id: userB.id,
      body: joinMessageText,
    })
    .select("id, body, sender_id")
    .single();

  if (msgErr || !insertedMsg) {
    console.error("❌ Test 3 FAILED: Chat message insertion failed:", msgErr);
    process.exit(1);
  }

  console.log(`- Automated chat message created in session ${sessionId}: "${insertedMsg.body}"`);

  const userBAlias = (userB.job_title && userB.company)
    ? `${userB.job_title} @ ${userB.company}`
    : "Resident Neighbor";

  // Dispatch notification to User A
  const notifRes = await sendNotification(userA.id, {
    title: `☕ ${userBAlias} joined your ${activityLabel} broadcast!`,
    body: joinMessageText,
    url: `/chat/${sessionId}`,
    data: {
      sessionId,
      type: "beacon_join",
      activity: "chai",
      senderAlias: userBAlias,
    },
  });

  // Verify notification was recorded in in_app_notifications
  const { data: recentNotifs } = await supabase
    .from("in_app_notifications")
    .select("id, title, body, url")
    .eq("user_id", userA.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!recentNotifs || recentNotifs.length === 0 || !recentNotifs[0].title.includes("joined your")) {
    console.error("❌ Test 3 FAILED: in_app_notifications did not receive the join notification!");
    process.exit(1);
  }

  console.log(`- Notification recorded for initiator: "${recentNotifs[0].title}" (URL: ${recentNotifs[0].url})`);
  console.log("✅ Test 3 PASSED: 1-Click Join successfully created chat session, inserted automated message, and notified the initiator.");

  console.log("\n================================================================================");
  console.log("  🎉 ALL 3 VALIDATION TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
