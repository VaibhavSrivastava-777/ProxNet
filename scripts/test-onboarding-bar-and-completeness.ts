import {
  checkOnboardingRequirements,
  isOnboardingIncomplete,
  calculateProfileCompleteness,
  getProfileCompletenessItems,
  getMissingProfileFields,
} from "../lib/profile-validation";

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log("=== Testing Onboarding Minimum Bar & Completeness Calculation ===\n");

// 1. Empty user
const emptyUser = {};
assert(isOnboardingIncomplete(emptyUser) === true, "Empty user fails onboarding bar");
assert(calculateProfileCompleteness(emptyUser) === 0, "Empty user completeness is 0%");

// 2. User with only name and email (old bar passed, but new bar must fail!)
const userOldBar = {
  full_name: "Vaibhav Srivastava",
  email: "vaibhav@example.com",
};
assert(
  isOnboardingIncomplete(userOldBar) === true,
  "User with only name + email fails new onboarding bar (missing designation, company, home location)"
);
const reqsOld = checkOnboardingRequirements(userOldBar);
assert(reqsOld.hasName && reqsOld.hasEmail, "Has name and email");
assert(!reqsOld.hasDesignation, "Missing designation detected");
assert(!reqsOld.hasCompany, "Missing company detected");
assert(!reqsOld.hasHomeLocation, "Missing home location detected");

// 3. User with name, email, designation, company, but no home location
const userNoLoc = {
  full_name: "Vaibhav Srivastava",
  email: "vaibhav@example.com",
  job_title: "Tech Lead",
  company: "Google",
};
assert(isOnboardingIncomplete(userNoLoc) === true, "User without home location fails onboarding bar");

// 4. User meeting the exact minimum bar (name, email, designation, company, home coordinates)
const userMinBar = {
  full_name: "Vaibhav Srivastava",
  email: "vaibhav@example.com",
  job_title: "Tech Lead",
  company: "Google",
  home_lat: 12.9279,
  home_lng: 77.6271,
};
assert(isOnboardingIncomplete(userMinBar) === false, "User meeting all 5 minimum bar fields PASSES onboarding bar");
const minBarScore = calculateProfileCompleteness(userMinBar);
assert(minBarScore === 50, `User meeting 5 core fields scores 50% completeness (got ${minBarScore}%)`);

// 5. User meeting minimum bar using home_name string
const userMinBarWithName = {
  full_name: "Vaibhav Srivastava",
  email: "vaibhav@example.com",
  job_title: "Tech Lead",
  company: "Google",
  home_name: "HSR Layout Sector 1",
};
assert(isOnboardingIncomplete(userMinBarWithName) === false, "User with home_name passes home location check");

// 6. Fully completed profile (100%)
const fullUser = {
  full_name: "Vaibhav Srivastava",
  email: "vaibhav@example.com",
  job_title: "Tech Lead",
  company: "Google",
  home_lat: 12.9279,
  home_lng: 77.6271,
  linkedin_profile_url: "https://linkedin.com/in/vaibhav",
  profile_photo_url: "https://storage.example.com/photo.jpg",
  professional_bio: "Experienced tech lead building distributed systems",
  resume_url: "https://storage.example.com/resume.pdf",
  help_offers: ["System Design Prep", "React Debugging"],
};
const fullScore = calculateProfileCompleteness(fullUser);
assert(fullScore === 100, `Fully completed profile scores 100% (got ${fullScore}%)`);
const missing = getMissingProfileFields(fullUser);
assert(missing.length === 0, `Fully completed profile has 0 missing fields (got ${missing.length})`);

console.log("\nAll onboarding minimum bar and profile completeness tests passed successfully!");
