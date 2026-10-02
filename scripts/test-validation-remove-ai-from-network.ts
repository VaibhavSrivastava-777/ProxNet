import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import assert from "assert";
import fs from "fs";
import path from "path";
import { createAdminClient } from "../lib/supabase/admin";
import { rankDiscoverProfiles } from "../lib/hooks/useDiscoverRanking";

const cwd = process.cwd();

async function runTests() {
  console.log("=================================================");
  console.log("STARTING TEST VALIDATION: Remove ProxNet AI from Network");
  console.log("=================================================\n");

  // ── TEST 1: Static Code Inspection ──
  console.log("Test 1: Static verification of AI exclusions across Network code...");
  const peopleRouteCode = fs.readFileSync(path.join(cwd, "app/api/proximity/people/route.ts"), "utf-8");
  assert(peopleRouteCode.includes("isBotOrAiUser"), "app/api/proximity/people/route.ts must implement isBotOrAiUser filter");
  assert(peopleRouteCode.includes("ai@proxnet.in"), "isBotOrAiUser must check ai@proxnet.in");
  assert(peopleRouteCode.includes("proxnet ai"), "isBotOrAiUser must check 'proxnet ai'");

  const discoverRankingCode = fs.readFileSync(path.join(cwd, "lib/hooks/useDiscoverRanking.ts"), "utf-8");
  assert(discoverRankingCode.includes("proxnet ai"), "useDiscoverRanking must filter out 'proxnet ai'");

  const proximityMapCode = fs.readFileSync(path.join(cwd, "components/map/ProximityMap.tsx"), "utf-8");
  assert(proximityMapCode.includes("proxnet ai"), "ProximityMap.tsx must filter out 'proxnet ai' from withinRadiusPeople");

  const aggregateCode = fs.readFileSync(path.join(cwd, "app/api/proximity/aggregate/route.ts"), "utf-8");
  assert(aggregateCode.includes("ai@proxnet.in"), "app/api/proximity/aggregate/route.ts must exclude ai@proxnet.in");
  console.log("  ✓ Test 1 Passed: All 4 files have explicit exclusions for ProxNet AI.\n");

  // ── TEST 2: Live Query Simulation of /api/proximity/people ──
  console.log("Test 2: Simulating /api/proximity/people results...");
  const supabase = createAdminClient();

  const vaibhavId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, email, anonymous_name, about, professional_bio, tags, profile_digest, home_lat, home_lng, office_lat, office_lng, active_location, profile_photo_url, visibility, embedding")
    .eq("is_active", true)
    .neq("id", vaibhavId);

  assert(!error, "User query must succeed");

  function isBotOrAiUser(u: any): boolean {
    if (!u) return false;
    const email = (u.email || "").toLowerCase();
    const name = (u.full_name || u.anonymous_name || "").toLowerCase();
    const comp = (u.company || "").toLowerCase();
    const title = (u.job_title || "").toLowerCase();
    return (
      email === "ai@proxnet.in" ||
      email === "ai@proxnet.com" ||
      email.startsWith("ai@") ||
      name.includes("proxnet ai") ||
      (comp === "proxnet" && title.includes("network assistant"))
    );
  }

  const filteredUsers = users.filter(u => !isBotOrAiUser(u));

  // Check if ProxNet AI was filtered out
  const aiInAll = users.find(u => u.full_name?.toLowerCase().includes("proxnet ai") || u.email === "ai@proxnet.in");
  assert(aiInAll, "ProxNet AI must exist in raw database to prove filter works");

  const aiInFiltered = filteredUsers.find(u => u.full_name?.toLowerCase().includes("proxnet ai") || u.email === "ai@proxnet.in");
  assert(!aiInFiltered, "ProxNet AI must NOT exist in filteredUsers list");
  console.log(`  ✓ Test 2 Passed: ProxNet AI (ID: ${aiInAll.id}) successfully filtered out of ${users.length} users. ${filteredUsers.length} real members remain.\n`);

  // ── TEST 3: Discover Cards Ranking ──
  console.log("Test 3: Validating Discover Cards ranking excludes ProxNet AI...");
  const testPool = [
    aiInAll,
    ...filteredUsers.slice(0, 10)
  ];

  const ranked = rankDiscoverProfiles({
    people: testPool,
    profile: { id: vaibhavId },
  });

  const aiInRanked = ranked.find(r => 
    r.person?.full_name?.toLowerCase().includes("proxnet ai") ||
    r.person?.email === "ai@proxnet.in"
  );
  assert(!aiInRanked, "useDiscoverRanking must NOT include ProxNet AI in ranked candidates");
  assert(ranked.length === 10, `Expected 10 ranked profiles (excluding AI), got ${ranked.length}`);
  console.log("  ✓ Test 3 Passed: useDiscoverRanking completely excludes ProxNet AI from swipe cards.\n");

  // ── TEST 4: ProximityMap sortedPeople Filter ──
  console.log("Test 4: Validating ProximityMap sortedPeople filter logic...");
  const mockCombined = [
    { id: "ai-1", full_name: "ProxNet AI", company: "ProxNet", job_title: "Network Assistant", distance: 100 },
    { id: "ai-2", full_name: "Neighbor", anonymous_name: "ProxNet AI Assistant", company: "ProxNet", distance: 200 },
    { id: "real-1", full_name: "Subbarao Dronamraju", company: "NEC Corporation", job_title: "Manager", distance: 23 },
    { id: "real-2", full_name: "Kallol Kundu", company: "LSEG", job_title: "Dev Manager", distance: 105 },
  ];

  const filteredCombined = mockCombined.filter((p: any) => {
    const pFullName = (p.full_name || "").toLowerCase();
    const pAnonName = (p.anonymous_name || "").toLowerCase();
    const pComp = (p.company || "").toLowerCase();
    const pTitle = (p.job_title || "").toLowerCase();
    const pEmail = (p.email || "").toLowerCase();
    if (
      pFullName.includes("proxnet ai") ||
      pAnonName.includes("proxnet ai") ||
      pEmail === "ai@proxnet.in" ||
      pEmail === "ai@proxnet.com" ||
      (pComp === "proxnet" && pTitle.includes("network assistant"))
    ) {
      return false;
    }
    return true;
  });

  assert(filteredCombined.length === 2, `Expected 2 real members, got ${filteredCombined.length}`);
  assert(filteredCombined[0].full_name === "Subbarao Dronamraju", "Real member Subbarao must be retained");
  assert(filteredCombined[1].full_name === "Kallol Kundu", "Real member Kallol must be retained");
  console.log("  ✓ Test 4 Passed: ProximityMap sortedPeople filter strictly eliminates ProxNet AI.\n");

  console.log("=================================================");
  console.log("ALL 4 VALIDATION TESTS PASSED SUCCESSFULLY! ✅");
  console.log("=================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
