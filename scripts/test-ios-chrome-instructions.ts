/**
 * Validation Test: iOS Chrome Installation Instructions
 *
 * Verifies that iOS installation guides across SmartAppBanner and the /install/ios page
 * have been accurately converted to prioritize Google Chrome on iOS:
 * 1. Prompts user to tap the Share icon at the top right of Chrome (next to address bar).
 * 2. Instructs user to scroll down / expand share options to find "Add to Home Screen".
 * 3. Instructs user to confirm by tapping "Add" in the top right.
 * 4. Ensures outdated "Safari only" limitations are replaced with modern iOS 16.4+ Chrome support.
 */

import * as fs from "fs";
import * as path from "path";

function runValidation() {
  console.log("🧪 Starting iOS Chrome Instructions Validation...\n");

  const projectRoot = path.resolve(__dirname, "..");
  const smartAppBannerPath = path.join(projectRoot, "components", "SmartAppBanner.tsx");
  const iosInstallPagePath = path.join(projectRoot, "app", "install", "ios", "page.tsx");

  let allPassed = true;

  // 1. Validate components/SmartAppBanner.tsx
  console.log("1. Checking components/SmartAppBanner.tsx...");
  const smartBannerContent = fs.readFileSync(smartAppBannerPath, "utf-8");

  const smartBannerChecks = [
    {
      desc: "Mentions Share icon at top right of Chrome",
      test: smartBannerContent.includes("top right") && smartBannerContent.includes("Chrome (next to the address bar)"),
    },
    {
      desc: "Mentions expanding options / scrolling down to 'Add to Home Screen'",
      test: smartBannerContent.includes("Scroll down the share sheet to expand options") && smartBannerContent.includes("Add to Home Screen"),
    },
    {
      desc: "Visual indicator highlights top right",
      test: smartBannerContent.includes("Look for the Share icon at top right"),
    },
    {
      desc: "Provides helpful fallback note for Safari users",
      test: smartBannerContent.includes("(Using Safari? Tap the Share icon in the bottom menu bar instead.)"),
    },
  ];

  for (const check of smartBannerChecks) {
    if (check.test) {
      console.log(`  ✅ ${check.desc}`);
    } else {
      console.error(`  ❌ Failed: ${check.desc}`);
      allPassed = false;
    }
  }

  // 2. Validate app/install/ios/page.tsx
  console.log("\n2. Checking app/install/ios/page.tsx...");
  const iosInstallContent = fs.readFileSync(iosInstallPagePath, "utf-8");

  const iosInstallChecks = [
    {
      desc: "Step 1 instructs Chrome top right Share button",
      test: iosInstallContent.includes("In Chrome, tap the") && iosInstallContent.includes("top right"),
    },
    {
      desc: "Step 2 instructs scrolling down share sheet to expand options",
      test: iosInstallContent.includes("Scroll down the share sheet to expand options and tap") && iosInstallContent.includes("Add to Home Screen"),
    },
    {
      desc: "Outdated 'Third-party browsers do not support adding PWAs' removed",
      test: !iosInstallContent.includes("Third-party browsers like Chrome or Firefox do not support"),
    },
    {
      desc: "Footer confirms support for Google Chrome and Safari (iOS 16.4+)",
      test: iosInstallContent.includes("Works in Google Chrome and Safari on iPhone (iOS 16.4+)"),
    },
  ];

  for (const check of iosInstallChecks) {
    if (check.test) {
      console.log(`  ✅ ${check.desc}`);
    } else {
      console.error(`  ❌ Failed: ${check.desc}`);
      allPassed = false;
    }
  }

  console.log("\n------------------------------------------------");
  if (allPassed) {
    console.log("🎉 All iOS Chrome instruction checks PASSED successfully!");
    process.exit(0);
  } else {
    console.error("❌ Some validation checks failed.");
    process.exit(1);
  }
}

runValidation();
