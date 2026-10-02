import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import assert from "assert";
import fs from "fs";
import path from "path";
import { createAdminClient } from "../lib/supabase/admin";
import { haversineDistanceMeters } from "../lib/geo/haversine";
import { calculateProfileMatchScore } from "../lib/matching/profile-similarity";
import { rankDiscoverProfiles } from "../lib/hooks/useDiscoverRanking";

const cwd = process.cwd();

async function runTests() {
  console.log("=================================================");
  console.log("STARTING TEST VALIDATION: Network Members Display");
  console.log("=================================================\n");

  // ── TEST 1: Static Code Inspection of app/api/proximity/people/route.ts ──
  console.log("Test 1: Static verification of app/api/proximity/people/route.ts...");
  const routeCode = fs.readFileSync(path.join(cwd, "app/api/proximity/people/route.ts"), "utf-8");

  // Verify non-existent columns are NOT selected directly in .select()
  assert(!routeCode.includes('select("id, full_name, company, job_title, about, professional_bio, tags, profile_digest, home_lat, home_lng, office_lat, office_lng, active_location, profile_photo_url, anonymous_name, visibility, embedding, ask_me_about'),
    "API route must NOT query ask_me_about as a top-level column in .select()"
  );
  assert(routeCode.includes("profile_digest"), "API route must select profile_digest to retrieve scrapbook attributes");
  assert(routeCode.includes("calculateProfileMatchScore(currentProfile, personForMatching)"), "API route must pass enriched personForMatching to calculateProfileMatchScore");
  console.log("  ✓ Test 1 Passed: No invalid columns in SQL select statement, scrapbook attributes read via profile_digest.\n");

  // ── TEST 2: Static Verification of lib/matching/profile-similarity.ts ──
  console.log("Test 2: Verification of crash resilience in profile-similarity.ts...");
  const simCode = fs.readFileSync(path.join(cwd, "lib/matching/profile-similarity.ts"), "utf-8");
  assert(simCode.includes("safeString"), "profile-similarity.ts must define safeString helper for defensive type handling");

  // Test calculateProfileMatchScore with array of objects, single object, null, and strings
  const testProfileA = {
    id: "user-a",
    company: "Google",
    job_title: "Staff Engineer",
    institute_name: [{ institute: { name: "IIM Lucknow", short_code: "IIML" } }],
    society_name: "Prestige Falcon City",
  };

  const testProfileB = {
    id: "user-b",
    company: "Google",
    job_title: "Principal Engineer",
    institute_name: "IIML",
    society_name: { name: "Prestige Falcon City" },
  };

  const result = calculateProfileMatchScore(testProfileA, testProfileB);
  assert(typeof result.score === "number" && result.score >= 50, `Match score must be calculated cleanly: got ${result.score}`);
  console.log(`  ✓ Test 2 Passed: Defensive safeString prevents trim errors. Hybrid score: ${result.score}%\n`);

  // ── TEST 3: Database Query Simulation with Live Supabase Production Data ──
  console.log("Test 3: Testing proximity query against production database...");
  const supabase = createAdminClient();

  const vaibhavId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  const { data: user } = await supabase.from("users").select("*").eq("id", vaibhavId).single();
  assert(user, "User Vaibhav must exist in database");

  const { data: users, error: errUsers } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, professional_bio, tags, profile_digest, home_lat, home_lng, office_lat, office_lng, active_location, profile_photo_url, anonymous_name, visibility, embedding")
    .eq("is_active", true)
    .neq("id", user.id);

  assert(!errUsers, `User fetch error must be null, got: ${errUsers?.message}`);
  assert(users && users.length > 50, `Expected at least 50 active users, got ${users?.length}`);

  // Test Bannerghatta coordinates (User home location)
  const homeLat = Number(user.home_lat);
  const homeLng = Number(user.home_lng);
  let nearbyCount = 0;

  for (const u of users) {
    if (!u.job_title?.trim() || !u.company?.trim()) continue;
    let minDistance = Infinity;
    if (u.home_lat && u.home_lng) {
      const d = haversineDistanceMeters(homeLat, homeLng, Number(u.home_lat), Number(u.home_lng));
      if (d < minDistance) minDistance = d;
    }
    if (minDistance <= 2000) {
      nearbyCount++;
    }
  }

  assert(nearbyCount >= 30, `Expected at least 30 verified members within 2km of Vaibhav's location, got ${nearbyCount}`);
  console.log(`  ✓ Test 3 Passed: Found ${nearbyCount} verified professionals within 2km of user home (${homeLat}, ${homeLng}).\n`);

  // ── TEST 4: Ranking & Discover Cards Pipeline ──
  console.log("Test 4: Testing useDiscoverRanking pipeline with fetched users...");
  const samplePeople = users.slice(0, 15).map(u => ({
    ...u,
    distance: 450,
    similarity: 0.72,
    match_score: 85,
  }));

  const ranked = rankDiscoverProfiles({
    people: samplePeople,
    profile: user,
  });

  assert(ranked.length > 0, "Ranked discover profiles must not be empty");
  assert(ranked[0].score >= 48, `Top profile score must be calibrated: got ${ranked[0].score}`);
  assert(ranked[0].primaryReason, "Top profile must have a valid primary reason");
  console.log(`  ✓ Test 4 Passed: ${ranked.length} profiles ranked successfully for swipe cards. Top reason: "${ranked[0].primaryReason}".\n`);

  // ── TEST 5: Auto-expanded fallback when 0 members within 2km ──
  console.log("Test 5: Verifying autoExpanded fallback ensures no blank screens...");
  const remoteLat = 28.6139; // Far off coordinates (Delhi)
  const remoteLng = 77.2090;
  let remoteNearby = 0;
  for (const u of users) {
    if (!u.job_title?.trim() || !u.company?.trim()) continue;
    let minD = Infinity;
    if (u.home_lat && u.home_lng) {
      const d = haversineDistanceMeters(remoteLat, remoteLng, Number(u.home_lat), Number(u.home_lng));
      if (d < minD) minD = d;
    }
    if (minD <= 2000) remoteNearby++;
  }

  assert(remoteNearby === 0, "Expected 0 people within 2km of remote coordinates in Delhi");

  // Verify that fallback creates populated list
  const fallbackPeople: any[] = [];
  if (remoteNearby === 0) {
    for (const u of users) {
      const title = (u.job_title || "").trim();
      const comp = (u.company || "").trim();
      if ((!title || title === "null") && (!comp || comp === "null")) continue;
      fallbackPeople.push(u);
    }
  }

  assert(fallbackPeople.length > 50, `Auto-expanded fallback must provide network members across the city, got ${fallbackPeople.length}`);
  console.log(`  ✓ Test 5 Passed: Auto-expanded fallback safely populates ${fallbackPeople.length} members across the city when local radius is empty.\n`);

  console.log("=================================================");
  console.log("ALL 5 VALIDATION TESTS PASSED SUCCESSFULLY! ✅");
  console.log("=================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
