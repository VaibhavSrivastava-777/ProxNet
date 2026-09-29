import fs from "fs";
import path from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runValidation() {
  console.log("\n================================================================================");
  console.log("🧪 VALIDATION: Chat Send Button & Bell Notification Alignment Fixes");
  console.log("================================================================================\n");

  const cwd = process.cwd();

  // ── TEST 1: globals.css Keyframe Validation ──
  console.log("[Test Suite 1: CSS Animation & Keyframe Fixes]");
  const globalsCssPath = path.join(cwd, "app", "globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  // Verify that the global fadeInDown no longer includes translate(-50%
  const fadeInDownMatch = globalsCss.match(/@keyframes fadeInDown\s*\{([\s\S]*?)\}/);
  assert(fadeInDownMatch !== null, "fadeInDown keyframe exists in globals.css");
  assert(
    !fadeInDownMatch![1].includes("translate(-50%"),
    "fadeInDown does NOT horizontally shift elements with translate(-50%)"
  );
  assert(
    fadeInDownMatch![1].includes("translateY"),
    "fadeInDown smoothly translates along Y axis only"
  );

  // Verify that .animate-fadeInDown does not force translate(-50%)
  const animateFadeInDownIdx = globalsCss.indexOf(".animate-fadeInDown");
  assert(animateFadeInDownIdx !== -1, ".animate-fadeInDown utility class is defined");
  const fadeInDownBlock = globalsCss.slice(animateFadeInDownIdx, animateFadeInDownIdx + 120);
  assert(
    !fadeInDownBlock.includes("translate(-50%"),
    ".animate-fadeInDown block does not inject translate(-50%)"
  );

  // ── TEST 2: NotificationCenter Alignment & Popover Structure ──
  console.log("\n[Test Suite 2: Notification Center Bell Dropdown Alignment]");
  const notifCenterPath = path.join(cwd, "components", "NotificationCenter.tsx");
  const notifCenter = fs.readFileSync(notifCenterPath, "utf-8");

  assert(notifCenter.includes("animate-fadeInDown"), "Notification dropdown uses fadeInDown animation");
  assert(notifCenter.includes("fixed inset-x-3 top-16"), "Notification dropdown is centered on mobile (fixed inset-x-3)");
  assert(notifCenter.includes("md:absolute md:inset-x-auto md:right-0 md:top-full"), "Notification dropdown is anchored right under bell on desktop");
  assert(notifCenter.includes("z-[1050]"), "Notification dropdown has elevated z-index (z-[1050])");

  // ── TEST 3: QuestionForm Sticky Send Toolbar & Autofocus Optimization ──
  console.log("\n[Test Suite 3: QuestionForm Sticky Send Button & Mobile Keyboard Safety]");
  const questionFormPath = path.join(cwd, "components", "qa", "QuestionForm.tsx");
  const questionForm = fs.readFileSync(questionFormPath, "utf-8");

  assert(
    questionForm.includes("sticky bottom-0"),
    "QuestionForm send toolbar is sticky (sticky bottom-0) so it never scrolls out of view"
  );
  assert(
    questionForm.includes("bg-[var(--color-surface)]"),
    "Sticky send toolbar has opaque surface background"
  );
  assert(
    questionForm.includes('!initialMsg') && questionForm.includes('textareaRef.current?.focus()'),
    "Autofocus is bypassed when pre-filled template message exists (prevents mobile keyboard occlusion)"
  );
  assert(
    questionForm.includes('type="submit"') && questionForm.includes("Send Message"),
    "Send button is present with 'Send Message' label for direct user chats"
  );

  // ── TEST 4: ProximityMap Modal Z-Index & Safe Area ──
  console.log("\n[Test Suite 4: ProximityMap Direct Message Modal Occlusion Fix]");
  const proximityMapPath = path.join(cwd, "components", "map", "ProximityMap.tsx");
  const proximityMap = fs.readFileSync(proximityMapPath, "utf-8");

  assert(
    proximityMap.includes("fixed inset-0 z-[1100]"),
    "Direct message modal uses z-[1100] to sit cleanly ABOVE mobile bottom navigation (z-[1010])"
  );
  assert(
    proximityMap.includes("pb-safe"),
    "Direct message modal includes pb-safe for mobile home-indicator safety"
  );
  assert(
    proximityMap.includes("openDirectChat(p)"),
    "ProximityMap list view chat icon dispatches openDirectChat"
  );
  assert(
    proximityMap.includes("initialMsg={getChatSuggestion(chatTarget)}"),
    "Direct Message modal pre-fills personalized neighbor suggestion"
  );

  // ── TEST 5: ProxNet AI Direct Chat Modal & Connection ──
  console.log("\n[Test Suite 5: ProxNet AI Direct Message & Professional Connect Flow]");
  const proxnetAiPath = path.join(cwd, "app", "proxnet-ai", "page.tsx");
  const proxnetAi = fs.readFileSync(proxnetAiPath, "utf-8");

  assert(
    proxnetAi.includes('import { QuestionForm } from "@/components/qa/QuestionForm";'),
    "ProxNet AI page imports QuestionForm"
  );
  assert(
    proxnetAi.includes("const [chatTarget, setChatTarget] = useState"),
    "ProxNet AI page tracks chatTarget state"
  );
  assert(
    proxnetAi.includes("setChatTarget(target)"),
    "ProximityCardModal onStartChat sets chatTarget directly within ProxNet AI"
  );
  assert(
    proxnetAi.includes("<QuestionForm") && proxnetAi.includes("targetUser={{"),
    "ProxNet AI page renders QuestionForm modal for direct messages"
  );
  assert(
    proxnetAi.includes("z-[1100]"),
    "ProxNet AI direct message modal uses elevated z-[1100]"
  );

  // ── TEST 6: QAContent Modal Z-Index ──
  console.log("\n[Test Suite 6: QAContent Modal Elevation]");
  const qaContentPath = path.join(cwd, "app", "qa", "QAContent.tsx");
  const qaContent = fs.readFileSync(qaContentPath, "utf-8");

  assert(
    qaContent.includes("fixed inset-0 z-[1100]"),
    "QAContent direct question modal uses z-[1100]"
  );

  // ── TEST 7: ProximityCardModal Elevation ──
  console.log("\n[Test Suite 7: ProximityCardModal Elevation]");
  const proximityCardPath = path.join(cwd, "components", "profile", "ProximityCardModal.tsx");
  const proximityCard = fs.readFileSync(proximityCardPath, "utf-8");

  assert(
    proximityCard.includes("fixed inset-0 z-[1100]"),
    "ProximityCardModal uses z-[1100]"
  );

  console.log("\n================================================================================");
  console.log("✅ ALL VALIDATION TESTS PASSED (100%)");
  console.log("================================================================================\n");
}

runValidation().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
