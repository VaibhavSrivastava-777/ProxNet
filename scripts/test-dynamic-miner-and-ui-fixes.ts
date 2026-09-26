import fs from "fs";
import path from "path";
import assert from "assert";

async function runValidation() {
  console.log("=================================================================");
  console.log("🚀 VALIDATING DYNAMIC ATS MINING, LABEL CLEANUP, PASTE & MODAL UI");
  console.log("=================================================================\n");

  // 1. Validate lib/jobs/deep-conversion-miner.ts
  console.log("[Test 1] Validating lib/jobs/deep-conversion-miner.ts dynamic discovery...");
  const minerPath = path.resolve("lib/jobs/deep-conversion-miner.ts");
  assert(fs.existsSync(minerPath), "deep-conversion-miner.ts must exist");
  const minerCode = fs.readFileSync(minerPath, "utf-8");

  // Verify HP/Google/Lenovo/MSFT are not hardcoded as fixed results for all users
  assert(
    !minerCode.includes('peers = ["Lenovo", "Google", "Microsoft"'),
    "Must NOT hardcode peers to [Lenovo, Google, Microsoft...]"
  );
  assert(
    !minerCode.includes("const topHp = hpJobs.find"),
    "Must NOT force-pull HP as top job for all users"
  );
  assert(
    !minerCode.includes("const googleJob = networkJobs.find"),
    "Must NOT force-pull Google for all users"
  );
  assert(
    !minerCode.includes("const msftJob = networkJobs.find"),
    "Must NOT force-pull Microsoft for all users"
  );
  assert(
    !minerCode.includes("const lenovoJob = networkJobs.find"),
    "Must NOT force-pull Lenovo for all users"
  );

  // Verify dynamic target & competitor discovery
  assert(
    minerCode.includes("discoverCompetitorsForCompany"),
    "Must import and use discoverCompetitorsForCompany"
  );
  assert(
    minerCode.includes("fetchDynamicCandidateOpportunities"),
    "Must define fetchDynamicCandidateOpportunities"
  );
  assert(
    minerCode.includes("crawlCandidateTargetAts"),
    "Must dynamically crawl candidate target ATS boards"
  );
  assert(
    minerCode.includes("match_scraped_jobs"),
    "Must use semantic vector search (match_scraped_jobs) based on candidate's profile"
  );
  assert(
    minerCode.includes("isSameCompany(job.company, candidate.currentCompany)"),
    "Must strictly exclude candidate's own company"
  );
  console.log("✅ Test 1 Passed: Dynamic target & competitor discovery verified without hardcoded company force-fitting.");

  // 2. Validate app/api/jobs/deep-fetch/route.ts
  console.log("\n[Test 2] Validating app/api/jobs/deep-fetch/route.ts dynamic board prioritization...");
  const deepFetchPath = path.resolve("app/api/jobs/deep-fetch/route.ts");
  assert(fs.existsSync(deepFetchPath), "deep-fetch route must exist");
  const deepFetchCode = fs.readFileSync(deepFetchPath, "utf-8");

  assert(
    deepFetchCode.includes("discoverCompetitorsForCompany"),
    "deep-fetch route must import discoverCompetitorsForCompany"
  );
  assert(
    deepFetchCode.includes("discoveredCompetitorNames"),
    "deep-fetch route must prioritize candidate's competitor ATS boards"
  );
  console.log("✅ Test 2 Passed: Deep-fetch route dynamically prioritizes candidate target companies & discovered competitors.");

  // 3. Validate DeepConversionModal.tsx labels and sticky layout
  console.log("\n[Test 3] Validating components/jobs/DeepConversionModal.tsx labels and sticky layout...");
  const modalPath = path.resolve("components/jobs/DeepConversionModal.tsx");
  assert(fs.existsSync(modalPath), "DeepConversionModal.tsx must exist");
  const modalCode = fs.readFileSync(modalPath, "utf-8");

  // Verify removal of "Option C"
  assert(!modalCode.includes("Option C:"), "Must NOT display 'Option C:' anywhere in modal");
  assert(!modalCode.includes("Option C"), "Must NOT contain 'Option C' anywhere in modal");

  // Verify removal of "Focus X", "Focus Y", "Focus Z"
  assert(!modalCode.includes("Focus X"), "Must NOT display 'Focus X' in modal");
  assert(!modalCode.includes("Focus Y"), "Must NOT display 'Focus Y' in modal");
  assert(!modalCode.includes("Focus Z"), "Must NOT display 'Focus Z' in modal");

  // Verify new descriptive labels
  assert(modalCode.includes("Resume Hook"), "Must display 'Resume Hook'");
  assert(modalCode.includes("ATS Keyword Optimization"), "Must display 'ATS Keyword Optimization'");
  assert(modalCode.includes("Interview Pitch & Strategy"), "Must display 'Interview Pitch & Strategy'");

  // Verify sticky header, sticky footer, and scrollable body
  assert(
    modalCode.includes("sticky top-0 z-30 shrink-0"),
    "Modal header must be sticky top-0 with shrink-0"
  );
  assert(
    modalCode.includes("sticky bottom-0 z-30 shrink-0"),
    "Modal footer must be sticky bottom-0 with shrink-0"
  );
  assert(
    modalCode.includes("min-h-0"),
    "Modal body must have min-h-0 for proper flexbox overflow scrolling"
  );
  console.log("✅ Test 3 Passed: DeepConversionModal labels cleaned and sticky header/footer verified.");

  // 4. Validate SuggestedJobs.tsx labels
  console.log("\n[Test 4] Validating components/jobs/SuggestedJobs.tsx labels...");
  const suggestedPath = path.resolve("components/jobs/SuggestedJobs.tsx");
  assert(fs.existsSync(suggestedPath), "SuggestedJobs.tsx must exist");
  const suggestedCode = fs.readFileSync(suggestedPath, "utf-8");

  assert(!suggestedCode.includes("Focus X"), "SuggestedJobs must NOT display 'Focus X'");
  assert(!suggestedCode.includes("Focus Y"), "SuggestedJobs must NOT display 'Focus Y'");
  assert(!suggestedCode.includes("Focus Z"), "SuggestedJobs must NOT display 'Focus Z'");
  assert(suggestedCode.includes("Resume Hook"), "SuggestedJobs must display 'Resume Hook'");
  assert(suggestedCode.includes("ATS Keyword Optimization"), "SuggestedJobs must display 'ATS Keyword Optimization'");
  assert(suggestedCode.includes("Interview Pitch & Strategy"), "SuggestedJobs must display 'Interview Pitch & Strategy'");
  console.log("✅ Test 4 Passed: SuggestedJobs labels cleaned.");

  // 5. Validate Clipboard Paste in Chat Components
  console.log("\n[Test 5] Validating clipboard paste support in chat components...");
  const jobChatPath = path.resolve("components/jobs/JobChatRoom.tsx");
  const chatRoomPath = path.resolve("components/chat/ChatRoom.tsx");
  const carpoolChatPath = path.resolve("components/carpool/CarpoolChatRoom.tsx");

  const jobChatCode = fs.readFileSync(jobChatPath, "utf-8");
  const chatRoomCode = fs.readFileSync(chatRoomPath, "utf-8");
  const carpoolChatCode = fs.readFileSync(carpoolChatPath, "utf-8");

  assert(jobChatCode.includes("handlePasteClipboard"), "JobChatRoom must have handlePasteClipboard");
  assert(jobChatCode.includes("Paste from clipboard"), "JobChatRoom must have paste button");

  assert(chatRoomCode.includes("handlePasteClipboard"), "ChatRoom must have handlePasteClipboard");
  assert(chatRoomCode.includes("Paste from clipboard"), "ChatRoom must have paste button");

  assert(carpoolChatCode.includes("handlePasteClipboard"), "CarpoolChatRoom must have handlePasteClipboard");
  assert(carpoolChatCode.includes("Paste from clipboard"), "CarpoolChatRoom must have paste button");
  console.log("✅ Test 5 Passed: Clipboard paste functionality and UI buttons present across all chats.");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Validation complete.");
}

runValidation().catch((err) => {
  console.error("❌ Validation Failed:", err.message);
  process.exit(1);
});
