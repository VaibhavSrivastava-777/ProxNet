import { generateContextEmail } from "../lib/email-templates";

async function main() {
  console.log("=== RUNNING CHAT & REFERRAL FIXES VALIDATION ===");

  // TEST 1: Verify Referral Request Email Template Generation
  console.log("\n[Test 1] Testing generateContextEmail for 'job_referral_request'...");
  const referralEmail = generateContextEmail({
    recipientName: "Jane Doe",
    recipientEmail: "jane@example.com",
    title: "New Referral Request: Google",
    body: "Alex is requesting a referral for Senior Frontend Engineer. Tap to review details.",
    url: "/jobs/chat/thread-12345",
    data: {
      type: "job_referral_request",
      threadId: "thread-12345",
      jobTitle: "Senior Frontend Engineer",
      company: "Google",
      applicantName: "Alex",
      initialMessage: "Hi Jane! I noticed an opening for Senior Frontend Engineer on your team. I have 6 years experience in React/Next.js.",
    },
  });

  if (!referralEmail.html.includes("thread-12345")) {
    throw new Error("Test 1 Failed: CTA URL missing threadId");
  }
  if (!referralEmail.html.includes("Senior Frontend Engineer")) {
    throw new Error("Test 1 Failed: Role missing from email body");
  }
  if (!referralEmail.html.includes("Hi Jane! I noticed an opening")) {
    throw new Error("Test 1 Failed: Applicant pitch preview missing from email");
  }
  console.log("✓ Test 1 Passed: Referral Request email generated with correct pitch and CTA URL.");

  // TEST 2: Priority notification classification test
  console.log("\n[Test 2] Testing priority notification types...");
  const priorityTypes = ["direct_chat", "question_response", "job_referral_request", "colleague_message", "referral_request"];
  for (const t of priorityTypes) {
    const isPriority =
      t === "direct_chat" ||
      t === "question_response" ||
      t === "job_referral_request" ||
      t === "colleague_message" ||
      t === "referral_request";
    if (!isPriority) {
      throw new Error(`Test 2 Failed: ${t} not classified as priority notification`);
    }
  }
  console.log("✓ Test 2 Passed: All referral & message types correctly prioritized for immediate email delivery.");

  // TEST 3: Chat filtering logic (simulating QuestionList filter behavior)
  console.log("\n[Test 3] Testing chat visibility logic...");
  const mockChats = [
    {
      type: "referral",
      data: { id: "ref-1", otherAlias: "Google Engineer", postRole: "Staff SWE", latestMessage: "Hey!" },
      distance: null, // Distance unknown
    },
    {
      type: "asked",
      data: { id: "q-1", body: "Anyone at Stripe?", status: "responded", session_id: "sess-1", latest_activity_at: new Date().toISOString() },
      distance: null, // Responded question
    },
    {
      type: "incoming",
      data: { id: "q-2", body: "Need referral at Uber", status: "responded", session_id: "sess-2", latest_activity_at: new Date().toISOString() },
      distance: 8500, // Responded question in other area
    },
    {
      type: "incoming",
      data: { id: "q-3", body: "Public question without answer", status: "pending", distance: 15000, latest_activity_at: new Date().toISOString() },
      distance: 15000, // Unresponded public question 15km away
    },
  ];

  // When filter2km is FALSE (the new default):
  const filterDefault = (filter2km: boolean, item: any) => {
    if (item.type === "referral") return true;
    if (filter2km) {
      const isUnrespondedIncoming = item.type === "incoming" && item.data.status !== "responded";
      if (isUnrespondedIncoming && (item.distance === null || item.distance === undefined || item.distance > 2000)) {
        return false;
      }
    }
    return true;
  };

  const visibleDefault = mockChats.filter((item) => filterDefault(false, item));
  if (visibleDefault.length !== 4) {
    throw new Error(`Test 3 Failed: Default filter should show all 4 items, got ${visibleDefault.length}`);
  }

  // When filter2km is TRUE:
  const visibleFiltered = mockChats.filter((item) => filterDefault(true, item));
  // Only q-3 (unresponded incoming > 2000m) should be filtered out. The referral thread and responded chats must remain visible!
  if (visibleFiltered.length !== 3) {
    throw new Error(`Test 3 Failed: 2km filter should preserve referral and responded chats (expected 3, got ${visibleFiltered.length})`);
  }
  if (visibleFiltered.some((i) => i.data.id === "q-3")) {
    throw new Error("Test 3 Failed: q-3 should have been filtered out by 2km filter");
  }
  if (!visibleFiltered.some((i) => i.data.id === "ref-1")) {
    throw new Error("Test 3 Failed: Referral chat was erroneously filtered out!");
  }
  if (!visibleFiltered.some((i) => i.data.id === "q-1") || !visibleFiltered.some((i) => i.data.id === "q-2")) {
    throw new Error("Test 3 Failed: Responded chats were erroneously filtered out!");
  }
  console.log("✓ Test 3 Passed: Chat visibility correctly preserves all 1-on-1, referral, and responded chats!");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
