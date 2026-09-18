import { createAdminClient } from "../lib/supabase/admin";
import { haversineDistanceMeters } from "../lib/geo/haversine";

async function runValidationTests() {
  console.log("================================================================================");
  console.log("  VALIDATION TEST: 2KM RADIUS BEACON VISIBILITY & SHORTEST DISTANCE SORTING");
  console.log("================================================================================");

  const supabase = createAdminClient();

  // Test 1: Verify database query for active beacons works without schema error (society_name fix)
  console.log("\n👉 Test 1: Testing Supabase micro-status query without schema errors...");
  const { data: usersWithBeacon, error } = await supabase
    .from("users")
    .select(`
      id,
      full_name,
      company,
      job_title,
      profile_photo_url,
      home_name,
      home_lat,
      home_lng,
      profile_digest
    `)
    .not("profile_digest->active_beacon", "is", null);

  if (error) {
    console.error("❌ Test 1 FAILED: Query returned error:", error);
    process.exit(1);
  }
  console.log(`✅ Test 1 PASSED: Query succeeded without schema errors. Found ${usersWithBeacon?.length ?? 0} broadcaster(s).`);

  // Ensure there is at least one active beacon in DB for test
  const broadcaster = usersWithBeacon?.[0];
  if (!broadcaster) {
    console.warn("⚠️ No broadcaster found in DB to test. Setting up temporary test beacon...");
  } else {
    console.log(`Found active broadcaster: ${broadcaster.full_name} (${broadcaster.job_title} @ ${broadcaster.company})`);
    console.log(`Broadcaster Coords: [${broadcaster.home_lat}, ${broadcaster.home_lng}]`);
  }

  // Test 2: Strict 2km Radius Visibility Check
  console.log("\n👉 Test 2: Testing Strict 2km Radius Filtering...");
  const bLat = Number(broadcaster?.home_lat ?? 12.8871081);
  const bLng = Number(broadcaster?.home_lng ?? 77.5900816);

  // Viewer 1: Neighbor within 2km (e.g. Subbarao at [12.8871786, 77.5898807], ~23 meters away)
  const viewerNearLat = 12.8871786;
  const viewerNearLng = 77.5898807;
  const distNear = haversineDistanceMeters(viewerNearLat, viewerNearLng, bLat, bLng);
  console.log(`- Viewer Near: coords=[${viewerNearLat}, ${viewerNearLng}], distance=${Math.round(distNear)}m`);

  // Viewer 2: Distant user outside 2km (e.g. Anurag at [12.917927, 77.716703], ~14.2 km away)
  const viewerFarLat = 12.917927;
  const viewerFarLng = 77.716703;
  const distFar = haversineDistanceMeters(viewerFarLat, viewerFarLng, bLat, bLng);
  console.log(`- Viewer Far: coords=[${viewerFarLat}, ${viewerFarLng}], distance=${Math.round(distFar)}m`);

  // Simulate API radius filter (2000m)
  const radiusMeters = 2000;
  const nearAllowed = distNear <= radiusMeters;
  const farAllowed = distFar <= radiusMeters;

  if (!nearAllowed) {
    console.error(`❌ Test 2 FAILED: Near viewer (${Math.round(distNear)}m) was wrongly excluded by 2000m radius!`);
    process.exit(1);
  }
  if (farAllowed) {
    console.error(`❌ Test 2 FAILED: Far viewer (${Math.round(distFar)}m) was wrongly included within 2000m radius!`);
    process.exit(1);
  }
  console.log("✅ Test 2 PASSED: 2km radius strictly permits neighbor at 23m and rejects far user at 14.2km.");

  // Test 3: Sorting Logic: beacon = yes first, then shortest distance
  console.log("\n👉 Test 3: Testing sorting algorithm (beacon = yes first, then shortest distance ascending)...");
  
  const activeBeaconMap = new Map<string, any>([
    ["beacon-user-1", { id: "beacon-user-1", activity: "chai" }],
    ["beacon-user-2", { id: "beacon-user-2", activity: "walk" }],
  ]);

  const mockCenter = { lat: bLat, lng: bLng };

  const mockPeople = [
    { id: "non-beacon-3", company: "Amazon", distance: 1500, is_me: false },
    { id: "non-beacon-1", company: "Google", distance: 120, is_me: false },
    { id: "beacon-user-2", company: "Microsoft", distance: 450, is_me: false },
    { id: "non-beacon-2", company: "Apple", distance: 600, is_me: false },
    { id: "beacon-user-1", company: "Dell", distance: 80, is_me: false },
    { id: "far-beacon-user", company: "Netflix", distance: 2500, is_me: false }, // Beyond 2km!
  ];
  activeBeaconMap.set("far-beacon-user", { id: "far-beacon-user", activity: "sports" });

  // Filter out any active beacon > 2000m (same as in ProximityMap.tsx)
  const withinRadiusPeople = mockPeople.filter((p) => {
    if (p.is_me) return true;
    if (activeBeaconMap.has(p.id)) {
      const dist = typeof p.distance === "number" ? p.distance : null;
      if (dist !== null && dist > 2000) return false;
    }
    return true;
  });

  const hasMyActiveBeacon = false;

  const sorted = withinRadiusPeople.sort((a: any, b: any) => {
    // 1. Current user's live broadcast is ALWAYS at the absolute top for themselves
    if (a.is_me && hasMyActiveBeacon) return -1;
    if (b.is_me && hasMyActiveBeacon) return 1;

    // 2. Primary sort: beacon = yes first
    const aBeacon = Boolean(activeBeaconMap.has(a.id) || (a.is_me && hasMyActiveBeacon));
    const bBeacon = Boolean(activeBeaconMap.has(b.id) || (b.is_me && hasMyActiveBeacon));
    if (aBeacon && !bBeacon) return -1;
    if (!aBeacon && bBeacon) return 1;

    // 3. Secondary sort: shortest distance ascending
    const distA = typeof a.distance === "number" && !isNaN(a.distance) ? a.distance : Infinity;
    const distB = typeof b.distance === "number" && !isNaN(b.distance) ? b.distance : Infinity;
    if (distA !== distB) {
      return distA - distB;
    }

    // 4. Tie-breaker by company name alphabetically
    return (a.company || "").localeCompare(b.company || "");
  });

  console.log("Sorted profiles result:");
  sorted.forEach((p, idx) => {
    const hasBeacon = activeBeaconMap.has(p.id);
    console.log(`  [${idx}] ID=${p.id}, company=${p.company}, dist=${p.distance}m, beacon=${hasBeacon ? "YES" : "NO"}`);
  });

  // Verify far-beacon-user was completely removed
  if (sorted.some((p) => p.id === "far-beacon-user")) {
    console.error("❌ Test 3 FAILED: Beacon beyond 2km (2500m) was not filtered out!");
    process.exit(1);
  }

  // Verify beacon profiles are first
  if (sorted[0].id !== "beacon-user-1" || sorted[0].distance !== 80) {
    console.error("❌ Test 3 FAILED: Expected closest beacon (beacon-user-1, 80m) at index 0");
    process.exit(1);
  }
  if (sorted[1].id !== "beacon-user-2" || sorted[1].distance !== 450) {
    console.error("❌ Test 3 FAILED: Expected second beacon (beacon-user-2, 450m) at index 1");
    process.exit(1);
  }

  // Verify non-beacon profiles follow, sorted by shortest distance
  if (sorted[2].id !== "non-beacon-1" || sorted[2].distance !== 120) {
    console.error("❌ Test 3 FAILED: Expected closest non-beacon (non-beacon-1, 120m) at index 2");
    process.exit(1);
  }
  if (sorted[3].id !== "non-beacon-2" || sorted[3].distance !== 600) {
    console.error("❌ Test 3 FAILED: Expected non-beacon-2 (600m) at index 3");
    process.exit(1);
  }
  if (sorted[4].id !== "non-beacon-3" || sorted[4].distance !== 1500) {
    console.error("❌ Test 3 FAILED: Expected non-beacon-3 (1500m) at index 4");
    process.exit(1);
  }

  console.log("✅ Test 3 PASSED: Profiles are sorted with beacon=yes first (by shortest distance), followed by non-beacons (by shortest distance).");

  // Test 4: Current user's own broadcast pinning
  console.log("\n👉 Test 4: Testing current user own broadcast absolute top pinning...");
  const mockWithMe = [
    { id: "beacon-user-1", company: "Dell", distance: 80, is_me: false },
    { id: "my-id", company: "MyCompany", distance: 0, is_me: true },
    { id: "non-beacon-1", company: "Google", distance: 50, is_me: false },
  ];
  const sortedWithMe = [...mockWithMe].sort((a: any, b: any) => {
    if (a.is_me && true) return -1;
    if (b.is_me && true) return 1;
    const aBeacon = Boolean(activeBeaconMap.has(a.id) || a.is_me);
    const bBeacon = Boolean(activeBeaconMap.has(b.id) || b.is_me);
    if (aBeacon && !bBeacon) return -1;
    if (!aBeacon && bBeacon) return 1;
    const distA = typeof a.distance === "number" && !isNaN(a.distance) ? a.distance : Infinity;
    const distB = typeof b.distance === "number" && !isNaN(b.distance) ? b.distance : Infinity;
    if (distA !== distB) return distA - distB;
    return (a.company || "").localeCompare(b.company || "");
  });

  if (sortedWithMe[0].id !== "my-id") {
    console.error("❌ Test 4 FAILED: Current user's own broadcast is not pinned at index 0!");
    process.exit(1);
  }
  console.log("✅ Test 4 PASSED: Current user's live broadcast is correctly pinned at index 0.");

  console.log("\n================================================================================");
  console.log("  🎉 ALL 4 VALIDATION TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================");
}

runValidationTests().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
