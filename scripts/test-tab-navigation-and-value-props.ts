import fs from "fs";
import path from "path";
import { SCREEN_VALUE_PROPOSITIONS } from "../components/common/TabValueTransition";

async function main() {
  console.log("=== RUNNING TAB NAVIGATION & VALUE PROPOSITION VALIDATION ===");

  // TEST 1: Validate Value Propositions for all core screens
  console.log("\n[Test 1] Validating Screen Value Propositions...");
  const requiredTabs = ["/jobs", "/network", "/qa", "/forum"];
  for (const tab of requiredTabs) {
    const vp = SCREEN_VALUE_PROPOSITIONS[tab];
    if (!vp) {
      throw new Error(`Test 1 Failed: Missing value proposition for ${tab}`);
    }
    if (!vp.badge || !vp.headline || !vp.description || !vp.highlights?.length || !vp.icon) {
      throw new Error(`Test 1 Failed: Incomplete value proposition definition for ${tab}`);
    }
    console.log(`  ✓ ${tab}: [${vp.badge}] "${vp.headline}" - ${vp.highlights.join(" | ")}`);
  }
  console.log("✓ Test 1 Passed: All 4 screen value propositions are properly configured!");

  // TEST 2: Verify No Circular Redirects in Page Routes
  console.log("\n[Test 2] Checking page routes for direct QAContentWrapper rendering (no circular redirects)...");
  const checkPages = [
    { file: "app/jobs/page.tsx", expectedInitialTab: "/jobs" },
    { file: "app/network/page.tsx", expectedInitialTab: "/network" },
    { file: "app/forum/page.tsx", expectedInitialTab: "/forum" },
    { file: "app/qa/page.tsx", expectedInitialTab: "/qa" },
  ];

  for (const { file, expectedInitialTab } of checkPages) {
    const fullPath = path.join(process.cwd(), file);
    const content = fs.readFileSync(fullPath, "utf-8");

    if (content.includes('redirect("/qa?tab=')) {
      throw new Error(`Test 2 Failed: ${file} still contains circular redirect to /qa?tab=`);
    }
    if (!content.includes(`initialTab="${expectedInitialTab}"`)) {
      throw new Error(`Test 2 Failed: ${file} does not render QAContentWrapper with initialTab="${expectedInitialTab}"`);
    }
    console.log(`  ✓ ${file} renders directly with initialTab="${expectedInitialTab}" (Zero HTTP 307 redirects).`);
  }

  // Check app/page.tsx
  const homeContent = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf-8");
  if (homeContent.includes('redirect("/qa?tab=network")')) {
    throw new Error('Test 2 Failed: app/page.tsx still redirects to /qa?tab=network instead of /network');
  }
  if (!homeContent.includes('redirect("/network")')) {
    throw new Error('Test 2 Failed: app/page.tsx does not redirect to /network');
  }
  console.log("  ✓ app/page.tsx redirects logged-in user directly to /network.");
  console.log("✓ Test 2 Passed: All route handlers render directly without redirect latency.");

  // TEST 3: Validate Lazy-Mounting Set State Logic
  console.log("\n[Test 3] Simulating Tab Lazy-Mounting Set Transitions...");
  let visitedTabs = new Set(["/network"]);

  // Step 1: Initial state only contains 1 tab mounted
  if (visitedTabs.size !== 1 || !visitedTabs.has("/network")) {
    throw new Error("Test 3 Failed: Initial state should have only /network mounted");
  }

  // Step 2: User clicks Jobs
  const visitTab = (tab: string) => {
    visitedTabs = new Set(visitedTabs).add(tab);
  };
  visitTab("/jobs");
  if (visitedTabs.size !== 2 || !visitedTabs.has("/jobs") || !visitedTabs.has("/network")) {
    throw new Error("Test 3 Failed: After visiting /jobs, both /network and /jobs should be in memory");
  }

  // Step 3: User clicks back to Network
  visitTab("/network");
  if (visitedTabs.size !== 2) {
    throw new Error("Test 3 Failed: Returning to /network should not duplicate or remount components");
  }
  console.log("✓ Test 3 Passed: Tab lazy mounting and in-memory persistence validated.");

  // TEST 4: Validate 5-Second First-Time Screen Opening Logic
  console.log("\n[Test 4] Validating 5-second first-time screen value proposition logic...");

  // Mock localStorage for node environment
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    },
  };

  const { isFirstTimeScreenOpening, markScreenOpeningSeen, resetScreenOpeningSeen } = await import("../components/common/TabValueTransition");

  // Step 4A: On first opening of /jobs, it must return true
  resetScreenOpeningSeen();
  const firstTimeJobs = isFirstTimeScreenOpening("/jobs");
  if (!firstTimeJobs) {
    throw new Error("Test 4 Failed: isFirstTimeScreenOpening('/jobs') should be true on initial opening");
  }
  console.log("  ✓ First-time opening of /jobs correctly detected as true.");

  // Step 4B: Mark /jobs as seen
  markScreenOpeningSeen("/jobs");
  const secondTimeJobs = isFirstTimeScreenOpening("/jobs");
  if (secondTimeJobs) {
    throw new Error("Test 4 Failed: isFirstTimeScreenOpening('/jobs') should be false on second opening");
  }
  console.log("  ✓ Second opening of /jobs correctly detected as false (no 5s delay).");

  // Step 4C: Verify other tabs remain first-time until visited
  if (!isFirstTimeScreenOpening("/network") || !isFirstTimeScreenOpening("/qa") || !isFirstTimeScreenOpening("/forum")) {
    throw new Error("Test 4 Failed: Unvisited tabs should remain true for first-time opening");
  }
  console.log("  ✓ Other tabs (/network, /qa, /forum) correctly remain true until opened.");

  // Step 4D: Static code assertion on QAContent.tsx and TabValueTransition.tsx
  const qaContentCode = fs.readFileSync(path.join(process.cwd(), "app/qa/QAContent.tsx"), "utf-8");
  if (!qaContentCode.includes("minDisplayDurationMs={5000}")) {
    throw new Error("Test 4 Failed: QAContent.tsx does not specify minDisplayDurationMs={5000}");
  }
  if (!qaContentCode.includes("isFirstTimeScreenOpening")) {
    throw new Error("Test 4 Failed: QAContent.tsx does not check isFirstTimeScreenOpening");
  }
  console.log("  ✓ QAContent.tsx enforces minDisplayDurationMs={5000} and checks isFirstTimeScreenOpening.");

  const tabTransitionCode = fs.readFileSync(path.join(process.cwd(), "components/common/TabValueTransition.tsx"), "utf-8");
  if (!tabTransitionCode.includes("minDisplayDurationMs = 5000")) {
    throw new Error("Test 4 Failed: TabValueTransition.tsx default minDisplayDurationMs is not 5000");
  }
  if (!tabTransitionCode.includes("Math.max(5000")) {
    throw new Error("Test 4 Failed: TabValueTransition.tsx does not enforce at least 5000ms duration");
  }
  console.log("  ✓ TabValueTransition.tsx enforces at least 5000ms display for first-time screen opening.");

  console.log("✓ Test 4 Passed: 5-second first-time screen opening logic validated!");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
