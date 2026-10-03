import assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  isIndiaLocation,
  hasForeignTitleIndicators,
  isJobEligible,
} from "../lib/jobs/job-filters";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 VALIDATION TEST: India-Only Job Filtering & Foreign Exclusion");
  console.log("==================================================================");

  // [Test 1] Title & Subject foreign indicator detection
  console.log("\n[Test 1] Testing hasForeignTitleIndicators with US & foreign subjects...");
  assert.strictEqual(
    hasForeignTitleIndicators("DEVELOPER L3 (Tampa, USA-FL, US, 33634)"),
    true,
    "Should detect USA-FL in title"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("Account Executive – US"),
    true,
    "Should detect en-dash US suffix in title"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("Senior Account Executive - Atlanta"),
    true,
    "Should detect US city Atlanta in title"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("Managing Consultant (Columbus, USA-IN, US, 8022)"),
    true,
    "Should detect USA-IN and US in title"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("Sr. Manager L1 (Melbourne, AUS-VIC, AU)"),
    true,
    "Should detect AUS-VIC in title"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("Senior Partner - Europe Head of AI Advisory (London, GBR-37, GB)"),
    true,
    "Should detect London / GBR-37 in title"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("CTO - Strategy Consultant (Bengaluru, IND-29, IN, 560035)"),
    false,
    "Should NOT flag Indian city Bengaluru or IND-29 as foreign"
  );
  assert.strictEqual(
    hasForeignTitleIndicators("Software Engineer - Backend (Python / Django)"),
    false,
    "Should NOT flag clean technical titles"
  );
  console.log("✅ Passed: hasForeignTitleIndicators correctly identifies foreign titles and protects Indian hubs.");

  // [Test 2] isIndiaLocation comprehensive testing
  console.log("\n[Test 2] Testing isIndiaLocation with location, description, and title...");
  assert.strictEqual(
    isIndiaLocation("Remote", "We are hiring across the globe", "DEVELOPER L3 (Tampa, USA-FL, US, 33634)"),
    false,
    "Should disqualify foreign title even if location says Remote"
  );
  assert.strictEqual(
    isIndiaLocation("Noida", "Tech company hiring sales", "Account Executive – US"),
    false,
    "Should disqualify US-market title even if location mentions Noida"
  );
  assert.strictEqual(
    isIndiaLocation("Atlanta, GA (Remote)", "Great position in Atlanta", "Senior Account Executive"),
    false,
    "Should disqualify US state in location (Atlanta, GA)"
  );
  assert.strictEqual(
    isIndiaLocation("Remote", "Candidate must be located in the United States and have US work authorization", "Full Stack Engineer"),
    false,
    "Should disqualify US-only remote descriptions"
  );
  assert.strictEqual(
    isIndiaLocation("Bangalore, IN", "Senior software role in Bangalore tech center", "Process Delivery Specialist"),
    true,
    "Should keep Bangalore, IN as Indian hub"
  );
  assert.strictEqual(
    isIndiaLocation("Hyderabad", "Engineering position", "Software Development Engineer - AI Tools"),
    true,
    "Should keep Hyderabad as India hub"
  );
  assert.strictEqual(
    isIndiaLocation("Remote - India", "Remote position within India", "Application Security Engineer"),
    true,
    "Should keep Remote - India as India hub"
  );
  assert.strictEqual(
    isIndiaLocation("Pune, India", "Backend role", "Senior Java Developer"),
    true,
    "Should keep Pune, India as India hub"
  );
  console.log("✅ Passed: isIndiaLocation strictly filters out foreign jobs and preserves India opportunities.");

  // [Test 3] isJobEligible integration
  console.log("\n[Test 3] Testing isJobEligible integration with title passing...");
  const foreignEligible = isJobEligible({
    title: "DEVELOPER L3 (Tampa, USA-FL, US, 33634)",
    location: "Remote",
    description: "General developer role",
    posted_at: new Date().toISOString(),
    url: "https://careers.example.com/job/123",
  });
  assert.strictEqual(foreignEligible.eligible, false, "isJobEligible must reject USA title with Remote location");

  const indiaEligible = isJobEligible({
    title: "Senior Backend Engineer",
    location: "Bengaluru, Karnataka",
    description: "5+ years experience building scalable microservices",
    posted_at: new Date().toISOString(),
    url: "https://careers.example.com/job/456",
  });
  assert.strictEqual(indiaEligible.eligible, true, "isJobEligible must accept valid India job");
  console.log("✅ Passed: isJobEligible correctly passes title to isIndiaLocation.");

  // [Test 4] Verify /api/jobs/all route incorporates isIndiaLocation
  console.log("\n[Test 4] Verifying /api/jobs/all route contains isIndiaLocation check...");
  const jobsAllPath = join(process.cwd(), "app", "api", "jobs", "all", "route.ts");
  const jobsAllCode = readFileSync(jobsAllPath, "utf-8");
  assert(
    jobsAllCode.includes("isIndiaLocation(job.location, job.description, job.title)"),
    "app/api/jobs/all/route.ts must filter by isIndiaLocation with title"
  );
  console.log("✅ Passed: /api/jobs/all verifies India location with title for every cached job.");

  // [Test 5] Verify JobsFeed client component incorporates isIndiaLocation
  console.log("\n[Test 5] Verifying JobsFeed client component contains isIndiaLocation safety filter...");
  const jobsFeedPath = join(process.cwd(), "components", "jobs", "JobsFeed.tsx");
  const jobsFeedCode = readFileSync(jobsFeedPath, "utf-8");
  assert(
    jobsFeedCode.includes("isIndiaLocation(j.location, j.description, j.title)"),
    "components/jobs/JobsFeed.tsx must filter by isIndiaLocation with title"
  );
  console.log("✅ Passed: JobsFeed contains client-side isIndiaLocation guard.");

  // [Test 6] Verify cron and morning notifications incorporate isIndiaLocation
  console.log("\n[Test 6] Verifying cron job matches & morning notifications filter by isIndiaLocation...");
  const jobMatchesCronPath = join(process.cwd(), "app", "api", "cron", "job-matches", "route.ts");
  const jobMatchesCronCode = readFileSync(jobMatchesCronPath, "utf-8");
  assert(
    jobMatchesCronCode.includes("isIndiaLocation(job.location, job.description, job.title)"),
    "app/api/cron/job-matches/route.ts must filter candidate jobs with isIndiaLocation"
  );

  const dailyDigestPath = join(process.cwd(), "lib", "notifications", "daily-proximity-and-jobs.ts");
  const dailyDigestCode = readFileSync(dailyDigestPath, "utf-8");
  assert(
    dailyDigestCode.includes("isIndiaLocation(j.location, j.description, j.title)"),
    "lib/notifications/daily-proximity-and-jobs.ts must filter candidate jobs with isIndiaLocation"
  );
  console.log("✅ Passed: Both job-matches cron and daily digest notifications strictly enforce isIndiaLocation.");

  console.log("\n==================================================================");
  console.log("🎉 ALL INDIA-ONLY JOB FILTERING TESTS PASSED PERFECTLY!");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
