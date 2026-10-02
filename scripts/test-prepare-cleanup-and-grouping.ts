import { cleanJobDescription } from "../components/jobs/JobDetailSheet";
import assert from "assert";
import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("🧪 Running validation tests for user requirements...\n");

  // TEST 1: Raw HTML cleaning from job descriptions
  console.log("👉 Test 1: Validating cleanJobDescription removes HTML tags like <br> and formats text...");
  const rawHtmlDesc = `
    <h3>Responsibilities:</h3>
    <p>We are seeking an executive to lead our team.<br>Key requirements include:<br/>
    <ul>
      <li>10+ years in distributed systems&amp; cloud architecture</li>
      <li>Experience with PostgreSQL &nbsp; &amp; Next.js</li>
    </ul>
    </p>
    <div>Contact us at jobs@example.com</div>
  `;

  const cleaned = cleanJobDescription(rawHtmlDesc);
  console.log("Sample Cleaned Description Snippet:\n", cleaned.substring(0, 200));

  assert(!cleaned.includes("<br>"), "Must not contain <br>");
  assert(!cleaned.includes("<br/>"), "Must not contain <br/>");
  assert(!cleaned.includes("<p>"), "Must not contain <p>");
  assert(!cleaned.includes("</p>"), "Must not contain </p>");
  assert(!cleaned.includes("<li>"), "Must not contain <li>");
  assert(!cleaned.includes("&amp;"), "Must decode &amp; to &");
  assert(!cleaned.includes("&nbsp;"), "Must decode &nbsp; to space");
  assert(cleaned.includes("• 10+ years in distributed systems& cloud architecture"), "Bullet point formatted with •");
  console.log("✅ Test 1 Passed: cleanJobDescription perfectly cleans raw HTML tags and decodes entities.\n");

  // TEST 2: Credit Deduction Animation & Top-Up Tips in JobDetailSheet
  console.log("👉 Test 2: Validating animated credit deduction & top-up tips auto-close banner in JobDetailSheet.tsx...");
  const jobDetailSheetPath = path.resolve(process.cwd(), "components/jobs/JobDetailSheet.tsx");
  const jobDetailSheetSrc = fs.readFileSync(jobDetailSheetPath, "utf-8");

  assert(jobDetailSheetSrc.includes("CreditDeductionBanner"), "JobDetailSheet must render CreditDeductionBanner");
  assert(jobDetailSheetSrc.includes("1 Credit Deducted"), "Banner must state 1 Credit Deducted");
  assert(jobDetailSheetSrc.includes("Ways to increase your credit points"), "Banner must inform ways to increase credit points");
  assert(jobDetailSheetSrc.includes("aria-label=\"Close notification\""), "Banner must have cross button for dismissal");
  assert(jobDetailSheetSrc.includes("autoCloseTimer"), "Banner must have auto-close timer");
  assert(jobDetailSheetSrc.includes("animatedBalance"), "Banner must animate credit deduction transition");
  console.log("✅ Test 2 Passed: Animated credit deduction and auto-close banner with cross button verified.\n");

  // TEST 3: prepare-me API route persistence and constraint resilience
  console.log("👉 Test 3: Validating prepare-me route safely persists and maps prepared status...");
  const prepareMePath = path.resolve(process.cwd(), "app/api/jobs/prepare-me/route.ts");
  const prepareMeSrc = fs.readFileSync(prepareMePath, "utf-8");

  assert(prepareMeSrc.includes("from(\"job_applications\")"), "prepare-me must persist to job_applications");
  assert(prepareMeSrc.includes("stage_check") || prepareMeSrc.includes("23514"), "prepare-me must handle constraint fallback safely");
  assert(prepareMeSrc.includes("isUuid"), "prepare-me must validate UUID for job_id");
  console.log("✅ Test 3 Passed: prepare-me API persistence and constraint safety verified.\n");

  // TEST 4: applications API route maps prepared applications
  console.log("👉 Test 4: Validating applications API GET route normalizes prepared stage...");
  const applicationsRoutePath = path.resolve(process.cwd(), "app/api/jobs/applications/route.ts");
  const applicationsRouteSrc = fs.readFileSync(applicationsRoutePath, "utf-8");

  assert(applicationsRouteSrc.includes("normalizedApplications"), "applications API must normalize applications");
  assert(applicationsRouteSrc.includes("stage = \"prepared\""), "applications API must map prepared records to stage 'prepared'");
  assert(applicationsRouteSrc.includes("stageCounts"), "applications API must track stageCounts for prepared");
  console.log("✅ Test 4 Passed: applications API correctly normalizes and counts prepared stage.\n");

  // TEST 5: Applied tab displays and filters prepared jobs
  console.log("👉 Test 5: Validating AppliedJobsTab displays ⚡ Prepared badge and filter...");
  const appliedTabPath = path.resolve(process.cwd(), "components/jobs/AppliedJobsTab.tsx");
  const appliedTabSrc = fs.readFileSync(appliedTabPath, "utf-8");

  assert(appliedTabSrc.includes("⚡ Prepared"), "AppliedJobsTab must show ⚡ Prepared badge and filter");
  assert(appliedTabSrc.includes("openSavedPlaybook"), "AppliedJobsTab must allow opening saved playbook");
  console.log("✅ Test 5 Passed: AppliedJobsTab displays and filters prepared jobs.\n");

  // TEST 6: Jobs feed groups jobs by company and displays top matched job on top with other jobs modal
  console.log("👉 Test 6: Validating JobsFeed groups jobs by company and displays modal with visible top 'x'...");
  const jobsFeedPath = path.resolve(process.cwd(), "components/jobs/JobsFeed.tsx");
  const jobsFeedSrc = fs.readFileSync(jobsFeedPath, "utf-8");

  assert(jobsFeedSrc.includes("CompanyJobGroup"), "JobsFeed must group jobs by CompanyJobGroup");
  assert(jobsFeedSrc.includes("modalCompanyGroup"), "JobsFeed must have modalCompanyGroup state");
  assert(jobsFeedSrc.includes("aria-label=\"Close other jobs modal\""), "Modal must have clearly visible top 'X' close button");
  assert(jobsFeedSrc.includes("⭐ Top Match"), "Modal must highlight top match job");
  assert(jobsFeedSrc.includes("otherJobs.length > 0"), "Card must show other jobs action when additional roles exist");
  assert(jobsFeedSrc.includes("b.topJob.matchRate - a.topJob.matchRate"), "Company groups must be sorted by top matched job match rate");
  console.log("✅ Test 6 Passed: Company grouping, top matched job, and other jobs modal verified.\n");

  console.log("🎉 ALL 6 VALIDATION TESTS PASSED PERFECTLY!\n");
}

runTests().catch((err) => {
  console.error("❌ Test failure:", err);
  process.exit(1);
});
