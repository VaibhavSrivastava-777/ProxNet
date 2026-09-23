import assert from "assert";
import { isSyntheticLinkedInUrl, formatLinkedInUrl } from "../lib/linkedin/normalize-url";
import { getMissingProfileWizardSteps } from "../lib/profile-wizard";
import type { User } from "../lib/types";

async function main() {
  console.log("🧪 RUNNING LINKEDIN URL & PROFILE WIZARD INTEGRATION TESTS...\n");

  // =========================================================================
  // TEST 1: Synthetic Sub URL Detection
  // =========================================================================
  console.log("[Test 1] Testing isSyntheticLinkedInUrl detection...");

  assert.strictEqual(
    isSyntheticLinkedInUrl("https://www.linkedin.com/in/8y7d_lckr2", "8y7D_lckr2"),
    true,
    "Should detect exact match with sub claim"
  );
  assert.strictEqual(
    isSyntheticLinkedInUrl("https://www.linkedin.com/in/zckdvedtw6", "ZCkDveDTW6"),
    true,
    "Should detect case-insensitive match with sub claim"
  );
  assert.strictEqual(
    isSyntheticLinkedInUrl("https://www.linkedin.com/in/xget6ffbar", "XGET6ffbaR"),
    true,
    "Should detect sub claim url"
  );
  assert.strictEqual(
    isSyntheticLinkedInUrl("https://www.linkedin.com/in/john-doe-123", "8y7D_lckr2"),
    false,
    "Real profile vanity URL should NOT be flagged as synthetic"
  );
  assert.strictEqual(
    isSyntheticLinkedInUrl("", "8y7D_lckr2"),
    false,
    "Empty string should not be synthetic"
  );
  assert.strictEqual(
    isSyntheticLinkedInUrl(null, "8y7D_lckr2"),
    false,
    "Null URL should not be synthetic"
  );
  assert.strictEqual(
    isSyntheticLinkedInUrl("https://www.linkedin.com/in/john-doe", null),
    false,
    "Real URL without sub should not be synthetic"
  );
  console.log("  ✓ Synthetic URL detection passes all assertions");

  // =========================================================================
  // TEST 2: Wizard detects missing LinkedIn URL and synthetic LinkedIn URL
  // =========================================================================
  console.log("\n[Test 2] Testing getMissingProfileWizardSteps for LinkedIn URL...");

  // Minimal user without LinkedIn URL
  const userWithoutLinkedIn: Partial<User> = {
    id: "user-1",
    full_name: "Jane Doe",
    email: "jane@example.com",
    job_title: "Senior Engineer",
    company: "Acme Corp",
    about: "Experienced full-stack engineer passionate about cloud native architectures.",
    home_lat: 12.9716,
    home_lng: 77.5946,
    home_name: "Indiranagar",
    office_lat: 12.9352,
    office_lng: 77.6245,
    office_name: "Koramangala",
  };

  const stepsWithoutLinkedIn = getMissingProfileWizardSteps(userWithoutLinkedIn, true);
  assert(
    stepsWithoutLinkedIn.includes("linkedin_url"),
    "User with no linkedin_profile_url must have 'linkedin_url' step in wizard"
  );
  console.log("  ✓ Missing linkedin_profile_url correctly added to wizard steps");

  // User with synthetic LinkedIn URL (e.g. from OAuth sub)
  const userWithSyntheticLinkedIn: Partial<User> = {
    ...userWithoutLinkedIn,
    linkedin_sub: "8y7D_lckr2",
    linkedin_profile_url: "https://www.linkedin.com/in/8y7d_lckr2",
  };
  const stepsWithSynthetic = getMissingProfileWizardSteps(userWithSyntheticLinkedIn, true);
  assert(
    stepsWithSynthetic.includes("linkedin_url"),
    "User with synthetic sub linkedin_profile_url must be asked for real linkedin_url in wizard"
  );
  console.log("  ✓ Synthetic sub URL treated as missing; 'linkedin_url' included in wizard steps");

  // User with valid real LinkedIn URL
  const userWithRealLinkedIn: Partial<User> = {
    ...userWithoutLinkedIn,
    linkedin_sub: "8y7D_lckr2",
    linkedin_profile_url: "https://www.linkedin.com/in/jane-doe-dev",
  };
  const stepsWithReal = getMissingProfileWizardSteps(userWithRealLinkedIn, true);
  assert(
    !stepsWithReal.includes("linkedin_url"),
    "User with real linkedin_profile_url should NOT have 'linkedin_url' step"
  );
  console.log("  ✓ Real vanity LinkedIn URL recognized as complete");

  // =========================================================================
  // TEST 3: Wizard detects missing About Me / Bio
  // =========================================================================
  console.log("\n[Test 3] Testing getMissingProfileWizardSteps for About Me / Bio...");

  // User has LinkedIn URL, but no bio or about me
  const userWithoutBio: Partial<User> = {
    ...userWithRealLinkedIn,
    about: null,
    professional_bio: null,
  };
  const stepsWithoutBio = getMissingProfileWizardSteps(userWithoutBio, true);
  assert(
    stepsWithoutBio.includes("about_me"),
    "User without about or professional_bio must have 'about_me' step in wizard"
  );
  console.log("  ✓ User with missing bio has 'about_me' step included in wizard");

  // User has professional_bio provided
  const userWithBio: Partial<User> = {
    ...userWithoutBio,
    professional_bio: "Staff Engineer leading platform security and distributed systems.",
  };
  const stepsWithBio = getMissingProfileWizardSteps(userWithBio, true);
  assert(
    !stepsWithBio.includes("about_me"),
    "User with professional_bio should NOT have 'about_me' step"
  );
  console.log("  ✓ User with populated professional_bio has 'about_me' marked complete");

  // User has about field provided
  const userWithAbout: Partial<User> = {
    ...userWithoutBio,
    about: "Building developer tools and real-time community networking apps.",
  };
  const stepsWithAbout = getMissingProfileWizardSteps(userWithAbout, true);
  assert(
    !stepsWithAbout.includes("about_me"),
    "User with populated about field should NOT have 'about_me' step"
  );
  console.log("  ✓ User with populated about field has 'about_me' marked complete");

  // =========================================================================
  // TEST 4: Progressive dynamic flow simulation
  // =========================================================================
  console.log("\n[Test 4] Testing progressive dynamic completion flow...");

  // Scenario A: Brand new user with only name & email
  const brandNewUser: Partial<User> = {
    id: "new-user-1",
    full_name: "Rahul Sharma",
    email: "rahul@example.com",
    home_lat: null,
    home_lng: null,
    office_lat: null,
    office_lng: null,
  };

  const initialSteps = getMissingProfileWizardSteps(brandNewUser, false);
  console.log("  Initial missing steps for new user:", initialSteps);
  assert(initialSteps.includes("linkedin_url"), "Should include linkedin_url");
  assert(initialSteps.includes("designation"), "Should include designation");
  assert(initialSteps.includes("company"), "Should include company");
  assert(initialSteps.includes("about_me"), "Should include about_me");
  assert(initialSteps.includes("home_location"), "Should include home_location");
  assert(initialSteps.includes("office_location"), "Should include office_location");
  assert(initialSteps.includes("notifications"), "Should include notifications");

  // Scenario B: LinkedIn parsed role, company, but NOT bio (auth wall)
  const afterPartialLinkedInParse: Partial<User> = {
    ...brandNewUser,
    linkedin_profile_url: "https://www.linkedin.com/in/rahulsharma-tech",
    job_title: "Product Manager",
    company: "Swiggy",
    // professional_bio is still null because LinkedIn restricted public bio
    professional_bio: null,
    about: null,
  };
  const stepsAfterPartialParse = getMissingProfileWizardSteps(afterPartialLinkedInParse, false);
  console.log("  Steps after LinkedIn parsed role & company (but no bio):", stepsAfterPartialParse);
  assert(!stepsAfterPartialParse.includes("linkedin_url"), "linkedin_url should be complete");
  assert(!stepsAfterPartialParse.includes("designation"), "designation should be auto-completed by LinkedIn parse");
  assert(!stepsAfterPartialParse.includes("company"), "company should be auto-completed by LinkedIn parse");
  assert(stepsAfterPartialParse.includes("about_me"), "about_me MUST be included when LinkedIn does not parse bio");

  // Scenario C: User fills about_me
  const afterAboutMeFilled: Partial<User> = {
    ...afterPartialLinkedInParse,
    professional_bio: "Experienced PM scaling hyperlocal logistics and consumer delivery products.",
  };
  const stepsAfterAboutMe = getMissingProfileWizardSteps(afterAboutMeFilled, false);
  console.log("  Steps after filling about_me:", stepsAfterAboutMe);
  assert(!stepsAfterAboutMe.includes("about_me"), "about_me should be complete");
  assert(stepsAfterAboutMe.includes("home_location"), "home_location is next");
  assert(stepsAfterAboutMe.includes("office_location"), "office_location is next");

  console.log("\n🎉 ALL LINKEDIN & PROFILE WIZARD INTEGRATION TESTS PASSED! 🚀\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
