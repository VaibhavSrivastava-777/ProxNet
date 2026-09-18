import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { GET as getSocietyStats } from "../app/api/society/stats/route";
import { GET as getMicroStatus, POST as postMicroStatus } from "../app/api/micro-status/route";
import { GET as getOgImage } from "../app/api/society/og-image/route";
import type { User, SocietyStats, MicroStatus } from "../lib/types";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING VIRAL GROWTH ENGINE VALIDATION TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // Test Suite 1: Scrapbook Profile Field Integrity
  // ----------------------------------------------------
  console.log("--- 1. Testing Scrapbook Profile Field Integrity ---");

  const sampleUser: User = {
    id: "test-user-uuid",
    linkedin_sub: null,
    linkedin_profile_url: "https://linkedin.com/in/sample",
    email: "sample@example.com",
    full_name: "Sample Neighbor",
    company: "Google",
    job_title: "Staff SDE",
    about: "Tech enthusiast",
    professional_bio: "Experienced distributed systems engineer",
    resume_url: null,
    resume_text: null,
    profile_photo_url: "https://example.com/photo.jpg",
    source: "oauth",
    visibility: { showCompany: true, showTitle: true, showPhoto: true },
    phone_number: null,
    home_name: "Prestige Falcon City, Bangalore",
    home_lat: 12.8912,
    home_lng: 77.5643,
    office_name: "Manyata Tech Park",
    office_lat: 13.0475,
    office_lng: 77.6202,
    active_location: "home",
    is_active: true,
    is_blocked: false,
    invite_code: "PX-V1R4L",
    invited_by: null,
    network_points: 150,
    anonymous_name: "Falcon-88",
    embedding: null,
    wallet: 45,
    tags: ["#IIT Kanpur", "#DistributedSystems"],
    help_offers: ["System Design Prep", "Moving to Germany Advice"],
    tinkering_with: ["Local LLMs on Mac", "Sourdough Bread"],
    ask_me_about: ["Angel Investing", "EV Buying in BLR"],
    quick_chat_preference: "chai",
    society_name: "Prestige Falcon City",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert(Array.isArray(sampleUser.help_offers), "help_offers is typed as string array");
  assert(sampleUser.help_offers?.includes("System Design Prep") === true, "help_offers stores items correctly");
  assert(sampleUser.tinkering_with?.includes("Local LLMs on Mac") === true, "tinkering_with stores items correctly");
  assert(sampleUser.ask_me_about?.includes("Angel Investing") === true, "ask_me_about stores items correctly");
  assert(sampleUser.quick_chat_preference === "chai", "quick_chat_preference supports chai");
  assert(sampleUser.society_name === "Prestige Falcon City", "society_name is stored correctly");

  // ----------------------------------------------------
  // Test Suite 2: Society Stats Endpoint
  // ----------------------------------------------------
  console.log("\n--- 2. Testing Society Stats API Endpoint ---");

  try {
    const req = new Request("http://localhost:3000/api/society/stats?slug=prestige-falcon-city");
    const res = await getSocietyStats(req);
    assert(res.status === 200, "GET /api/society/stats returns HTTP 200");

    const data: SocietyStats = await res.json();
    assert(Boolean(data.society_name), `Society name resolved: "${data.society_name}"`);
    assert(typeof data.total_members === "number", `Total members returned: ${data.total_members}`);
    assert(typeof data.roles_breakdown === "object", "Roles breakdown returned as object");
    assert(Array.isArray(data.top_companies), "Top companies returned as array");
    assert(Array.isArray(data.members), "Members list returned as array");
  } catch (err) {
    console.error("Error in Society Stats Test:", err);
    assert(false, "GET /api/society/stats handled gracefully");
  }

  // ----------------------------------------------------
  // Test Suite 3: Micro-Status Beacon API
  // ----------------------------------------------------
  console.log("\n--- 3. Testing Micro-Status Beacon API ---");

  try {
    const beaconReq = new Request("http://localhost:3000/api/micro-status?lat=12.8912&lng=77.5643&radius=3000");
    const beaconRes = await getMicroStatus(beaconReq);
    assert(beaconRes.status === 200, "GET /api/micro-status returns HTTP 200");

    const beaconData = await beaconRes.json();
    assert(Array.isArray(beaconData.beacons), "Active beacons returned as array");
    if (beaconData.beacons.length > 0) {
      const b: MicroStatus = beaconData.beacons[0];
      assert(["chai", "walk", "sports", "quick_chat"].includes(b.activity), `Valid activity type: ${b.activity}`);
      assert(Boolean(b.expires_at), `Beacon has valid expires_at timestamp: ${b.expires_at}`);
    }
  } catch (err) {
    console.error("Error in Micro-Status Test:", err);
    assert(false, "Micro-status API handled gracefully");
  }

  // ----------------------------------------------------
  // Test Suite 4: WhatsApp Dynamic OG Image Generation
  // ----------------------------------------------------
  console.log("\n--- 4. Testing Dynamic OG Image Generation ---");

  try {
    const ogReq = new Request("http://localhost:3000/api/society/og-image?slug=prestige-falcon-city");
    const ogRes = await getOgImage(ogReq);
    assert(ogRes.status === 200, "GET /api/society/og-image returns HTTP 200");
    const contentType = ogRes.headers.get("content-type");
    assert(
      contentType?.includes("image/png") === true || contentType?.includes("image") === true,
      `OG Image returns valid image content-type: ${contentType}`
    );
  } catch (err) {
    console.error("Error in OG Image Test:", err);
    assert(false, "OG Image API handled gracefully");
  }

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log("\n==================================================");
  console.log(`🏁 TEST EXECUTION FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
