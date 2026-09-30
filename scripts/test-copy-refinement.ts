import * as fs from "fs";

function runTest() {
  console.log("======================================================");
  console.log("🧪 TESTING COPY REFINEMENT IN APPLICATION SPRINT MODE");
  console.log("======================================================");

  const fileContent = fs.readFileSync("components/jobs/ApplicationSprintMode.tsx", "utf8");

  const hasLaidOff = /laid[- ]?off/i.test(fileContent);
  if (hasLaidOff) {
    console.error("❌ FAIL: File still contains 'laid-off' or 'laid off'");
    process.exit(1);
  } else {
    console.log("✅ PASS: Successfully removed all occurrences of 'laid-off' / 'laid off'");
  }

  const hasActivelyLooking = fileContent.includes("actively looking for their next career opportunity");
  if (!hasActivelyLooking) {
    console.error("❌ FAIL: Expected phrasing 'actively looking for their next career opportunity' not found");
    process.exit(1);
  } else {
    console.log("✅ PASS: Expected positive copy 'actively looking for their next career opportunity' is present");
  }

  console.log("\nAll copy tests passed successfully!");
}

runTest();
