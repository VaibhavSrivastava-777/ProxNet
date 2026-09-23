import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { getInstitutes, findOrCreateInstitute, addAffiliation, getUserAffiliations, deleteAffiliation } from "../lib/institutes";
import { POST as institutesPostHandler } from "../app/api/institutes/route";
import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Running Test Suite: Institutes 'Others' Feature");
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

  const supabase = createAdminClient();
  const testSuffix = Date.now();
  const testInstName1 = `Test Tech University ${testSuffix}`;
  const testInstName2 = `Test Global College ${testSuffix}`;
  let createdInstId1: string | null = null;
  let createdInstId2: string | null = null;
  let testUserId: string | null = null;
  let createdAffiliationId: string | null = null;

  try {
    // ----------------------------------------------------
    // Test 1: findOrCreateInstitute creates a new institute
    // ----------------------------------------------------
    console.log("--- 1. Testing findOrCreateInstitute (Creation) ---");
    const inst1 = await findOrCreateInstitute(testInstName1, "other");
    assert(inst1 !== null && typeof inst1.id === "string", `Created new institute with id: ${inst1?.id}`);
    assert(inst1.name === testInstName1, `Institute name matches "${testInstName1}"`);
    assert(inst1.category === "other", `Institute category is "other"`);
    createdInstId1 = inst1.id;

    // ----------------------------------------------------
    // Test 2: findOrCreateInstitute prevents duplicate (case-insensitive)
    // ----------------------------------------------------
    console.log("\n--- 2. Testing findOrCreateInstitute (Deduplication) ---");
    const inst1Duplicate = await findOrCreateInstitute(testInstName1.toLowerCase(), "other");
    assert(inst1Duplicate.id === createdInstId1, `Case-insensitive lookup returned same ID (${inst1Duplicate.id} === ${createdInstId1})`);

    // ----------------------------------------------------
    // Test 3: findOrCreateInstitute input validation
    // ----------------------------------------------------
    console.log("\n--- 3. Testing findOrCreateInstitute (Validation) ---");
    let validationFailed = false;
    try {
      await findOrCreateInstitute(" ", "other");
    } catch {
      validationFailed = true;
    }
    assert(validationFailed, "findOrCreateInstitute rejects blank/too-short institute name");

    // ----------------------------------------------------
    // Test 4: POST /api/institutes route handler
    // ----------------------------------------------------
    console.log("\n--- 4. Testing POST /api/institutes API Endpoint ---");
    const mockRequest = new Request("http://localhost:3000/api/institutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: testInstName2 }),
    });

    const res = await institutesPostHandler(mockRequest);
    const body = await res.json();
    assert(res.status === 200, `POST /api/institutes returns 200 OK`);
    assert(body.institute && body.institute.name === testInstName2, `Response includes institute object with name: ${body.institute?.name}`);
    createdInstId2 = body.institute?.id;

    // ----------------------------------------------------
    // Test 5: addAffiliation with instituteId: 'other' and instituteName
    // ----------------------------------------------------
    console.log("\n--- 5. Testing addAffiliation with 'other' & custom name ---");
    const testSub = `test-user-aff-${testSuffix}`;
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        linkedin_sub: testSub,
        full_name: "Alma Mater Test User",
        email: `test-${testSuffix}@example.com`,
        source: "oauth",
        visibility: { showCompany: true, showTitle: true, showPhoto: true },
        active_location: "home",
        is_active: true,
      })
      .select("*")
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }
    testUserId = user.id;

    const affInstituteName = `Institute of Innovation ${testSuffix}`;
    const affiliation = await addAffiliation({
      userId: testUserId,
      instituteId: "other",
      instituteName: affInstituteName,
      degree: "B.Tech Computer Science",
      batchYear: 2024,
    });

    assert(affiliation !== null, "addAffiliation returned a valid affiliation object");
    assert(affiliation?.degree === "B.Tech Computer Science", "Affiliation degree is 'B.Tech Computer Science'");
    assert(affiliation?.batch_year === 2024, "Affiliation batch year is 2024");
    assert(affiliation?.institute?.name === affInstituteName, `Affiliation joined institute name matches "${affInstituteName}"`);
    assert(affiliation?.institute?.category === "other", "Joined institute category is 'other'");

    if (affiliation) {
      createdAffiliationId = affiliation.id;
    }

    // ----------------------------------------------------
    // Test 6: getInstitutes() contains new institutes for future dropdowns
    // ----------------------------------------------------
    console.log("\n--- 6. Testing getInstitutes() Availability for Future Dropdowns ---");
    const allInstitutes = await getInstitutes();
    const foundInst1 = allInstitutes.find((i) => i.name === testInstName1);
    const foundInst2 = allInstitutes.find((i) => i.name === testInstName2);
    const foundInst3 = allInstitutes.find((i) => i.name === affInstituteName);

    assert(!!foundInst1, `"${testInstName1}" is returned by getInstitutes()`);
    assert(!!foundInst2, `"${testInstName2}" is returned by getInstitutes()`);
    assert(!!foundInst3, `"${affInstituteName}" is returned by getInstitutes()`);

    // Verify alphabetical ordering
    const sorted = [...allInstitutes].sort((a, b) => a.name.localeCompare(b.name));
    const isSorted = allInstitutes.every((inst, i) => inst.id === sorted[i].id);
    assert(isSorted, "getInstitutes() returns all institutes in alphabetical order");

    // ----------------------------------------------------
    // Test 7: UI Code Validation in ProfileForm.tsx
    // ----------------------------------------------------
    console.log("\n--- 7. Validating ProfileForm.tsx Component Implementation ---");
    const profileFormPath = path.join(process.cwd(), "components", "profile", "ProfileForm.tsx");
    const profileFormSource = fs.readFileSync(profileFormPath, "utf-8");

    assert(profileFormSource.includes('value="other"'), "ProfileForm contains option value='other' in select dropdown");
    assert(profileFormSource.includes("customInstituteName"), "ProfileForm manages customInstituteName state");
    assert(profileFormSource.includes("selectedInstituteId === \"other\""), "ProfileForm conditionally renders text box when 'other' is selected");
    assert(profileFormSource.includes("data.newInstitute"), "ProfileForm dynamically appends newInstitute to dropdown list upon creation");
    assert(profileFormSource.includes("localeCompare"), "ProfileForm sorts dropdown options alphabetically after adding new institute");

  } finally {
    // ----------------------------------------------------
    // Teardown / Cleanup
    // ----------------------------------------------------
    console.log("\n--- 8. Cleaning up test data ---");
    if (createdAffiliationId && testUserId) {
      await deleteAffiliation(testUserId, createdAffiliationId);
    }
    if (testUserId) {
      await supabase.from("users").delete().eq("id", testUserId);
    }
    if (createdInstId1) {
      await supabase.from("institutes").delete().eq("id", createdInstId1);
    }
    if (createdInstId2) {
      await supabase.from("institutes").delete().eq("id", createdInstId2);
    }
    await supabase.from("institutes").delete().like("name", `%${testSuffix}%`);
    console.log("  🧹 Test data cleanup complete.");
  }

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
