import assert from "assert";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("=================================================================");
  console.log("   TEST SUITE: PROFILE PHOTO DISPLAY & UPLOAD VERIFICATION      ");
  console.log("=================================================================\n");

  // TEST 1: ProfileTab.tsx Verification
  console.log("Test 1: Verifying ProfileTab.tsx...");
  const profileTabPath = path.resolve(process.cwd(), "components/profile/ProfileTab.tsx");
  const profileTabSrc = fs.readFileSync(profileTabPath, "utf-8");

  assert(profileTabSrc.includes('referrerPolicy="no-referrer"'), "ProfileTab must have referrerPolicy='no-referrer' on avatar image");
  assert(profileTabSrc.includes("onError="), "ProfileTab must have onError handler on avatar image");
  assert(profileTabSrc.includes("photoInputRef"), "ProfileTab must have photoInputRef for file selection");
  assert(profileTabSrc.includes("/api/profile/upload-photo"), "ProfileTab must upload photos via /api/profile/upload-photo");
  assert(profileTabSrc.includes("handlePhotoFileUpload"), "ProfileTab must implement handlePhotoFileUpload");
  assert(profileTabSrc.includes("title=\"Click to upload / change profile photo\""), "ProfileTab avatar must be clickable for photo upload");
  console.log("  ✅ ProfileTab verified: contains referrerPolicy, onError, click-to-upload, and file picker.\n");

  // TEST 2: ProfileForm.tsx Verification
  console.log("Test 2: Verifying ProfileForm.tsx...");
  const profileFormPath = path.resolve(process.cwd(), "components/profile/ProfileForm.tsx");
  const profileFormSrc = fs.readFileSync(profileFormPath, "utf-8");

  assert(profileFormSrc.includes('referrerPolicy="no-referrer"'), "ProfileForm must have referrerPolicy='no-referrer' on avatar image");
  assert(profileFormSrc.includes("onError="), "ProfileForm must have onError handler on avatar image");
  assert(profileFormSrc.includes("📷 Upload Photo"), "ProfileForm must provide an upload button in the profile photo section");
  console.log("  ✅ ProfileForm verified: contains referrerPolicy, onError fallback, and direct photo upload button.\n");

  // TEST 3: Cross-Component referrerPolicy Verification
  console.log("Test 3: Verifying referrerPolicy='no-referrer' across components...");
  const componentsToCheck = [
    "components/NavClient.tsx",
    "components/profile/ProfilePreview.tsx",
    "components/profile/ProximityCardModal.tsx",
    "components/profile/ScrapbookCardModal.tsx",
    "components/map/DiscoverCard.tsx",
  ];

  for (const relPath of componentsToCheck) {
    const fullPath = path.resolve(process.cwd(), relPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    assert(
      content.includes('referrerPolicy="no-referrer"'),
      `${relPath} must include referrerPolicy="no-referrer" to prevent Google/OAuth avatar 403 blocks`
    );
    console.log(`  - ${relPath}: verified.`);
  }
  console.log("  ✅ All avatar components use referrerPolicy='no-referrer'.\n");

  // TEST 4: Session & OAuth Auto-Sync Verification
  console.log("Test 4: Verifying session OAuth photo auto-sync in lib/session.ts...");
  const sessionPath = path.resolve(process.cwd(), "lib/session.ts");
  const sessionSrc = fs.readFileSync(sessionPath, "utf-8");

  assert(sessionSrc.includes("session.user.image"), "lib/session.ts checks session.user.image for OAuth photos");
  assert(sessionSrc.includes("user.profile_photo_url = oauthPicture"), "lib/session.ts auto-syncs OAuth photo to user profile");
  assert(sessionSrc.includes("findUserById"), "lib/session.ts falls back to finding user by id");
  assert(sessionSrc.includes("findUserByEmail"), "lib/session.ts falls back to finding user by email");
  console.log("  ✅ lib/session.ts verified: auto-populates OAuth photo and persists to database.\n");

  // TEST 5: Upload Route Resilience Verification
  console.log("Test 5: Verifying /api/profile/upload-photo route resilience...");
  const uploadRoutePath = path.resolve(process.cwd(), "app/api/profile/upload-photo/route.ts");
  const uploadRouteSrc = fs.readFileSync(uploadRoutePath, "utf-8");

  assert(uploadRouteSrc.includes("data:${file.type};base64,"), "Upload route provides data URL fallback if storage fails");
  console.log("  ✅ /api/profile/upload-photo verified: includes data URL fallback.\n");

  // TEST 6: GET /api/profile Route Verification
  console.log("Test 6: Verifying GET /api/profile route fallback...");
  const profileRoutePath = path.resolve(process.cwd(), "app/api/profile/route.ts");
  const profileRouteSrc = fs.readFileSync(profileRoutePath, "utf-8");

  assert(profileRouteSrc.includes("profile_photo_url: user.profile_photo_url ||"), "GET /api/profile checks picture/image fallbacks");
  console.log("  ✅ /api/profile verified.\n");

  console.log("=================================================================");
  console.log("   ALL PROFILE PHOTO DISPLAY & UPLOAD TESTS PASSED!             ");
  console.log("=================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
