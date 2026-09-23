import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Testing Network Meetup 10s Timer & Floating AI Chat");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const proximityMapPath = path.join(process.cwd(), "components", "map", "ProximityMap.tsx");
  const proximityMapCode = fs.readFileSync(proximityMapPath, "utf-8");

  const localForumFeedPath = path.join(process.cwd(), "components", "home", "LocalForumFeed.tsx");
  const localForumFeedCode = fs.readFileSync(localForumFeedPath, "utf-8");

  // 1. ProximityMap has showNextMeetupBanner state
  assert(
    proximityMapCode.includes("showNextMeetupBanner") && proximityMapCode.includes("useState(true)"),
    "ProximityMap manages showNextMeetupBanner state initialized to true"
  );

  // 2. ProximityMap has 10-second timer (10000ms)
  assert(
    proximityMapCode.includes("10000") && proximityMapCode.includes("setShowNextMeetupBanner(false)"),
    "ProximityMap automatically dismisses Next Meetup banner after 10 seconds"
  );

  // 3. ProximityMap conditions Next Meetup banner on showNextMeetupBanner
  assert(
    proximityMapCode.includes("showNextMeetupBanner && nextEvent"),
    "ProximityMap renders Next Meetup conditionally on showNextMeetupBanner"
  );

  // 4. ProximityMap does NOT contain static inline ProxNet AI card form
  assert(
    !proximityMapCode.includes("Dedicated ProxNet AI Chat Card (Own Line on Network Tab)"),
    "ProximityMap removed static inline ProxNet AI Chat card"
  );

  // 5. ProximityMap contains floating action button (FAB) pinned to bottom right
  assert(
    proximityMapCode.includes("fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40") ||
    (proximityMapCode.includes("fixed bottom-") && proximityMapCode.includes("right-") && proximityMapCode.includes("ProxNet AI")),
    "ProximityMap renders ProxNet AI Chat as a floating action button on the bottom right"
  );

  // 6. Floating button triggers navigation to /proxnet-ai
  assert(
    proximityMapCode.includes("router.push(\"/proxnet-ai\")"),
    "Floating action button routes to `/proxnet-ai`"
  );

  // 7. LocalForumFeed imports isPastEvent from lib/date
  assert(
    localForumFeedCode.includes("import { isPastEvent } from \"@/lib/date\";"),
    "LocalForumFeed imports isPastEvent from lib/date"
  );

  // 8. LocalForumFeed computes upcomingEvents and nextEvent
  assert(
    localForumFeedCode.includes("const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;"),
    "LocalForumFeed computes nextEvent from upcoming events"
  );

  // 9. LocalForumFeed renders permanent Next Meetup banner on the Forum tab
  assert(
    localForumFeedCode.includes("Next Meetup") && localForumFeedCode.includes("router.push(`/event/${nextEvent.id}`)"),
    "LocalForumFeed renders Next Meetup banner permanently on Forum tab"
  );

  console.log("\n=================================================");
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
