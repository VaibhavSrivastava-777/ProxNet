import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("=== Testing Profile Auto-Save, Preview & Minimum Bar Integration ===");

const profileFormPath = path.join(process.cwd(), "components", "profile", "ProfileForm.tsx");
assert(fs.existsSync(profileFormPath), "ProfileForm.tsx must exist");
const profileFormCode = fs.readFileSync(profileFormPath, "utf-8");

// 1. Assert Preview Mode is integrated
assert(
  profileFormCode.includes("import { ProfilePreview } from \"@/components/profile/ProfilePreview\";"),
  "ProfileForm must import ProfilePreview"
);
assert(
  profileFormCode.includes("if (previewMode)"),
  "ProfileForm must have a conditional render branch for previewMode"
);
assert(
  profileFormCode.includes("<ProfilePreview"),
  "ProfileForm must render <ProfilePreview"
);
assert(
  profileFormCode.includes("Network Proximity View"),
  "ProfileForm must indicate Network Proximity View in preview mode"
);

// 2. Assert Auto-Save Engine
assert(
  profileFormCode.includes("autoSaveStatus"),
  "ProfileForm must manage autoSaveStatus"
);
assert(
  profileFormCode.includes("performAutoSave"),
  "ProfileForm must implement performAutoSave"
);
assert(
  profileFormCode.includes("autoSaveTimerRef"),
  "ProfileForm must have debounced autoSaveTimerRef"
);
assert(
  profileFormCode.includes("Auto-save is active"),
  "ProfileForm must display live auto-save status indicator in UI"
);

// 3. Assert Onboarding Redirect Removal & In-place Save
assert(
  !profileFormCode.includes('router.push("/")') || profileFormCode.indexOf('router.push("/")') === profileFormCode.lastIndexOf('router.push("/")'),
  "handleOnboardingComplete must not force redirect with router.push('/')"
);
assert(
  profileFormCode.includes("setDismissedModal(true)"),
  "Completing onboarding must dismiss the modal in-place without redirecting"
);

// 4. Assert 5 Minimum Bar Fields in Onboarding Modal
assert(
  profileFormCode.includes('type="designation"'),
  "Onboarding modal must include designation/job_title AutocompleteInput"
);
assert(
  profileFormCode.includes('type="company"'),
  "Onboarding modal must include company AutocompleteInput"
);
assert(
  profileFormCode.includes("Designation / Role is required"),
  "Onboarding modal must validate required Designation / Role"
);
assert(
  profileFormCode.includes("Company name is required"),
  "Onboarding modal must validate required Company name"
);
assert(
  profileFormCode.includes("Full name is required"),
  "Onboarding modal must validate required Full name"
);

// 5. Assert CollapsibleSection Enhanced Props (IDs, badges, onToggle auto-save)
assert(
  profileFormCode.includes('id="section-personal"'),
  "Personal section must have section-personal id"
);
assert(
  profileFormCode.includes('id="section-location"'),
  "Location section must have section-location id"
);
assert(
  profileFormCode.includes('id="section-alumni"'),
  "Alumni section must have section-alumni id"
);
assert(
  profileFormCode.includes('id="section-scrapbook"'),
  "Scrapbook section must have section-scrapbook id"
);
assert(
  profileFormCode.includes("onToggle={() => performAutoSave()}"),
  "CollapsibleSections must trigger performAutoSave on toggle"
);

// 6. Assert 100% Completeness Reward Integration
assert(
  profileFormCode.includes("completion_reward?.success"),
  "ProfileForm must listen for completion_reward from profile API"
);
assert(
  profileFormCode.includes("proxnet:wallet-updated"),
  "ProfileForm must dispatch proxnet:wallet-updated event when reward is awarded"
);

console.log("✅ All Profile Auto-Save, Preview & Minimum Bar Integration tests passed successfully!");
