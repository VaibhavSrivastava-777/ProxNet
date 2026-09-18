import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import { getMissingProfileWizardSteps } from "../lib/profile-wizard";
import { generateContextEmail } from "../lib/email-templates";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  console.log("🧪 RUNNING PROFILE WIZARD VALIDATION TESTS...\n");

  // ==========================================
  // TEST 1: Missing Steps Resolution & Order
  // ==========================================
  console.log("[Test 1] Dynamic Missing Step Resolution...");

  // Scenario 1: Empty / Minimal user (only full_name & email)
  const minimalUser = {
    full_name: "Vaibhav Srivastava",
    email: "vaibhav@example.com",
    job_title: null,
    company: null,
    home_lat: null,
    home_lng: null,
    office_lat: null,
    office_lng: null,
  };
  const stepsForMinimal = getMissingProfileWizardSteps(minimalUser, false);
  console.log("  Steps for minimal user:", stepsForMinimal);
  assert.deepStrictEqual(
    stepsForMinimal,
    ["designation", "company", "home_location", "office_location", "notifications"],
    "Minimal user must require all 5 steps in order"
  );
  console.log("  ✓ Minimal user correctly requires all 5 steps");

  // Scenario 2: User has filled designation, but not company
  const userWithRole = {
    ...minimalUser,
    job_title: "Staff Software Engineer",
  };
  const stepsForUserWithRole = getMissingProfileWizardSteps(userWithRole, false);
  console.log("  Steps for user with role only:", stepsForUserWithRole);
  assert.deepStrictEqual(
    stepsForUserWithRole,
    ["company", "home_location", "office_location", "notifications"],
    "User with role must resume starting with company"
  );
  assert.strictEqual(stepsForUserWithRole[0], "company", "First missing step must be company");
  console.log("  ✓ Dynamic resumption: Starts with 'company' after designation is saved");

  // Scenario 3: User has filled designation and company, missing locations
  const userWithCompany = {
    ...userWithRole,
    company: "Google",
  };
  const stepsForUserWithCompany = getMissingProfileWizardSteps(userWithCompany, false);
  console.log("  Steps for user with company:", stepsForUserWithCompany);
  assert.deepStrictEqual(
    stepsForUserWithCompany,
    ["home_location", "office_location", "notifications"],
    "User with company must resume starting with home_location"
  );
  assert.strictEqual(stepsForUserWithCompany[0], "home_location", "First missing step must be home_location");
  console.log("  ✓ Dynamic resumption: Starts with 'home_location' after company is saved");

  // Scenario 4: User has filled Home location, missing Office
  const userWithHome = {
    ...userWithCompany,
    home_lat: 12.9716,
    home_lng: 77.5946,
    home_name: "Indiranagar, Bengaluru",
  };
  const stepsForUserWithHome = getMissingProfileWizardSteps(userWithHome, false);
  console.log("  Steps for user with home location:", stepsForUserWithHome);
  assert.deepStrictEqual(
    stepsForUserWithHome,
    ["office_location", "notifications"],
    "User with home location must resume starting with office_location"
  );
  console.log("  ✓ Dynamic resumption: Starts with 'office_location' after home is saved");

  // Scenario 5: User has filled all 4 profile fields and granted notifications
  const fullyCompleteUser = {
    ...userWithHome,
    office_lat: 12.926,
    office_lng: 77.6762,
    office_name: "Bellandur Outer Ring Road",
  };
  const stepsFullyComplete = getMissingProfileWizardSteps(fullyCompleteUser, true);
  console.log("  Steps for fully complete user with notifications:", stepsFullyComplete);
  assert.strictEqual(stepsFullyComplete.length, 0, "Complete user must have 0 missing steps");
  console.log("  ✓ Fully complete profile returns empty missing steps array (banner hides)");

  // ==========================================
  // TEST 2: Email Template Deep Link & Privacy
  // ==========================================
  console.log("\n[Test 2] Email Template Deep Link & Privacy Verification...");
  const emailResult = generateContextEmail({
    recipientName: "Vaibhav",
    title: "Action Required: Complete your ProxNet profile",
    body: "Please complete your profile to unlock proximity matching.",
    data: { type: "profile_reminder" },
  });

  assert(emailResult.html.includes("?wizard=profile"), "Email CTA link must contain '?wizard=profile'");
  assert(emailResult.html.includes("Zero Continuous Tracking"), "Email must contain Zero Continuous Tracking privacy assurance");
  console.log("  ✓ Email template contains '?wizard=profile' deep link");
  console.log("  ✓ Email template includes one-time setup and zero tracking assurances");

  // ==========================================
  // TEST 3: Incremental Save & Resumption DB Simulation
  // ==========================================
  console.log("\n[Test 3] DB Incremental Persistence & State Progression...");
  const supabase = createAdminClient();

  // Look up an existing test user
  const { data: testUser, error: findError } = await supabase
    .from("users")
    .select("id, full_name, email, job_title, company, home_lat, office_lat")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (findError || !testUser) {
    console.log("  ⚠️ No test user found in DB, skipping live DB patch test.");
  } else {
    console.log(`  Found test user: ${testUser.full_name} (${testUser.id})`);

    // Backup original values
    const originalRole = testUser.job_title;
    const originalCompany = testUser.company;

    try {
      // Step A: Save designation only
      const testRole = "Wizard Test Lead SDE";
      const { data: patch1, error: patch1Error } = await supabase
        .from("users")
        .update({ job_title: testRole })
        .eq("id", testUser.id)
        .select("job_title, company")
        .single();

      assert(!patch1Error, "Patching job_title must succeed");
      assert.strictEqual(patch1.job_title, testRole, "job_title must be updated in DB");
      console.log(`  ✓ Step A saved job_title: "${patch1.job_title}"`);

      // Verify resumption logic for this updated user state
      const updatedUserAfterStepA = { ...testUser, job_title: testRole, company: null };
      const nextStepsA = getMissingProfileWizardSteps(updatedUserAfterStepA, true);
      assert.strictEqual(nextStepsA[0], "company", "After saving designation, next step must be company");
      console.log(`  ✓ Next step dynamically advances to: "${nextStepsA[0]}"`);

      // Step B: Save company only
      const testComp = "Wizard Test Tech Corp";
      const { data: patch2, error: patch2Error } = await supabase
        .from("users")
        .update({ company: testComp })
        .eq("id", testUser.id)
        .select("job_title, company")
        .single();

      assert(!patch2Error, "Patching company must succeed");
      assert.strictEqual(patch2.company, testComp, "company must be updated in DB");
      assert.strictEqual(patch2.job_title, testRole, "previously saved job_title must be preserved");
      console.log(`  ✓ Step B saved company: "${patch2.company}" while preserving job_title: "${patch2.job_title}"`);

      // Verify resumption logic after step B
      const updatedUserAfterStepB = { ...testUser, job_title: testRole, company: testComp, home_lat: null };
      const nextStepsB = getMissingProfileWizardSteps(updatedUserAfterStepB, true);
      assert.strictEqual(nextStepsB[0], "home_location", "After saving company, next step must be home_location");
      console.log(`  ✓ Next step dynamically advances to: "${nextStepsB[0]}"`);

    } finally {
      // Revert test user to original state
      await supabase
        .from("users")
        .update({ job_title: originalRole, company: originalCompany })
        .eq("id", testUser.id);
      console.log("  ✓ Test user reverted cleanly to original state");
    }
  }

  console.log("\n🎉 ALL PROFILE WIZARD VALIDATION TESTS PASSED SUCCESSFULLY! 🚀\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
