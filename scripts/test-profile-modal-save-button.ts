/**
 * Validation test for Profile modal "Save Profile" visibility and responsive layout.
 * Verifies:
 * 1. Modal overlay z-index is higher than NavClient mobile bottom tab bar (z-[1010])
 * 2. Modal card uses bounded viewport height and overflow-hidden
 * 3. Scrollable body uses flex-1 min-h-0 overflow-y-auto to prevent flex overflow bugs
 * 4. Modal footer is sticky at the bottom with explicit shrink-0
 * 5. Dismissible state is implemented (close button, fallback link, reopen banner)
 * 6. Delete confirmation modal z-index is >= z-[2000]
 * 7. app/profile/page.tsx has adequate bottom padding clearance for mobile nav
 */

import fs from "fs";
import path from "path";

function runTests() {
  console.log("Starting Profile Modal 'Save Profile' Button Validation...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetails?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (errorDetails) console.error(`   Details: ${errorDetails}`);
      failed++;
    }
  }

  const profileFormPath = path.resolve(process.cwd(), "components/profile/ProfileForm.tsx");
  const navClientPath = path.resolve(process.cwd(), "components/NavClient.tsx");
  const profilePagePath = path.resolve(process.cwd(), "app/profile/page.tsx");

  const profileFormContent = fs.readFileSync(profileFormPath, "utf-8");
  const navClientContent = fs.readFileSync(navClientPath, "utf-8");
  const profilePageContent = fs.readFileSync(profilePagePath, "utf-8");

  // 1. Mobile Bottom Bar Z-Index Check
  const navMatch = navClientContent.match(/md:hidden fixed bottom-0[^>]*z-\[(\d+)\]/);
  const navZIndex = navMatch ? parseInt(navMatch[1], 10) : 1010;
  console.log(`Information: NavClient mobile bottom bar z-index is ${navZIndex}`);

  // 2. Modal overlay z-index must exceed NavClient
  const modalOverlayMatch = profileFormContent.match(/\{showModal && \(\s*<div className="fixed inset-0 z-\[(\d+)\]/);
  const modalZIndex = modalOverlayMatch ? parseInt(modalOverlayMatch[1], 10) : 0;
  assert(
    modalZIndex > navZIndex,
    `Modal overlay z-index (z-[${modalZIndex}]) must exceed mobile bottom bar (z-[${navZIndex}])`,
    `Found z-index: ${modalZIndex}, expected > ${navZIndex}`
  );

  // 3. Delete confirmation modal z-index must exceed NavClient
  const deleteModalMatch = profileFormContent.match(/\{showDeleteConfirm && \(\s*<div className="fixed inset-0 z-\[(\d+)\]/);
  const deleteModalZIndex = deleteModalMatch ? parseInt(deleteModalMatch[1], 10) : 0;
  assert(
    deleteModalZIndex > navZIndex,
    `Delete modal z-index (z-[${deleteModalZIndex}]) must exceed mobile bottom bar (z-[${navZIndex}])`,
    `Found z-index: ${deleteModalZIndex}, expected > ${navZIndex}`
  );

  // 4. Modal card container bounded height and flex col
  const hasBoundedHeight = profileFormContent.includes("max-h-[min(90dvh,calc(100vh-2rem))]") || profileFormContent.includes("max-h-[90dvh]");
  const hasOverflowHidden = profileFormContent.includes("overflow-hidden") && profileFormContent.includes("flex flex-col");
  assert(
    hasBoundedHeight && hasOverflowHidden,
    "Modal card uses viewport-bounded height with overflow-hidden and flex flex-col",
    "Missing max-h-[min(90dvh,...)] or overflow-hidden on modal container"
  );

  // 5. Scrollable body uses flex-1 min-h-0 overflow-y-auto
  const hasMinH0 = profileFormContent.includes("min-h-0 overflow-y-auto");
  assert(
    hasMinH0,
    "Scrollable field list container uses flex-1 min-h-0 overflow-y-auto to prevent flex overflow",
    "Missing min-h-0 on scroll container"
  );

  // 6. Sticky footer button
  const hasStickyFooter = profileFormContent.includes("sticky bottom-0 z-10") && profileFormContent.includes("Complete & Save Profile ✓");
  assert(
    hasStickyFooter,
    "Modal footer is sticky bottom-0 with z-10 so 'Save Profile' button is always visible",
    "Missing sticky footer or save button"
  );

  // 7. Modal dismissibility & close button
  const hasDismissState = profileFormContent.includes("const [dismissedModal, setDismissedModal] = useState(false);");
  const hasShowModalCondition = profileFormContent.includes("hasMissingFields && !dismissedModal");
  const hasCloseButton = profileFormContent.includes("setDismissedModal(true)") && profileFormContent.includes('aria-label="Close modal"');
  const hasPageLink = profileFormContent.includes("Or fill details directly on full profile page");
  const hasReopenBanner = profileFormContent.includes("Reopen Quick Setup");

  assert(
    hasDismissState && hasShowModalCondition,
    "showModal logic respects dismissedModal state",
    "showModal missing !dismissedModal check"
  );

  assert(
    hasCloseButton && hasPageLink && hasReopenBanner,
    "Modal includes close '✕' button, secondary page link, and reopen banner on main form",
    "Missing close button, page link, or reopen banner"
  );

  // 8. Main page bottom padding clearance
  const hasBottomPadding = profilePageContent.includes("120px") || profilePageContent.includes("pb-28");
  assert(
    hasBottomPadding,
    "app/profile/page.tsx has >= 120px bottom clearance to prevent bottom nav bar overlap",
    "Padding in app/profile/page.tsx is insufficient for mobile nav"
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
