import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Test suite for Chats & Notifications Revamp
function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING VALIDATION: CHATS & NOTIFICATIONS REVAMP");
  console.log("=================================================\n");

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

  // Test 1: ChatRoom.tsx AI suggestions completely removed
  const chatRoomPath = join(root, "components", "chat", "ChatRoom.tsx");
  assert(existsSync(chatRoomPath), "ChatRoom.tsx exists");
  const chatRoomContent = readFileSync(chatRoomPath, "utf-8");

  assert(!chatRoomContent.includes("loadingSuggestions"), "ChatRoom: loadingSuggestions state removed");
  assert(!chatRoomContent.includes("fetchSuggestions"), "ChatRoom: fetchSuggestions function removed");
  assert(!chatRoomContent.includes("suggestionDebounceRef"), "ChatRoom: suggestionDebounceRef removed");
  assert(!chatRoomContent.includes("AI suggestion chips"), "ChatRoom: AI suggestion chips UI removed");
  assert(chatRoomContent.includes("ICEBREAKERS.map"), "ChatRoom: Static icebreakers retained for empty state");
  assert(chatRoomContent.includes("chat_cache_${sessionId}"), "ChatRoom: sessionStorage instant hydration added");

  // Verify duplicate loadMessages() is removed
  const loadMatches = chatRoomContent.match(/loadMessages\(\);/g) || [];
  // Should only be called once on initial useEffect mount, once in postgres_changes, and on error handlers
  assert(loadMatches.length <= 5, `ChatRoom: loadMessages calls sanitized (found ${loadMatches.length})`);

  // Test 2: Suggestions Route decommissioned
  const suggestionsRoutePath = join(root, "app", "api", "chat", "[sessionId]", "suggestions", "route.ts");
  assert(existsSync(suggestionsRoutePath), "suggestions/route.ts exists");
  const suggestionsContent = readFileSync(suggestionsRoutePath, "utf-8");
  assert(suggestionsContent.includes("suggestions: []"), "suggestions route returns empty array immediately");
  assert(!suggestionsContent.includes("ANTHROPIC_API_KEY"), "suggestions route does not invoke Anthropic API");

  // Test 3: Chat GET API parallelization & Bot auto-replies integrity
  const chatRoutePath = join(root, "app", "api", "chat", "[sessionId]", "route.ts");
  assert(existsSync(chatRoutePath), "chat/[sessionId]/route.ts exists");
  const chatRouteContent = readFileSync(chatRoutePath, "utf-8");
  assert(chatRouteContent.includes("Promise.all(["), "chat GET route uses Promise.all for parallel queries");
  assert(chatRouteContent.includes("markAsReadPromise"), "chat GET route executes mark-as-read concurrently");
  assert(chatRouteContent.includes("otherUser.source === \"simulated\""), "chat POST route preserves simulated bot persona replies");

  // Test 4: firebase-messaging-sw.js tab focus & navigation
  const swPath = join(root, "public", "firebase-messaging-sw.js");
  assert(existsSync(swPath), "firebase-messaging-sw.js exists");
  const swContent = readFileSync(swPath, "utf-8");
  assert(swContent.includes("client.navigate(targetUrl)"), "Service Worker uses client.navigate for existing tab");
  assert(swContent.includes("client.focus()"), "Service Worker focuses existing window");
  assert(swContent.includes("clients.openWindow(targetUrl)"), "Service Worker falls back to openWindow");
  assert(swContent.includes("tag: tag"), "Service Worker uses tag-based deduplication in onBackgroundMessage");

  // Test 5: NavClient.tsx 7-day push prompt, contextual triggers, iOS standalone PWA
  const navClientPath = join(root, "components", "NavClient.tsx");
  assert(existsSync(navClientPath), "NavClient.tsx exists");
  const navClientContent = readFileSync(navClientPath, "utf-8");
  assert(navClientContent.includes("SEVEN_DAYS_MS"), "NavClient defines SEVEN_DAYS_MS");
  assert(navClientContent.includes("dismissed_push_prompt_at"), "NavClient uses timestamp-based dismissal");
  assert(navClientContent.includes("isPushPromptDismissed"), "NavClient uses isPushPromptDismissed helper");
  assert(navClientContent.includes("isStandalone"), "NavClient checks PWA standalone mode");
  assert(navClientContent.includes("visibilitychange"), "NavClient refreshes FCM token on visibilitychange");
  assert(navClientContent.includes("Don't miss replies in this conversation"), "NavClient has contextual chat prompt copy");

  // Test 6: Daily Engagement Cron Route & Vercel Schedule
  const dailyEngagementPath = join(root, "app", "api", "cron", "daily-engagement", "route.ts");
  assert(existsSync(dailyEngagementPath), "daily-engagement cron route exists");
  const dailyEngagementContent = readFileSync(dailyEngagementPath, "utf-8");
  assert(dailyEngagementContent.includes("ENGAGEMENT_TEMPLATES"), "daily-engagement defines rotating templates");
  assert(dailyEngagementContent.includes("in_app_notifications"), "daily-engagement checks recent in_app_notifications");
  assert(dailyEngagementContent.includes("twentyFourHoursAgo"), "daily-engagement filters for 24-hour notification gap");
  assert(dailyEngagementContent.includes("sendNotification"), "daily-engagement sends notification via sendNotification");

  const vercelJsonPath = join(root, "vercel.json");
  const vercelJson = JSON.parse(readFileSync(vercelJsonPath, "utf-8"));
  const cronPaths = (vercelJson.crons || []).map((c: any) => c.path);
  assert(cronPaths.includes("/api/cron/daily-engagement"), "vercel.json includes /api/cron/daily-engagement cron");

  console.log(`\n=================================================`);
  console.log(`🏁 VALIDATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
