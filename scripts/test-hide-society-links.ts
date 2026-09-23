import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Running Test Suite: Hide Broken Society Links");
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
  const proximityMapContent = fs.readFileSync(proximityMapPath, "utf-8");

  // 1. ProximityMap must not contain "Society Tech Directory & Yearbook" banner
  assert(
    !proximityMapContent.includes("Society Tech Directory & Yearbook"),
    "ProximityMap does NOT contain 'Society Tech Directory & Yearbook' banner"
  );

  // 2. ProximityMap must not contain "Open Directory" button
  assert(
    !proximityMapContent.includes("Open Directory"),
    "ProximityMap does NOT contain 'Open Directory' link/button"
  );

  // 3. ProximityMap must not contain router.push to /society/
  assert(
    !proximityMapContent.includes("router.push(`/society/"),
    "ProximityMap does NOT navigate to `/society/`"
  );

  // 4. In selectedPerson details, society name is shown as plain text without link
  assert(
    proximityMapContent.includes('span className="font-semibold text-xs text-[var(--color-text)]">\n                      {selectedPerson.society_name}\n                    </span>') ||
    (proximityMapContent.includes("selectedPerson.society_name") && !proximityMapContent.includes("/society/")),
    "ProximityMap displays selectedPerson.society_name as plain text instead of clickable broken link"
  );

  // 5. ScrapbookCardModal must not generate /society/ share links
  const scrapbookPath = path.join(process.cwd(), "components", "profile", "ScrapbookCardModal.tsx");
  const scrapbookContent = fs.readFileSync(scrapbookPath, "utf-8");

  assert(
    !scrapbookContent.includes("/society/"),
    "ScrapbookCardModal does NOT generate `/society/` share links"
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
