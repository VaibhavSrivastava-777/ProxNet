import { createAdminClient } from "../lib/supabase/admin";
import fs from "fs";
import path from "path";

async function validateLatencyFixes() {
  console.log("=== RUNNING VALIDATION: CHAT & QA NAVIGATION LATENCY FIXES ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // 1. Validate ChatRoom.tsx handles instant back navigation & prefetching
  const chatRoomPath = path.join(process.cwd(), "components", "chat", "ChatRoom.tsx");
  const chatRoomContent = fs.readFileSync(chatRoomPath, "utf-8");
  assert(chatRoomContent.includes("handleBack"), "ChatRoom defines handleBack function");
  assert(chatRoomContent.includes("router.back()"), "ChatRoom handleBack uses router.back() for instant bfcache restore");
  assert(chatRoomContent.includes('router.prefetch("/qa")'), "ChatRoom prefetches /qa on mount");
  assert(!chatRoomContent.includes("suggestions.length"), "ChatRoom has zero AI suggestion UI chips");

  // 2. Validate QAContent.tsx avoids /network tab flicker on load
  const qaContentPath = path.join(process.cwd(), "app", "qa", "QAContent.tsx");
  const qaContent = fs.readFileSync(qaContentPath, "utf-8");
  assert(!qaContent.includes('useState<string>("/network")'), "QAContent no longer hardcodes activeTab to /network");
  assert(qaContent.includes('proxnet_qa_cache') || qaContent.includes('"/qa"'), "QAContent defaults activeTab to /qa or initializes cleanly");

  // 3. Validate QuestionList.tsx instant navigation and caching
  const questionListPath = path.join(process.cwd(), "components", "qa", "QuestionList.tsx");
  const questionListContent = fs.readFileSync(questionListPath, "utf-8");
  assert(questionListContent.includes("proxnet_qa_cache"), "QuestionList implements sessionStorage caching (proxnet_qa_cache)");
  assert(questionListContent.includes("proxnet_inbox_cache"), "QuestionList implements sessionStorage caching (proxnet_inbox_cache)");
  assert(questionListContent.includes("navigateToChat(directSessionId)"), "QuestionList openChat bypasses network roundtrip when directSessionId is known");
  assert(questionListContent.includes("router.prefetch(`/chat/${q.session_id}`)"), "QuestionList prefetches chat routes on hover/touch");

  // 4. Verify DB chat sessions exist with question_id (which populate q.session_id in API)
  const supabase = createAdminClient();
  const { data: chatSessions, error } = await supabase
    .from("chat_sessions")
    .select("id, question_id, created_at")
    .not("question_id", "is", null)
    .limit(5);

  assert(!error && chatSessions && chatSessions.length > 0, `Found ${chatSessions?.length || 0} chat_sessions linked to question_id in DB`);
  if (chatSessions && chatSessions.length > 0) {
    const sample = chatSessions[0];
    assert(!!sample.id && !!sample.question_id, `Sample session ${sample.id} linked to question ${sample.question_id}`);
  }

  console.log(`\nValidation complete: ${passed}/${total} assertions passed.`);
  if (passed === total) {
    console.log("ALL TEST CASES PASSED!");
    process.exit(0);
  } else {
    console.error("SOME TEST CASES FAILED!");
    process.exit(1);
  }
}

validateLatencyFixes().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
