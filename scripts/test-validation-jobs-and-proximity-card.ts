import fs from "fs";
import path from "path";
import assert from "assert";

console.log("================================================================================");
console.log("🧪 VALIDATION SUITE: Jobs Tab 404 Fix, See All Card Option, Pioneer LinkedIn, Proximity Card Scrapbook");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

const cwd = process.cwd();

// --- TEST 1: Fix 404 when clicking profiles from Jobs tab ---
test("1.1 SuggestedJobs.tsx does NOT route to broken /chat?user= path", () => {
  const suggestedJobsCode = fs.readFileSync(path.join(cwd, "components", "jobs", "SuggestedJobs.tsx"), "utf-8");
  assert(!suggestedJobsCode.includes("/chat?user="), "SuggestedJobs must not push to non-existent /chat?user= route");
});

test("1.2 SuggestedJobs.tsx opens ProximityCardModal on profile click", () => {
  const suggestedJobsCode = fs.readFileSync(path.join(cwd, "components", "jobs", "SuggestedJobs.tsx"), "utf-8");
  assert(suggestedJobsCode.includes("setSelectedPerson(person)"), "Clicking helper card sets selectedPerson");
  assert(suggestedJobsCode.includes("<ProximityCardModal"), "SuggestedJobs renders ProximityCardModal when selectedPerson is set");
});

test("1.3 app/chat/page.tsx exists and redirects to prevent any 404", () => {
  const chatPagePath = path.join(cwd, "app", "chat", "page.tsx");
  assert(fs.existsSync(chatPagePath), "app/chat/page.tsx must exist");
  const chatPageCode = fs.readFileSync(chatPagePath, "utf-8");
  assert(chatPageCode.includes("redirect(`/network?userId="), "app/chat/page.tsx redirects target users to /network?userId=");
});

// --- TEST 2: 'See All' from Jobs opens Network tab with list view and Proximity Card view option ---
test("2.1 'See All' in SuggestedJobs.tsx opens network tab with list view query", () => {
  const suggestedJobsCode = fs.readFileSync(path.join(cwd, "components", "jobs", "SuggestedJobs.tsx"), "utf-8");
  assert(suggestedJobsCode.includes('router.push("/qa?tab=network&view=list")'), "See all navigates with view=list");
});

test("2.2 ProximityMap.tsx synchronizes viewMode from searchParams", () => {
  const proximityMapCode = fs.readFileSync(path.join(cwd, "components", "map", "ProximityMap.tsx"), "utf-8");
  assert(proximityMapCode.includes('searchParams.get("view")'), "ProximityMap reads view searchParam");
  assert(proximityMapCode.includes('setViewMode(v as any)'), "ProximityMap sets viewMode from param");
});

test("2.3 ProximityMap.tsx displays clear labeled options for Proximity Cards, List, and Map", () => {
  const proximityMapCode = fs.readFileSync(path.join(cwd, "components", "map", "ProximityMap.tsx"), "utf-8");
  assert(proximityMapCode.includes("Cards"), "ProximityMap includes Cards label");
  assert(proximityMapCode.includes("List"), "ProximityMap includes List label");
  assert(proximityMapCode.includes("Map"), "ProximityMap includes Map label");
});

test("2.4 List view in ProximityMap.tsx offers prominent Proximity Card View switcher", () => {
  const proximityMapCode = fs.readFileSync(path.join(cwd, "components", "map", "ProximityMap.tsx"), "utf-8");
  assert(proximityMapCode.includes("Proximity Card View"), "List view contains 'Proximity Card View' switcher button");
  assert(proximityMapCode.includes('onClick={() => setViewMode("discover")}'), "Proximity Card View button switches to discover mode");
});

// --- TEST 3: 'Pioneer +10 pts' opens LinkedIn with company name filter ---
test("3.1 SuggestedJobs.tsx defines handlePioneerClick with LinkedIn company filter URL", () => {
  const suggestedJobsCode = fs.readFileSync(path.join(cwd, "components", "jobs", "SuggestedJobs.tsx"), "utf-8");
  assert(suggestedJobsCode.includes("handlePioneerClick"), "SuggestedJobs defines handlePioneerClick");
  assert(
    suggestedJobsCode.includes("https://www.linkedin.com/search/results/people/?keywords="),
    "handlePioneerClick targets LinkedIn people search with keywords filter"
  );
  assert(
    suggestedJobsCode.includes("window.open(linkedInUrl"),
    "handlePioneerClick tries to open LinkedIn in new window"
  );
});

