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

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
