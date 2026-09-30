import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function runTest() {
  console.log("=== Testing Today's Sprint Priority Roles Modal & Sprint Playbook Guide ===");

  // 1. Verify SuggestedJobs.tsx
  console.log("\n1. Verifying SuggestedJobs.tsx (Company Openings Modal & Back Button)...");
  const suggestedFilePath = path.resolve(process.cwd(), "components/jobs/SuggestedJobs.tsx");
  const suggestedContent = fs.readFileSync(suggestedFilePath, "utf-8");

  // Check handleCloseCompanyModal implementation
  assert(
    suggestedContent.includes("const handleCloseCompanyModal = useCallback("),
    "SuggestedJobs must implement handleCloseCompanyModal"
  );
  assert(
    suggestedContent.includes('window.history.state?.modal === "company-openings"') &&
    suggestedContent.includes("window.history.back()"),
    "handleCloseCompanyModal must navigate history back when modal state was pushed"
  );

  // Check popstate and pushState
  assert(
    suggestedContent.includes('window.history.pushState({ modal: "company-openings" }'),
    "SuggestedJobs must push history state when opening company modal"
  );
  assert(
    suggestedContent.includes('window.addEventListener("popstate", handlePopState)'),
    "SuggestedJobs must register popstate listener for browser/device back button"
  );

  // Check modal container layout safety (preventing truncation)
  assert(
    suggestedContent.includes("z-[100000]") &&
    suggestedContent.includes("pt-[max(env(safe-area-inset-top)") &&
    suggestedContent.includes("overflow-hidden"),
    "Company modal overlay must have high z-index, safe-area-inset-top padding, and overflow-hidden to prevent top truncation"
  );

  // Check pinned header with Back and Close buttons
  assert(
    suggestedContent.includes("Back") &&
    suggestedContent.includes("handleCloseCompanyModal"),
    "Modal header must include Back button wired to handleCloseCompanyModal"
  );
  assert(
    suggestedContent.includes('aria-label="Close modal"'),
    "Modal header must have accessible Close button"
  );

  // Check pinned footer with Back to Jobs button
  assert(
    suggestedContent.includes("Back to Jobs"),
    "Modal must include a pinned footer with 'Back to Jobs' button"
  );

  console.log("✓ SuggestedJobs.tsx has fixed non-truncated modal, in-app Back button, and popstate navigation support.");

  // 2. Verify ApplicationSprintMode.tsx
  console.log("\n2. Verifying ApplicationSprintMode.tsx (Sprint Playbook & Action Guide)...");
  const sprintFilePath = path.resolve(process.cwd(), "components/jobs/ApplicationSprintMode.tsx");
  const sprintContent = fs.readFileSync(sprintFilePath, "utf-8");

  // Check state and trigger
  assert(
    sprintContent.includes("const [showGuideModal, setShowGuideModal] = useState(false);"),
    "ApplicationSprintMode must maintain showGuideModal state"
  );
  assert(
    sprintContent.includes("setShowGuideModal(true);"),
    "handleActivateSprint must show guide modal when sprint starts"
  );

  // Check re-open button on active dashboard
  assert(
    sprintContent.includes("Sprint Playbook") &&
    sprintContent.includes("onClick={() => setShowGuideModal(true)}"),
    "Active sprint header must include 'Sprint Playbook' info button"
  );

  // Check guide modal contents
  assert(
    sprintContent.includes("Application Sprint Playbook") &&
    sprintContent.includes("Your Daily Self-Effort Routine"),
    "Guide modal must describe self-effort routine"
  );
  assert(
    sprintContent.includes("+1 Log") &&
    sprintContent.includes("+1 Log DM") &&
    sprintContent.includes("+1 Log Ref"),
    "Guide modal must explain all three +1 logging actions"
  );
  assert(
    sprintContent.includes("Apply Direct") &&
    sprintContent.includes("2–3"),
    "Guide modal must advise 2-3 quality direct applications daily"
  );

  // Check modal dismissal
  assert(
    sprintContent.includes("Got It, Let's Sprint! 🚀") || sprintContent.includes("Got It, Let&apos;s Sprint! 🚀"),
    "Guide modal must provide a closing button"
  );
  assert(
    sprintContent.includes("onClick={() => setShowGuideModal(false)}"),
    "Guide modal close button must set showGuideModal to false"
  );

  console.log("✓ ApplicationSprintMode.tsx successfully displays and allows closing the sprint action guide.");

  console.log("\nALL SPRINT & MODAL VALIDATION TESTS PASSED! 🎉");
}

runTest();
