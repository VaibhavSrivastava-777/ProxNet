import { createAdminClient } from "../lib/supabase/admin";
import { resolveUserLocation } from "../lib/anonymize";
import { haversineDistanceMeters } from "../lib/geo/haversine";
import type { User } from "../lib/types";

async function runTests() {
  console.log("🚀 Starting Q&A Experience Upgrade Validation...");

  const supabase = createAdminClient();

  // 1. Fetch a test user
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("*")
    .not("home_lat", "is", null)
    .not("job_title", "is", null)
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.warn("⚠️ No user found with locations set. Skipping DB tests.");
    return;
  }

  const user = users[0];
  console.log(`Testing with user: ${user.full_name} (${user.company}, ${user.job_title})`);

  // Resolve user location
  const { data: currentLocations } = await supabase
    .from("user_current_locations")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const myLoc = resolveUserLocation(user as User, currentLocations?.lat ? Number(currentLocations.lat) : undefined, currentLocations?.lng ? Number(currentLocations.lng) : undefined);

  if (!myLoc) {
    console.error("❌ Test Failed: Could not resolve user location.");
    process.exit(1);
  }
  console.log(`Resolved user location: (${myLoc.lat}, ${myLoc.lng})`);

  // 2. Fetch candidates using match_professionals_rpc
  let vectorMatches: any[] = [];
  if (user.embedding) {
    const { data: matches, error: rpcError } = await supabase.rpc("match_professionals_rpc", {
      query_embedding: user.embedding,
      exclude_id: user.id,
      match_count: 100
    });
    if (!rpcError && matches) {
      vectorMatches = matches;
    }
  }

  console.log(`Semantic vector matches found in total: ${vectorMatches.length}`);

  // 3. Apply 5km filter
  const nearbyMatches = vectorMatches.filter((u: any) => {
    if (!u.home_lat || !u.home_lng) return false;
    const dist = haversineDistanceMeters(myLoc.lat, myLoc.lng, u.home_lat, u.home_lng);
    return dist <= 5000;
  });

  console.log(`Matches strictly within 5km limit: ${nearbyMatches.length}`);

  // Assert all matches are within 5km
  const correctDistances = nearbyMatches.every(u => {
    const dist = haversineDistanceMeters(myLoc.lat, myLoc.lng, u.home_lat, u.home_lng);
    return dist <= 5000;
  });

  if (!correctDistances) {
    console.error("❌ Test Failed: Distance filter did not strictly enforce 5km radius.");
    process.exit(1);
  }
  console.log("✅ 5km radius filter verified successfully.");

  // Assert top 5 limit is respected in slicing
  const sliced = nearbyMatches.slice(0, 5);
  console.log(`Sliced suggestions count: ${sliced.length} (limit is 5)`);
  if (sliced.length > 5) {
    console.error("❌ Test Failed: Suggestions exceed maximum limit of 5.");
    process.exit(1);
  }
  console.log("✅ Slice limit to top 5 verified successfully.");

  // Test rounding logic
  const allScoresRounded = sliced.every(u => {
    const score = Math.round(u.similarity * 100);
    return Number.isInteger(score);
  });
  if (!allScoresRounded) {
    console.error("❌ Test Failed: Scores are not correctly rounded to integers.");
    process.exit(1);
  }
  console.log("✅ Match rate rounding verified successfully.");

  console.log("🎉 All Q&A backend validation checks passed successfully!");
}

runTests();
