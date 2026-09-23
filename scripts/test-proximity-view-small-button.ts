import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Testing Small Back Button on Proximity Card View");
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

  const profileFormPath = path.join(process.cwd(), "components", "profile", "ProfileForm.tsx");
  const profileFormCode = fs.readFileSync(profileFormPath, "utf-8");

  const profilePreviewPath = path.join(process.cwd(), "components", "profile", "ProfilePreview.tsx");
  const profilePreviewCode = fs.readFileSync(profilePreviewPath, "utf-8");

  // 1. ProfileForm has a small "Back to Profile" button
  assert(
    profileFormCode.includes("Back to Profile"),
    "ProfileForm contains 'Back to Profile' button"
  );

  // 2. ProfileForm does not contain bulky toggle bar subtitle
  assert(
    !profileFormCode.includes("This is how verified neighbors within 2 km see your card on the Proximity Map"),
    "ProfileForm removed bulky banner subtitle ('This is how verified neighbors within 2 km...')"
  );

  // 3. ProfilePreview removed redundant second banner subtitle
  assert(
    !profilePreviewCode.includes("This is how other verified professionals within 2km see your profile"),
    "ProfilePreview removed redundant banner subtitle ('This is how other verified professionals within 2km...')"
  );

  // 4. ProfilePreview removed "Return to Edit" bulky button
  assert(
    !profilePreviewCode.includes("Return to Edit"),
    "ProfilePreview removed duplicate 'Return to Edit' banner button"
  );

  // 5. Card itself still renders cleanly
  assert(
    profilePreviewCode.includes("Within 2km") && profilePreviewCode.includes("Network Proximity View"),
    "ProfilePreview card retains clean 'Within 2km' badge and 'Network Proximity View'"
  );

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