test("3.2 All 'Pioneer +10 pts' buttons invoke handlePioneerClick", () => {
  const suggestedJobsCode = fs.readFileSync(path.join(cwd, "components", "jobs", "SuggestedJobs.tsx"), "utf-8");
  assert(suggestedJobsCode.includes("handlePioneerClick(heroJobItem.group.company)"), "Hero Pioneer button invokes handlePioneerClick");
  assert(suggestedJobsCode.includes("handlePioneerClick(group.company)"), "Group Pioneer button invokes handlePioneerClick");
  assert(suggestedJobsCode.includes("handlePioneerClick(m.company)"), "Matched job Pioneer button invokes handlePioneerClick");
  assert(suggestedJobsCode.includes("setActiveCompanyModal(group)"), "Company list Pioneer button preserves modal toggle");
});

// --- TEST 4: Network Tab Proximity Card Scrapbook entries ('ask me about', etc.) ---
test("4.1 /api/proximity/people selects scrapbook columns from users table", () => {
  const peopleRouteCode = fs.readFileSync(path.join(cwd, "app", "api", "proximity", "people", "route.ts"), "utf-8");
  assert(peopleRouteCode.includes("ask_me_about"), "people route selects ask_me_about");
  assert(peopleRouteCode.includes("help_offers"), "people route selects help_offers");
  assert(peopleRouteCode.includes("tinkering_with"), "people route selects tinkering_with");
  assert(peopleRouteCode.includes("quick_chat_preference"), "people route selects quick_chat_preference");
  assert(peopleRouteCode.includes("society_name"), "people route selects society_name");
});

test("4.2 /api/proximity/people hydrates ask_me_about, help_offers, and tinkering_with", () => {
  const peopleRouteCode = fs.readFileSync(path.join(cwd, "app", "api", "proximity", "people", "route.ts"), "utf-8");
  assert(peopleRouteCode.includes("ask_me_about: (Array.isArray(u.ask_me_about)"), "people route properly hydrates ask_me_about");
  assert(peopleRouteCode.includes("help_offers: (Array.isArray(u.help_offers)"), "people route properly hydrates help_offers");
  assert(peopleRouteCode.includes("tinkering_with: (Array.isArray(u.tinkering_with)"), "people route properly hydrates tinkering_with");
});

test("4.3 ProximityCardModal.tsx displays 'Ask Me About:', 'I Can Help With:', and 'Tinkering With:'", () => {
  const modalCode = fs.readFileSync(path.join(cwd, "components", "profile", "ProximityCardModal.tsx"), "utf-8");
  assert(modalCode.includes("Ask Me About:"), "ProximityCardModal renders 'Ask Me About:' section");
  assert(modalCode.includes("I Can Help With:"), "ProximityCardModal renders 'I Can Help With:' section");
  assert(modalCode.includes("Tinkering With:"), "ProximityCardModal renders 'Tinkering With:' section");
  assert(modalCode.includes("askMeAboutList"), "ProximityCardModal uses computed askMeAboutList with intelligent fallback");
});

test("4.4 DiscoverCard.tsx (Swipe Card) displays 'Ask me about:' scrapbook section", () => {
  const cardCode = fs.readFileSync(path.join(cwd, "components", "map", "DiscoverCard.tsx"), "utf-8");
  assert(cardCode.includes("Ask me about:"), "DiscoverCard renders 'Ask me about:' section");
  assert(cardCode.includes("Can help you with:"), "DiscoverCard renders 'Can help you with:' section");
  assert(cardCode.includes("Tinkering with:"), "DiscoverCard renders 'Tinkering with:' section");
  assert(cardCode.includes("askMeAboutList"), "DiscoverCard uses computed askMeAboutList with intelligent fallback");
});

console.log("\n================================================================================");
console.log(`📊 Validation Summary: ${passed} Passed, ${failed} Failed`);
console.log("================================================================================\n");

if (failed > 0) {
  process.exit(1);
}
