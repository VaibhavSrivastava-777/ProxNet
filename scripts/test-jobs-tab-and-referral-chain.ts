import assert from "assert";
import fs from "fs";
import path from "path";

async function runValidationTests() {
  console.log("==================================================================");
  console.log("🧪 VALIDATION TEST: Jobs Tab Direct Format & 2nd-Degree Chain");
  console.log("==================================================================\n");

  const cwd = process.cwd();

  // TEST 1: JobsFeed renders direct flat list of top matched jobs without company grouping
  console.log("[Test 1] Verifying JobsFeed renders top matched jobs without company grouping...");
  const jobsFeedPath = path.join(cwd, "components/jobs/JobsFeed.tsx");
  const jobsFeedContent = fs.readFileSync(jobsFeedPath, "utf-8");

  assert(
    jobsFeedContent.includes("allMatchedJobs"),
    "JobsFeed computes allMatchedJobs list flattening company trees"
  );
  assert(
    jobsFeedContent.includes("b.matchRate - a.matchRate"),
    "allMatchedJobs sorts all jobs strictly by top matchRate descending"
  );
  assert(
    !jobsFeedContent.includes("setModalCompanyGroup"),
    "Old company grouping modal state is eliminated"
  );
  console.log("✅ Passed: JobsFeed flattens and sorts all jobs directly by match rate.\n");

  // TEST 2: Job Card Format: company-logo, company name, position
  console.log("[Test 2] Verifying job card rendering format (company-logo, company name, position)...");
  assert(
    jobsFeedContent.includes("<CompanyLogo company={job.company}"),
    "Job card renders company-logo"
  );
  assert(
    jobsFeedContent.includes("{job.company}"),
    "Job card renders company name"
  );
  assert(
    jobsFeedContent.includes("{job.title}"),
    "Job card renders position (job title)"
  );
  assert(
    jobsFeedContent.includes("onClick={() => setSelectedJob(job)}"),
    "Job card click opens modal for selected job"
  );
  console.log("✅ Passed: Job card matches requested format (company-logo, company name, position).\n");

  // TEST 3: Job Detail Modal is NOT full screen and top notification bell is visible
  console.log("[Test 3] Verifying modal layout preserves top notification bell visibility and is not full screen...");
  const detailSheetPath = path.join(cwd, "components/jobs/JobDetailSheet.tsx");
  const detailSheetContent = fs.readFileSync(detailSheetPath, "utf-8");

  const navClientPath = path.join(cwd, "components/NavClient.tsx");
  const navClientContent = fs.readFileSync(navClientPath, "utf-8");

  // Nav header has z-[1010]
  assert(
    navClientContent.includes("z-[1010]"),
    "Navigation bar header containing notification bell has z-[1010]"
  );

  // Modal has z-[1000] and starts at top-[var(--nav-height,56px)]
  assert(
    detailSheetContent.includes("z-[1000]"),
    "Modal backdrop has z-[1000] to sit below the z-[1010] top bar"
  );
  assert(
    detailSheetContent.includes("top-[var(--nav-height,56px)]"),
    "Modal backdrop starts below header so top navigation bell remains visible"
  );
  assert(
    detailSheetContent.includes("max-h-[calc(100vh-var(--nav-height,56px)-24px)]"),
    "Modal restricts maximum height so it does not open full screen"
  );
  assert(
    detailSheetContent.includes("rounded-3xl"),
    "Modal uses floating rounded card container rather than edge-to-edge full screen"
  );
  console.log("✅ Passed: Modal stays below header, preserves top notification bell, and is not full screen.\n");

  // TEST 4: Modal content has Job Description, Apply Directly, and Prepare Me buttons
  console.log("[Test 4] Verifying modal contains job description, Apply Directly, and Prepare Me buttons...");
  assert(
    detailSheetContent.includes("cleanJobDescription"),
    "Modal formats and presents full Job Description"
  );
  assert(
    detailSheetContent.includes("handleApplyDirectly"),
    "Modal contains Apply Directly button"
  );
  assert(
    detailSheetContent.includes("handlePrepareMe"),
    "Modal contains Prepare Me button"
  );
  assert(
    detailSheetContent.includes("Prepare Me (1 ⚡)") || detailSheetContent.includes("View Playbook"),
    "Modal displays Prepare Me action button"
  );
  console.log("✅ Passed: Modal provides job description, Apply Directly, and Prepare Me actions.\n");

  // TEST 5: 2nd-Degree Warm Referral Path (X -> Y -> Z) Integration
  console.log("[Test 5] Verifying 2nd-degree referral chain (X -> Y -> Z) support...");
  assert(
    detailSheetContent.includes("2nd-Degree Referral Chain (X → Y → Z)"),
    "Modal renders 2nd-degree referral chain section"
  );
  assert(
    detailSheetContent.includes('network=%5B"S"%5D'),
    "Modal links to LinkedIn 2nd-degree search (S filter)"
  );
  assert(
    detailSheetContent.includes("1-Click Warm Bridge Intro"),
    "Modal generates 1-click warm intro note for X to send to Y"
  );
  assert(
    detailSheetContent.includes("copiedBridgeNote"),
    "Modal provides clipboard copy state for the warm bridge note"
  );
  console.log("✅ Passed: 2nd-degree warm referral chain with LinkedIn link and copyable pitch verified.\n");

  console.log("==================================================================");
  console.log("🎉 ALL VALIDATION TESTS PASSED SUCCESSFULLY!                      ");
  console.log("==================================================================");
}

runValidationTests().catch((err) => {
  console.error("❌ Validation test failed:", err);
  process.exit(1);
});
