import { isProfileIncomplete } from "../lib/profile-validation";

const completeUser = {
  full_name: "John Doe",
  email: "john@example.com",
  company: "Acme Corp",
  job_title: "Software Engineer",
  resume_url: "https://example.com/resume.pdf",
  profile_photo_url: "https://example.com/photo.jpg",
  linkedin_profile_url: "https://linkedin.com/in/johndoe",
  home_lat: 12.9716,
  home_lng: 77.5946,
  office_lat: 12.9716,
  office_lng: 77.5946,
};

function runTest(testName: string, user: any, expected: boolean) {
  const result = isProfileIncomplete(user);
  if (result === expected) {
    console.log(`✅ Pass: ${testName}`);
  } else {
    console.error(`❌ Fail: ${testName} (expected ${expected}, got ${result})`);
    process.exit(1);
  }
}

console.log("Running Profile Validation logic tests...");

runTest("Complete user profile", completeUser, false);

runTest("Missing full_name", { ...completeUser, full_name: "" }, true);
runTest("Null full_name", { ...completeUser, full_name: null }, true);

runTest("Missing email", { ...completeUser, email: "" }, true);
runTest("Null email", { ...completeUser, email: null }, true);

runTest("Missing company", { ...completeUser, company: "" }, true);
runTest("Null company", { ...completeUser, company: null }, true);

runTest("Missing job_title", { ...completeUser, job_title: "" }, true);
runTest("Null job_title", { ...completeUser, job_title: null }, true);

runTest("Missing resume_url", { ...completeUser, resume_url: "" }, false);
runTest("Null resume_url", { ...completeUser, resume_url: null }, false);

runTest("Missing profile_photo_url", { ...completeUser, profile_photo_url: "" }, false);
runTest("Null profile_photo_url", { ...completeUser, profile_photo_url: null }, false);

runTest("Missing linkedin_profile_url", { ...completeUser, linkedin_profile_url: "" }, false);
runTest("Null linkedin_profile_url", { ...completeUser, linkedin_profile_url: null }, false);

runTest("Missing home_lat", { ...completeUser, home_lat: null }, false);
runTest("Missing home_lng", { ...completeUser, home_lng: null }, false);

runTest("Missing office_lat", { ...completeUser, office_lat: null }, false);
runTest("Missing office_lng", { ...completeUser, office_lng: null }, false);

console.log("All Profile Validation logic tests passed successfully! 🚀");
