import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Validating Proximity Card Modal & ProxNet AI Chat UI/UX");
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

  // --- PART 1: Proximity Card Modal Component ---
  const proximityCardModalPath = path.join(process.cwd(), "components", "profile", "ProximityCardModal.tsx");
  assert(fs.existsSync(proximityCardModalPath), "ProximityCardModal.tsx exists in components/profile");
  
  const cardModalCode = fs.readFileSync(proximityCardModalPath, "utf-8");
  assert(cardModalCode.includes("Network Proximity View"), "ProximityCardModal contains 'Network Proximity View' banner badge");
  assert(cardModalCode.includes("formatDistance"), "ProximityCardModal formats proximity distance");
  assert(cardModalCode.includes("CHAT_PREF_LABELS"), "ProximityCardModal includes quick chat preference labels (chai, walk, etc.)");
  assert(cardModalCode.includes("CompanyLogo"), "ProximityCardModal embeds company logo on avatar");
  assert(cardModalCode.includes("computeReasonToEngage"), "ProximityCardModal includes Reason to Engage logic");
  assert(cardModalCode.includes("I Can Help With:"), "ProximityCardModal renders 'I Can Help With:' scrapbook section");
  assert(cardModalCode.includes("Tinkering With:"), "ProximityCardModal renders 'Tinkering With:' scrapbook section");
  assert(cardModalCode.includes("Ask Me About:"), "ProximityCardModal renders 'Ask Me About:' scrapbook section");
  assert(cardModalCode.includes("Say Hi / Chat"), "ProximityCardModal provides active chat button");
  assert(cardModalCode.includes("onFollowToggle"), "ProximityCardModal provides follow/unfollow toggle");

  // --- PART 2: ProximityMap Wire-up ---
  const proximityMapPath = path.join(process.cwd(), "components", "map", "ProximityMap.tsx");
  const proximityMapCode = fs.readFileSync(proximityMapPath, "utf-8");
  assert(
    proximityMapCode.includes("import { ProximityCardModal } from \"@/components/profile/ProximityCardModal\""),
    "ProximityMap imports ProximityCardModal"
  );
  assert(
    proximityMapCode.includes("<ProximityCardModal") && proximityMapCode.includes("person={selectedPerson}"),
    "ProximityMap renders ProximityCardModal when selectedPerson is set"
  );
  assert(
    !proximityMapCode.includes("bg-[var(--color-surface)] w-full max-w-sm rounded-xl shadow-xl border border-[var(--color-border)] p-5 animate-scaleIn flex flex-col gap-4"),
    "ProximityMap replaced old plain modal with ProximityCardModal"
  );

  // --- PART 3: People API Attributes ---
  const peopleApiPath = path.join(process.cwd(), "app", "api", "proximity", "people", "route.ts");
  const peopleApiCode = fs.readFileSync(peopleApiPath, "utf-8");
  assert(
    peopleApiCode.includes("help_offers") && peopleApiCode.includes("quick_chat_preference") && peopleApiCode.includes("society_name"),
    "People API selects and returns scrapbook fields (help_offers, quick_chat_preference, society_name)"
  );

  // --- PART 4: JobPost Interested Professionals ---
  const jobPostClientPath = path.join(process.cwd(), "components", "forum", "JobPostClientPage.tsx");
  const jobPostClientCode = fs.readFileSync(jobPostClientPath, "utf-8");
  assert(
    jobPostClientCode.includes("ProximityCardModal"),
    "JobPostClientPage imports and renders ProximityCardModal"
  );
  assert(
    jobPostClientCode.includes("setSelectedProfessional"),
    "JobPostClientPage supports clicking interested professionals"
  );

  // --- PART 5: ProxNet AI Chat UI/UX Matching Other Chats ---
  const aiChatPath = path.join(process.cwd(), "app", "proxnet-ai", "page.tsx");
  const aiChatCode = fs.readFileSync(aiChatPath, "utf-8");
  assert(
    aiChatCode.includes("whatsapp-chat-bg"),
    "ProxNet AI chat uses '.whatsapp-chat-bg' signature background"
  );
  assert(
    aiChatCode.includes("visualViewport") && aiChatCode.includes("viewportHeight"),
    "ProxNet AI chat implements visualViewport height and offset handling (mobile keyboard friendly)"
  );
  assert(
    aiChatCode.includes("var(--whatsapp-bubble-sent)") && aiChatCode.includes("var(--whatsapp-bubble-received)"),
    "ProxNet AI chat uses WhatsApp sent and received bubble color tokens"
  );
  assert(
    aiChatCode.includes("var(--whatsapp-text)"),
    "ProxNet AI chat uses '--whatsapp-text' for bubble content"
  );
  assert(
    aiChatCode.includes("typingBounce") && aiChatCode.includes("ProxNet AI is typing"),
    "ProxNet AI chat includes bouncing-dots typing indicator matching other chats"
  );
  assert(
    aiChatCode.includes("#00a884") && aiChatCode.includes("chat-textarea"),
    "ProxNet AI chat input bar uses 'chat-textarea' and WhatsApp green send button (#00a884)"
  );
  assert(
    aiChatCode.includes("formatAbsoluteTime"),
    "ProxNet AI chat renders inline timestamps on message bubbles"
  );
  assert(
    aiChatCode.includes("AI_ICEBREAKERS"),
    "ProxNet AI chat renders icebreaker prompt suggestions on empty state"
  );
  assert(
    aiChatCode.includes("showScroll") && aiChatCode.includes("scrollIntoView"),
    "ProxNet AI chat provides floating scroll-to-bottom button"
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
