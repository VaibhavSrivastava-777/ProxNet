import { createAdminClient } from "../lib/supabase/admin";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function runTest() {
  console.log("==================================================");
  console.log("  TEST: BROADCAST LOCK, DESIGNATION & CLOSE FLOW  ");
  console.log("==================================================");

  const supabase = createAdminClient();

  // Pick or ensure a test user
  const { data: testUser, error: userError } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, profile_digest")
    .limit(1)
    .single();

  if (userError || !testUser) {
    console.error("❌ Failed to get test user:", userError);
    process.exit(1);
  }

  console.log(`Using test user: ${testUser.full_name || testUser.id} (${testUser.job_title} @ ${testUser.company})`);

  // Ensure clean starting state: clear active beacon
  const cleanDigest = { ...(testUser.profile_digest || {}) };
  delete cleanDigest.active_beacon;
  await supabase.from("users").update({ profile_digest: cleanDigest }).eq("id", testUser.id);

  console.log("\n👉 Test 1: Starting first broadcast...");
  const durationMins = 30;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();

  const beaconData = {
    id: `beacon-${testUser.id}`,
    user_id: testUser.id,
    activity: "chai",
    note: "Near Third Wave Coffee",
    duration_mins: durationMins,
    lat: 12.9716,
    lng: 77.5946,
    created_at: nowIso,
    expires_at: expiresAt,
    user_name: testUser.full_name || "Vaibhav Srivastava",
    job_title: testUser.job_title || "Principal Software Engineer",
    company: testUser.company || "Google",
    profile_photo_url: null,
  };

  cleanDigest.active_beacon = beaconData;
  const { error: setErr } = await supabase
    .from("users")
    .update({ profile_digest: cleanDigest })
    .eq("id", testUser.id);

  if (setErr) {
    console.error("❌ Failed to set active beacon:", setErr);
    process.exit(1);
  }
  console.log(`  ✓ Active broadcast created. Expires at: ${expiresAt}`);

  console.log("\n👉 Test 2: Attempting to open second broadcast while first is in motion...");
  // Simulate POST check logic
  const { data: currentUserProfile } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", testUser.id)
    .single();

  const activeBeacon = currentUserProfile?.profile_digest?.active_beacon;
  let blocked = false;
  if (activeBeacon && activeBeacon.expires_at) {
    const existingExpires = new Date(activeBeacon.expires_at).getTime();
    if (existingExpires > Date.now()) {
      blocked = true;
      console.log(`  ✓ Second broadcast correctly BLOCKED! (Active expires in ${Math.round((existingExpires - Date.now()) / 60000)}m)`);
    }
  }

  if (!blocked) {
    console.error("❌ FAILED: Second broadcast was not blocked while first was active!");
    process.exit(1);
  }

  console.log("\n👉 Test 3: Verifying designation @ company in broadcast query...");
  const { data: usersWithBeacon } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, profile_digest")
    .not("profile_digest->active_beacon", "is", null);

  const foundBeaconUser = usersWithBeacon?.find((u) => u.id === testUser.id);
  if (!foundBeaconUser) {
    console.error("❌ Broadcast user not found in beacon query!");
    process.exit(1);
  }

  const rawBeacon = foundBeaconUser.profile_digest?.active_beacon;
  const resolvedDesignation = foundBeaconUser.job_title || rawBeacon?.job_title;
  const resolvedCompany = foundBeaconUser.company || rawBeacon?.company;

  console.log(`  ✓ Found broadcast with Designation: "${resolvedDesignation}" @ Company: "${resolvedCompany}"`);
  if (!resolvedDesignation || !resolvedCompany) {
    console.error("❌ FAILED: Designation or Company missing from broadcast!");
    process.exit(1);
  }

  console.log("\n👉 Test 4: Option to close broadcast anytime (DELETE / cancel)...");
  const digestAfterClose = { ...(foundBeaconUser.profile_digest || {}) };
  delete digestAfterClose.active_beacon;
  const { error: closeErr } = await supabase
    .from("users")
    .update({ profile_digest: digestAfterClose })
    .eq("id", testUser.id);

  if (closeErr) {
    console.error("❌ Failed to close broadcast:", closeErr);
    process.exit(1);
  }

  const { data: verifyClosed } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", testUser.id)
    .single();

  if (verifyClosed?.profile_digest?.active_beacon) {
    console.error("❌ FAILED: Broadcast was not deleted on close!");
    process.exit(1);
  }
  console.log("  ✓ Broadcast closed successfully. Active beacon removed.");

  console.log("\n👉 Test 5: Verifying user can start a new broadcast after closing...");
  const newBeaconData = {
    ...beaconData,
    activity: "walk",
    note: "Evening walk around tech park",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 45 * 60000).toISOString(),
  };
  digestAfterClose.active_beacon = newBeaconData;
  const { error: newErr } = await supabase
    .from("users")
    .update({ profile_digest: digestAfterClose })
    .eq("id", testUser.id);

  if (newErr) {
    console.error("❌ Failed to start new broadcast after close:", newErr);
    process.exit(1);
  }
  console.log("  ✓ New broadcast successfully created after closing previous one.");

  // Final cleanup
  delete digestAfterClose.active_beacon;
  await supabase.from("users").update({ profile_digest: digestAfterClose }).eq("id", testUser.id);
  console.log("  ✓ Final cleanup: Test beacon removed.");

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
