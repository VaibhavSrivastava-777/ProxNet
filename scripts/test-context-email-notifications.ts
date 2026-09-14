import assert from "node:assert";
import { generateContextEmail, checkEmailRateLimit, recordEmailSent } from "../lib/email-templates";

async function runTests() {
  console.log("=================================================");
  console.log("  TESTING CONTEXT-SPECIFIC EMAIL NOTIFICATIONS   ");
  console.log("=================================================");

  // TEST 1: Profile Completion Notification Template
  console.log("\n[Test 1] Profile completion reminder template...");
  const profileEmail = generateContextEmail({
    recipientName: "Alice",
    recipientEmail: "alice@example.com",
    title: "📝 Complete your ProxNet profile",
    body: "Add your designation, company, and location to get discovered by professional neighbors.",
    url: "/profile",
    data: { type: "profile_reminder" },
  });

  assert(profileEmail.subject.toLowerCase().includes("complete your proxnet profile"), "Subject mentions completing profile");
  assert(profileEmail.html.includes("Complete My Profile &rarr;"), "CTA button says Complete My Profile");
  assert(profileEmail.html.includes("https://www.proxnet.in/profile"), "CTA URL points to /profile");
  assert(profileEmail.html.includes("ACTION REQUIRED"), "Contains ACTION REQUIRED badge");
  assert(profileEmail.html.includes("Why complete your profile?"), "Explains why completing profile matters");
  console.log("✅ Profile completion email verified.");

  // TEST 2: Enable Push Notifications Template
  console.log("\n[Test 2] Enable push notifications template...");
  const pushEmail = generateContextEmail({
    recipientName: "Bob",
    recipientEmail: "bob@example.com",
    title: "Turn on push notifications",
    body: "Get instant alerts on ProxNet",
    url: "/profile#notifications",
    data: { type: "enable_notifications" },
  });

  assert(pushEmail.subject.toLowerCase().includes("push notifications"), "Subject mentions push notifications");
  assert(pushEmail.html.includes("Enable Push Notifications &rarr;"), "CTA button says Enable Push Notifications");
  assert(pushEmail.html.includes("https://www.proxnet.in/profile#notifications"), "CTA URL points to #notifications");
  assert(pushEmail.html.includes("Earn 5 Free Wallet Credits"), "Highlights 5 bonus credits incentive");
  console.log("✅ Enable notifications email verified.");

  // TEST 3: Unresponded Chat Starter Reminder Template
  console.log("\n[Test 3] Chat starter reminder template...");
  const starterEmail = generateContextEmail({
    recipientName: "Charlie",
    recipientEmail: "charlie@example.com",
    title: "💬 New conversation waiting from Maya",
    body: "Hey Charlie, are you working on distributed systems at Google?",
    url: "/chat/session-xyz",
    data: { type: "chat_starter_reminder", sessionId: "session-xyz" },
  });

  assert(starterEmail.html.includes("Reply to Conversation &rarr;"), "CTA button says Reply to Conversation");
  assert(starterEmail.html.includes("https://www.proxnet.in/chat/session-xyz"), "CTA URL points to chat session");
  assert(starterEmail.html.includes("distributed systems at Google"), "Body quotes message snippet");
  console.log("✅ Chat starter reminder email verified.");

  // TEST 4: Strong Job Match Template
  console.log("\n[Test 4] Strong job match template...");
  const jobEmail = generateContextEmail({
    recipientName: "David",
    recipientEmail: "david@example.com",
    title: "🔥 Strong Job Match (88%): Staff SRE at Microsoft",
    body: "Strong match based on your Kubernetes and Golang background.",
    url: "/jobs?jobId=123&match=88",
    data: {
      type: "job_match_75",
      jobId: "123",
      company: "Microsoft",
      matchRate: 88,
    },
  });

  assert(jobEmail.html.includes("88% MATCH"), "Contains match percentage badge");
  assert(jobEmail.html.includes("View Job &amp; Referral Details &rarr;") || jobEmail.html.includes("View Job & Referral Details &rarr;"), "CTA button points to job details");
  assert(jobEmail.html.includes("Microsoft"), "Mentions company");
  console.log("✅ Strong job match email verified.");

  // TEST 5: Clubbed / Multi-Notification Digest
  console.log("\n[Test 5] Clubbed notifications digest section...");
  const clubbedEmail = generateContextEmail({
    recipientName: "Eva",
    recipientEmail: "eva@example.com",
    title: "New Follower",
    body: "Sarah @ Uber is now following you.",
    url: "/profile",
    data: { type: "new_follower" },
    otherUnreadNotifs: [
      { id: "1", title: "Message from David", body: "Can we connect tomorrow?", url: "/chat/s1" },
      { id: "2", title: "Meetup in 2 days", body: "Cloud Native Bangalore Meetup", url: "/event/e1" },
    ],
  });

  assert(clubbedEmail.html.includes("Also waiting for you (2 other updates)"), "Renders clubbed summary header");
  assert(clubbedEmail.html.includes("Message from David"), "Includes first unread item");
  assert(clubbedEmail.html.includes("Cloud Native Bangalore Meetup"), "Includes second unread item");
  assert(clubbedEmail.html.includes("View all notifications &rarr;"), "Includes link to all notifications");
  console.log("✅ Multi-notification clubbed digest verified.");

  // TEST 6: Anti-Spam Rate Limiter Cooldown & Daily Cap
  console.log("\n[Test 6] Anti-spam rate limiting and cooldown rules...");
  const testUserId = `test-user-${Date.now()}`;

  // 1st chat message -> allowed
  const check1 = checkEmailRateLimit(testUserId, "chat_message");
  assert(check1.allowed === true, "1st chat email is allowed");
  recordEmailSent(testUserId, "chat_message");

  // 2nd chat message immediately -> cooldown active
  const check2 = checkEmailRateLimit(testUserId, "chat_message");
  assert(check2.allowed === false, "2nd immediate chat email is suppressed by cooldown");
  assert(check2.reason?.includes("cooldown"), "Reason mentions cooldown");

  // forceEmail: true bypasses cooldown
  const checkForce = checkEmailRateLimit(testUserId, "chat_message", true);
  assert(checkForce.allowed === true, "forceEmail: true bypasses cooldown");

  // Test daily cap limit
  const cappedUser = `capped-user-${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const c = checkEmailRateLimit(cappedUser, `type_${i}`);
    assert(c.allowed === true, `Send ${i + 1} allowed`);
    recordEmailSent(cappedUser, `type_${i}`);
  }

  // 6th send should be blocked by daily limit
  const checkCap = checkEmailRateLimit(cappedUser, "daily_engagement");
  assert(checkCap.allowed === false, "6th email is blocked by 5/day limit");
  assert(checkCap.reason?.includes("Daily limit"), "Reason mentions daily limit");
  console.log("✅ Anti-spam rate limiter and cooldown verified.");

  console.log("\n=================================================");
  console.log("🎉 ALL CONTEXT EMAIL TESTS PASSED SUCCESSFULLY!  ");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
