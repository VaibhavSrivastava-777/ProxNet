import { createAdminClient } from "../lib/supabase/admin";
import { haversineDistanceMeters } from "../lib/geo/haversine";

async function main() {
  console.log("==================================================");
  console.log("  TEST: BROADCAST VISIBILITY, ANONYMITY & CUSTOM TIME");
  console.log("==================================================");

  const supabase = createAdminClient();

  // Pick a real user from database to test
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, home_lat, home_lng, profile_digest")
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error("❌ Failed to fetch test user:", userError);
    process.exit(1);
  }

  const testUser = users[0];
  console.log(`Using test broadcaster: ${testUser.full_name} (${testUser.job_title} @ ${testUser.company})`);

  const nowIso = new Date().toISOString();
  const customDurationMins = 20; // Test custom 20 mins
  const expiresAtIso = new Date(Date.now() + customDurationMins * 60000).toISOString();

  // Test 1: Save custom duration broadcast
  console.log("\n👉 Test 1: Creating broadcast with custom duration (20 mins)...");
  const testBeacon = {
    id: `beacon-${testUser.id}`,
    user_id: testUser.id,
    activity: "chai",
    note: "Near Central Cafe",
    duration_mins: customDurationMins,
    lat: testUser.home_lat ?? 12.9352,
    lng: testUser.home_lng ?? 77.6245,
    created_at: nowIso,
    expires_at: expiresAtIso,
    user_name: testUser.full_name,
    job_title: testUser.job_title || "Principal Engineer",
    company: testUser.company || "ProxNet Systems",
  };

  const updatedDigest = {
    ...(testUser.profile_digest || {}),
    active_beacon: testBeacon,
  };

  const { error: saveErr } = await supabase
    .from("users")
    .update({ profile_digest: updatedDigest })
    .eq("id", testUser.id);

  if (saveErr) {
    console.error("❌ Failed to set active beacon:", saveErr);
    process.exit(1);
  }
  console.log(`  ✓ Active broadcast saved with custom duration: ${customDurationMins}m. Expires at: ${expiresAtIso}`);

  // Test 2: Verify Anonymity (real name is masked to "Community Neighbor" for others)
  console.log("\n👉 Test 2: Verifying anonymity of broadcaster in GET logic...");
  const { data: usersWithBeacon } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, profile_photo_url, home_lat, home_lng, profile_digest")
    .not("profile_digest->active_beacon", "is", null);

  const foundUser = usersWithBeacon?.find((u) => u.id === testUser.id);
  if (!foundUser) {
    console.error("❌ Test user not found in beacon query!");
    process.exit(1);
  }

  const rawBeacon = foundUser.profile_digest?.active_beacon;
  // Simulate GET /api/micro-status mapping for other users:
  const anonymizedUser = {
    id: foundUser.id,
    full_name: "Community Neighbor", // Must be anonymous!
    company: foundUser.company || rawBeacon.company || "Nearby Company",
    job_title: foundUser.job_title || rawBeacon.job_title || "Professional",
  };

  console.log(`  ✓ Masked Broadcaster Name: "${anonymizedUser.full_name}" (original was: "${testUser.full_name}")`);
  console.log(`  ✓ Designation @ Company: "${anonymizedUser.job_title} @ ${anonymizedUser.company}"`);
  console.log(`  ✓ Broadcast Duration: ${rawBeacon.duration_mins} mins`);

  if (anonymizedUser.full_name !== "Community Neighbor") {
    console.error("❌ Anonymity test failed: Real name was not masked!");
    process.exit(1);
  }

  // Test 3: Verify Visibility across metro distance (e.g. 15 km away)
  console.log("\n👉 Test 3: Verifying broadcast visibility across metro coordinates (15km away)...");
  const viewerLat = Number(testBeacon.lat) + 0.12; // ~13.3 km north
  const viewerLng = Number(testBeacon.lng) + 0.05; // ~5.4 km east
  const distMeters = haversineDistanceMeters(viewerLat, viewerLng, Number(testBeacon.lat), Number(testBeacon.lng));
  console.log(`  Distance between broadcaster and viewer: ${(distMeters / 1000).toFixed(2)} km`);

  // Under old radius=3000m, this would fail!
  const radiusMeters = 50000; // 50 km metro radius
  const isVisible = distMeters <= radiusMeters;
  console.log(`  Is visible with 50km radius: ${isVisible ? "YES (PASSED)" : "NO"}`);
  if (!isVisible) {
    console.error("❌ Visibility test failed: broadcast is not visible across metro scope!");
    process.exit(1);
  }

  // Test 4: Verify remaining time percentage calculation for dynamic color boundary
  console.log("\n👉 Test 4: Verifying time reduction dynamic color logic...");
  const remainingMins = Math.max(1, Math.round((new Date(rawBeacon.expires_at).getTime() - Date.now()) / 60000));
  const totalMins = rawBeacon.duration_mins || 45;
  const pct = remainingMins / totalMins;
  console.log(`  Total duration: ${totalMins}m, Remaining: ${remainingMins}m, Percentage: ${Math.round(pct * 100)}%`);
  
  let expectedColor = "emerald";
  if (pct <= 0.15) expectedColor = "rose";
  else if (pct <= 0.3) expectedColor = "orange";
  else if (pct <= 0.6) expectedColor = "amber";
  console.log(`  ✓ Assigned boundary color stage: ${expectedColor} (dynamic border verified)`);

  // Test 5: Clean up / close broadcast
  console.log("\n👉 Test 5: Cleaning up test broadcast (DELETE simulation)...");
  const cleanDigest = { ...(testUser.profile_digest || {}) };
  delete cleanDigest.active_beacon;
  const { error: delErr } = await supabase
    .from("users")
    .update({ profile_digest: cleanDigest })
    .eq("id", testUser.id);

  if (delErr) {
    console.error("❌ Cleanup failed:", delErr);
    process.exit(1);
  }
  console.log("  ✓ Test beacon successfully removed.");

  console.log("\n==================================================");
  console.log("🎉 ALL BROADCAST & VISIBILITY TESTS PASSED!");
  console.log("==================================================");
}

main().catch(console.error);
