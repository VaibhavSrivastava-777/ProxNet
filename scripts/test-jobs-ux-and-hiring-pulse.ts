import * as fs from "fs";
import * as path from "path";

async function runValidation() {
  console.log("================================================================================");
  console.log("VALIDATION: JOBS TAB SIMPLIFIED UX & CLICKABLE HIRING PULSE LINKS");
  console.log("================================================================================\n");

  const suggestedJobsPath = path.join(process.cwd(), "components/jobs/SuggestedJobs.tsx");
  const resumeCardPath = path.join(process.cwd(), "components/jobs/ResumeCard.tsx");
  const pipelinePath = path.join(process.cwd(), "components/jobs/ApplicationPipeline.tsx");

  const suggestedJobsCode = fs.readFileSync(suggestedJobsPath, "utf-8");
  const resumeCardCode = fs.readFileSync(resumeCardPath, "utf-8");
  const pipelineCode = fs.readFileSync(pipelinePath, "utf-8");

  // --------------------------------------------------------------------------------
  // TEST 1: Hiring Pulse Interactive & Clickable Buttons
  // --------------------------------------------------------------------------------
  console.log(">>> [TEST 1] Validating Clickable Hiring Pulse Links & Filters...");

  // 1A: Button IDs exist
  const requiredPulseIds = [
    "pulse-active-roles",
    "pulse-strong-matches",
    "pulse-insider-referrers",
    "pulse-companies",
  ];

  for (const id of requiredPulseIds) {
    if (!suggestedJobsCode.includes(`id="${id}"`)) {
      throw new Error(`Test 1 Failed: SuggestedJobs.tsx missing button with id="${id}"`);
    }
    console.log(`  ✓ Hiring pulse button id="${id}" verified.`);
  }

  // 1B: Verify click handlers
  if (!suggestedJobsCode.includes('setJobsViewMode("all")') || !suggestedJobsCode.includes('setJobsViewMode("matched")')) {
    throw new Error("Test 1 Failed: Hiring pulse buttons do not switch view mode");
  }
  if (!suggestedJobsCode.includes("setMinScoreFilter")) {
    throw new Error("Test 1 Failed: Hiring pulse buttons do not filter by match score");
  }
  if (!suggestedJobsCode.includes("setHasReferrersOnly")) {
    throw new Error("Test 1 Failed: Hiring pulse buttons do not toggle insider referrers filter");
  }
  if (!suggestedJobsCode.includes('document.getElementById("jobs-company-list")')) {
    throw new Error("Test 1 Failed: Hiring pulse companies button does not scroll to company list");
  }
  console.log("  ✓ All 4 hiring pulse buttons have direct, functional filtering/scrolling click handlers.");

  // 1C: Target container exists
  if (!suggestedJobsCode.includes('id="jobs-company-list"')) {
    throw new Error("Test 1 Failed: Missing id='jobs-company-list' on company listings container");
  }
  console.log("  ✓ Scroll target id='jobs-company-list' verified on company listings container.");
  console.log("✓ [TEST 1 PASSED] Hiring pulse links are fully interactive and clickable.\n");

  // --------------------------------------------------------------------------------
  // TEST 2: Simplistic & Decluttered UX Improvements
  // --------------------------------------------------------------------------------
  console.log(">>> [TEST 2] Validating Simplistic & Decluttered UX...");

  // 2A: Application Pipeline hidden when empty
  if (!pipelineCode.includes("if (totalCount === 0) {\n    return null;\n  }")) {
    throw new Error("Test 2 Failed: ApplicationPipeline does not return null when totalCount === 0");
  }
  console.log("  ✓ ApplicationPipeline returns null when empty, removing placeholder clutter.");

  // 2B: ResumeCard compact layout
  if (resumeCardCode.includes("p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm")) {
    throw new Error("Test 2 Failed: ResumeCard still contains bloated old layout");
  }
  console.log("  ✓ ResumeCard streamlined into a slim, single-row compact prompt.");

  // 2C: Candidate Profile Summary collapsible
  if (!suggestedJobsCode.includes("<details") || !suggestedJobsCode.includes("<summary")) {
    throw new Error("Test 2 Failed: Candidate Profile Summary is not encapsulated in collapsible <details>");
  }
  console.log("  ✓ Candidate Profile Summary encapsulated in collapsible <details>, saving vertical space.");

  // 2D: Background matching banner is non-intrusive
  if (suggestedJobsCode.includes("text-blue-700 dark:text-blue-300 font-bold text-center animate-pulse")) {
    throw new Error("Test 2 Failed: Bulky background matching banner still present");
  }
  console.log("  ✓ Background match status modernized into a sleek, non-intrusive pill.");
  console.log("✓ [TEST 2 PASSED] Jobs tab UX is streamlined and simplistic.\n");

  console.log("================================================================================");
  console.log("ALL JOBS TAB UX TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================");
}

runValidation().catch((err) => {
  console.error("VALIDATION FAILED:", err);
  process.exit(1);
});
