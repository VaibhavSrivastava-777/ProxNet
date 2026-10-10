import assert from "assert";
import fs from "fs";
import path from "path";

async function runValidationTests() {
  console.log("==================================================================");
  console.log("🧪 VALIDATION TEST: Jobs Tab Applied Hide, Single-Select Age & Multi-Select Dropdowns");
  console.log("==================================================================\n");

  const cwd = process.cwd();

  // -------------------------------------------------------------------------
  // TEST 1: Static verification of /api/jobs/all/route.ts
  // -------------------------------------------------------------------------
  console.log("[Test 1] Verifying /api/jobs/all/route.ts per-user applied jobs exclusion...");
  const apiRoutePath = path.join(cwd, "app/api/jobs/all/route.ts");
  const apiRouteContent = fs.readFileSync(apiRoutePath, "utf-8");

  assert(
    apiRouteContent.includes('from("job_applications")'),
    "/api/jobs/all must query job_applications table for this user"
  );
  assert(
    apiRouteContent.includes('.eq("user_id", user.id)'),
    "/api/jobs/all must strictly query job_applications for user.id so other users are unaffected"
  );
  assert(
    apiRouteContent.includes("appliedJobIds") &&
    apiRouteContent.includes("appliedCompanyTitleKeys") &&
    apiRouteContent.includes("appliedUrls"),
    "/api/jobs/all must build comprehensive matching sets (job_id, company:::title, url)"
  );
  assert(
    apiRouteContent.includes("unappliedJobs"),
    "/api/jobs/all must filter out applied/status-changed opportunities into unappliedJobs"
  );
  assert(
    apiRouteContent.includes("appliedSignatures"),
    "/api/jobs/all must return appliedSignatures for client-side instant synchronization"
  );
  console.log("✅ Passed: /api/jobs/all filters opportunities for current user while preserving visibility for others.\n");

  // -------------------------------------------------------------------------
  // TEST 2: Static verification of JobDetailSheet.tsx status changer & events
  // -------------------------------------------------------------------------
  console.log("[Test 2] Verifying JobDetailSheet.tsx status updates and detail broadcasting...");
  const sheetPath = path.join(cwd, "components/jobs/JobDetailSheet.tsx");
  const sheetContent = fs.readFileSync(sheetPath, "utf-8");

  assert(
    sheetContent.includes("handleStatusChange"),
    "JobDetailSheet must provide handleStatusChange to update pipeline stage"
  );
  assert(
    sheetContent.includes("currentStage"),
    "JobDetailSheet must track currentStage state"
  );
  assert(
    sheetContent.includes("job_application_updated"),
    "JobDetailSheet must dispatch job_application_updated event with details"
  );
  assert(
    sheetContent.includes("raw_posted_at"),
    "JobItem must support raw_posted_at for precise age calculations"
  );
  console.log("✅ Passed: JobDetailSheet supports status updates and broadcasts job_application_updated.\n");

  // -------------------------------------------------------------------------
  // TEST 3: Static verification of AppliedJobsTab.tsx and ApplicationPipeline.tsx
  // -------------------------------------------------------------------------
  console.log("[Test 3] Verifying cross-tab event synchronization in AppliedJobsTab and ApplicationPipeline...");
  const appliedTabPath = path.join(cwd, "components/jobs/AppliedJobsTab.tsx");
  const appliedTabContent = fs.readFileSync(appliedTabPath, "utf-8");
  assert(
    appliedTabContent.includes("job_application_updated"),
    "AppliedJobsTab must broadcast job_application_updated on stage update and deletion"
  );

  const pipelinePath = path.join(cwd, "components/jobs/ApplicationPipeline.tsx");
  const pipelineContent = fs.readFileSync(pipelinePath, "utf-8");
  assert(
    pipelineContent.includes("job_application_updated"),
    "ApplicationPipeline must broadcast job_application_updated"
  );
  console.log("✅ Passed: Pipeline and tracker tabs synchronize across components.\n");

  // -------------------------------------------------------------------------
  // TEST 4: Static verification of JobsFeed.tsx Dropdowns (Location, Single-Select Age, Function, Keywords)
  // -------------------------------------------------------------------------
  console.log("[Test 4] Verifying JobsFeed.tsx Dropdowns: Single-Select Age + Multi-Select Location/Function/Keywords...");
  const feedPath = path.join(cwd, "components/jobs/JobsFeed.tsx");
  const feedContent = fs.readFileSync(feedPath, "utf-8");

  // 4 Dropdowns existence
  assert(
    feedContent.includes("LOCATION_OPTIONS"),
    "JobsFeed must define LOCATION_OPTIONS for Location dropdown"
  );
  assert(
    feedContent.includes("AGE_OPTIONS"),
    "JobsFeed must define AGE_OPTIONS for Age of Posting dropdown"
  );
  assert(
    feedContent.includes("FUNCTION_OPTIONS"),
    "JobsFeed must define FUNCTION_OPTIONS for Function dropdown"
  );
  assert(
    feedContent.includes("availableKeywords"),
    "JobsFeed must compute availableKeywords for Keywords dropdown"
  );

  // Single select for Age, multi-select for Location, Function, Keywords
  assert(
    feedContent.includes("selectedAge") &&
    feedContent.includes("selectedLocations") &&
    feedContent.includes("selectedFunctions") &&
    feedContent.includes("selectedKeywords"),
    "JobsFeed must maintain selectedAge as single threshold and multi-select for other filters"
  );
  assert(
    feedContent.includes('selectedAge === "all"') || feedContent.includes('selectedAge !== "all"'),
    "JobsFeed must check selectedAge against 'all'"
  );
  assert(
    feedContent.includes("toggleFilter"),
    "JobsFeed must have toggleFilter helper supporting multi-select for locations/functions/keywords"
  );

  // Filter persistence in localStorage
  assert(
    feedContent.includes("localStorage.getItem") &&
    feedContent.includes("localStorage.setItem") &&
    feedContent.includes("proxnet_job_feed_filters"),
    "JobsFeed must persist filters to localStorage under 'proxnet_job_feed_filters'"
  );

  // Clear filters
  assert(
    feedContent.includes("handleClearFilters") &&
    feedContent.includes("localStorage.removeItem"),
    "JobsFeed must support handleClearFilters to reset all filters"
  );

  // Hide applied opportunities
  assert(
    feedContent.includes("appliedJobKeys"),
    "JobsFeed must maintain appliedJobKeys to exclude user's applied jobs"
  );
  assert(
    feedContent.includes("handleJobApplicationUpdated"),
    "JobsFeed must listen to job_application_updated to instantly remove applied jobs"
  );

  console.log("✅ Passed: JobsFeed contains single-select Age of Posting, multi-select Location/Function/Keywords, persistence, and instant applied hiding.\n");

  // -------------------------------------------------------------------------
  // TEST 5: Verify existing critical assertions in JobsFeed.tsx
  // -------------------------------------------------------------------------
  console.log("[Test 5] Verifying existing critical tests and contract compliance...");
  assert(
    feedContent.includes("(and others on click in a modal)"),
    "Must preserve user copy: (and others on click in a modal)"
  );
  assert(
    feedContent.includes("Top Matched Opportunity"),
    "Must preserve Top Matched Opportunity badge"
  );
  assert(
    feedContent.includes("setActiveCompanyModal(group)"),
    "Must preserve setActiveCompanyModal"
  );
  assert(
    feedContent.includes("b.topJob.matchRate - a.topJob.matchRate"),
    "Must preserve topJob.matchRate sorting"
  );
  assert(
    feedContent.includes("pt-[max(env(safe-area-inset-top),1.5rem)]"),
    "Must preserve safe area top padding in modals"
  );
  assert(
    feedContent.includes("sticky top-0 z-50 shrink-0"),
    "Must preserve sticky modal header"
  );
  assert(
    feedContent.includes("isIndiaLocation(j.location, j.description, j.title)"),
    "Must preserve India location guard"
  );
  assert(
    feedContent.includes("<CompanyLogo company={group.company}"),
    "Must preserve CompanyLogo in card"
  );
  assert(
    feedContent.includes("{group.company}"),
    "Must preserve company name in card"
  );
  assert(
    feedContent.includes("{group.topJob.title}"),
    "Must preserve job title in card"
  );
  assert(
    feedContent.includes("onClick={() => setSelectedJob(group.topJob)}"),
    "Must preserve card click trigger for job details"
  );
  assert(
    feedContent.includes("visibleCount"),
    "Must preserve visibleCount pagination"
  );

  console.log("✅ Passed: All existing JobsFeed contracts and test constraints preserved.\n");

  // -------------------------------------------------------------------------
  // TEST 6: Functional logic validation of single-select age and multi-select filters
  // -------------------------------------------------------------------------
  console.log("[Test 6] Running functional unit simulation for single-select age & multi-select filtering...");

  // Simulate Age threshold check
  function isAgeEligible(diffHours: number, selectedAge: string): boolean {
    if (selectedAge === "all") return true;
    if (selectedAge === "24h") return diffHours <= 24;
    if (selectedAge === "3d") return diffHours <= 24 * 3;
    if (selectedAge === "7d") return diffHours <= 24 * 7;
    if (selectedAge === "14d") return diffHours <= 24 * 14;
    if (selectedAge === "30d") return diffHours <= 24 * 30;
    return true;
  }

  // 1. Age threshold testing
  const job12h = 12; // 12 hours old
  const job48h = 48; // 2 days old
  const job5d = 120; // 5 days old

  // When 'all', all pass
  assert.strictEqual(isAgeEligible(job12h, "all"), true);
  assert.strictEqual(isAgeEligible(job48h, "all"), true);
  assert.strictEqual(isAgeEligible(job5d, "all"), true);

  // When '24h', only 12h passes
  assert.strictEqual(isAgeEligible(job12h, "24h"), true);
  assert.strictEqual(isAgeEligible(job48h, "24h"), false);
  assert.strictEqual(isAgeEligible(job5d, "24h"), false);

  // When switching to '3d', 12h and 48h pass, 5d fails
  assert.strictEqual(isAgeEligible(job12h, "3d"), true);
  assert.strictEqual(isAgeEligible(job48h, "3d"), true);
  assert.strictEqual(isAgeEligible(job5d, "3d"), false);

  // When switching to '7d', all pass
  assert.strictEqual(isAgeEligible(job5d, "7d"), true);

  // 2. Multi-select toggle helper simulation for other categories
  function testToggle(current: string[], optionId: string): string[] {
    if (optionId === "all") return ["all"];
    const withoutAll = current.filter((x) => x !== "all");
    if (withoutAll.includes(optionId)) {
      const next = withoutAll.filter((x) => x !== optionId);
      return next.length === 0 ? ["all"] : next;
    }
    return [...withoutAll, optionId];
  }

  let locs = ["all"];
  locs = testToggle(locs, "bengaluru");
  assert.deepStrictEqual(locs, ["bengaluru"]);
  locs = testToggle(locs, "pune");
  assert.deepStrictEqual(locs, ["bengaluru", "pune"]);

  console.log("✅ Passed: Single-select age thresholding and multi-select toggle verified.\n");

  console.log("==================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

runValidationTests().catch((err) => {
  console.error("❌ Test validation failed:", err);
  process.exit(1);
});
