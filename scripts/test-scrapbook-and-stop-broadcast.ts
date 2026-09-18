import { createAdminClient } from "../lib/supabase/admin";
import { hydrateUserScrapbook } from "../lib/users";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function runTest() {
  console.log("==================================================");
  console.log("  TEST: SCRAPBOOK PERSISTENCE & STOP BROADCAST    ");
  console.log("==================================================");

  const supabase = createAdminClient();

  // 1. Fetch test user
  const { data: testUser, error: userError } = await supabase
    .from("users")
    .select("id, full_name, profile_digest, home_lat, home_lng")
    .limit(1)
    .single();

  if (userError || !testUser) {
    console.error("❌ Failed to get test user:", userError);
    process.exit(1);
  }

  console.log(`Using test user: ${testUser.full_name || testUser.id}`);

  // Test 1: Save scrapbook details in profile_digest
  console.log("\n👉 Test 1: Testing Scrapbook saving & retrieval...");
  const scrapbookData = {
    help_offers: ["System Design Prep", "Backend Mentorship"],
    tinkering_with: ["Local LLMs on Mac", "Raspberry Pi Clusters"],
    ask_me_about: ["Angel Investing", "Relocating to Bangalore"],
    quick_chat_preference: "walk",
    society_name: "Prestige Lakeside Habitat",
  };

  const currentDigest = testUser.profile_digest || {};
  const updatedDigest = {
    ...currentDigest,
    ...scrapbookData,
  };

  // Perform update as done by PATCH /api/profile
  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update({ profile_digest: updatedDigest, updated_at: new Date().toISOString() })
    .eq("id", testUser.id)
    .select("id, full_name, profile_digest")
    .single();

  if (updateError) {
    console.error("❌ Failed to update user with scrapbook data:", updateError);
    process.exit(1);
  }

  // Hydrate user
  const hydrated = hydrateUserScrapbook(updatedUser);
  if (!hydrated) {
    console.error("❌ Failed to hydrate user scrapbook!");
    process.exit(1);
  }

  console.log("  ✓ Scrapbook saved without schema cache error!");
  console.log("    - help_offers:", hydrated.help_offers);
  console.log("    - tinkering_with:", hydrated.tinkering_with);
  console.log("    - ask_me_about:", hydrated.ask_me_about);
  console.log("    - quick_chat_preference:", hydrated.quick_chat_preference);
  console.log("    - society_name:", hydrated.society_name);

  if (
    hydrated.ask_me_about?.length !== 2 ||
    hydrated.help_offers?.length !== 2 ||
    hydrated.tinkering_with?.length !== 2 ||
    hydrated.quick_chat_preference !== "walk" ||
    hydrated.society_name !== "Prestige Lakeside Habitat"
  ) {
    console.error("❌ Scrapbook hydration assertion failed!");
    process.exit(1);
  }
  console.log("  ✅ Test 1 Passed: Scrapbook persistence verified.");

  // Test 2: Stop Broadcast & My Beacon flow
  console.log("\n👉 Test 2: Testing Stop Broadcast & My Beacon flow...");
  const durationMins = 45;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();

  const beaconData = {
    id: `beacon-${testUser.id}`,
    user_id: testUser.id,
    activity: "chai",
    note: "Coffee at Clubhouse",
    duration_mins: durationMins,
    lat: 12.9716,
    lng: 77.5946,
    created_at: nowIso,
    expires_at: expiresAt,
    user_name: testUser.full_name || "Neighbor",
    job_title: "Tech Lead",
    company: "ProxNet",
  };

  updatedDigest.active_beacon = beaconData;
  await supabase.from("users").update({ profile_digest: updatedDigest }).eq("id", testUser.id);
  console.log("  ✓ Broadcast created. Beacon expires in 45m.");

  // Verify my_beacon resolution logic
  const { data: checkUser } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", testUser.id)
    .single();

  const activeBeacon = checkUser?.profile_digest?.active_beacon;
  if (!activeBeacon || new Date(activeBeacon.expires_at).getTime() <= Date.now()) {
    console.error("❌ Active beacon not found for test user!");
    process.exit(1);
  }
  console.log("  ✓ my_beacon found and verified active.");

  // Simulate Stop Broadcast (DELETE /api/micro-status)
  console.log("  🛑 Stopping broadcast (DELETE)...");
  const cleanDigest = { ...checkUser.profile_digest };
  delete cleanDigest.active_beacon;
  await supabase.from("users").update({ profile_digest: cleanDigest }).eq("id", testUser.id);

  // Verify beacon removed
  const { data: verifiedStopped } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", testUser.id)
    .single();

  if (verifiedStopped?.profile_digest?.active_beacon) {
    console.error("❌ Failed to remove active beacon!");
    process.exit(1);
  }
  console.log("  ✓ Broadcast successfully stopped. Active beacon removed.");
  console.log("  ✅ Test 2 Passed: Stop broadcast flow verified.");

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
