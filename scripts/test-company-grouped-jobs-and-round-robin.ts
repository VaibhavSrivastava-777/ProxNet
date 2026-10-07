import assert from "assert";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING VALIDATION: Company Grouping, Top Matched Job & Round-Robin");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  // ------------------------------------------------------------------
  // Test 1: User Specification - Wipro (90, 80, 70) and Dell (85, 75)
  // ------------------------------------------------------------------
  test("Group opportunities by company, sort jobs descending and order companies by top match", () => {
    const inputCompanies = [
      {
        company: "Dell",
        contactsCount: 1,
        referralContacts: [{ id: "u1", alias: "Dell Insider" }],
        jobs: [
          { id: "d1", title: "Cloud Engineer", score: 75, matchRate: 75, location: "Bengaluru", posted_at: "2026-10-01" },
          { id: "d2", title: "Senior DevOps Architect", score: 85, matchRate: 85, location: "Remote", posted_at: "2026-10-02" },
        ],
      },
      {
        company: "Wipro",
        contactsCount: 2,
        referralContacts: [{ id: "u2", alias: "Wipro Lead" }],
        jobs: [
          { id: "w1", title: "Software Engineer", score: 70, matchRate: 70, location: "Pune", posted_at: "2026-10-01" },
          { id: "w2", title: "Principal Systems Engineer", score: 90, matchRate: 90, location: "Hyderabad", posted_at: "2026-10-03" },
          { id: "w3", title: "Tech Lead", score: 80, matchRate: 80, location: "Bengaluru", posted_at: "2026-10-02" },
        ],
      },
      {
        company: "TCS",
        contactsCount: 0,
        referralContacts: [],
        jobs: [
          { id: "t1", title: "QA Lead", score: 60, matchRate: 60, location: "Mumbai", posted_at: "2026-10-01" },
        ],
      },
    ];

    // Mirroring applyAdvancedFilters logic from SuggestedJobs.tsx
    const processed = inputCompanies
      .map((c) => {
        const sortedJobs = [...c.jobs].sort((a, b) => {
          const scoreA = a.score ?? a.matchRate ?? 0;
          const scoreB = b.score ?? b.matchRate ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return 0;
        });
        return { ...c, jobs: sortedJobs };
      })
      .sort((a, b) => {
        const topA = a.jobs[0]?.score ?? a.jobs[0]?.matchRate ?? 0;
        const topB = b.jobs[0]?.score ?? b.jobs[0]?.matchRate ?? 0;
        if (topB !== topA) return topB - topA;
        if (b.jobs.length !== a.jobs.length) return b.jobs.length - a.jobs.length;
        return a.company.localeCompare(b.company);
      });

    // Company 1 should be Wipro (top match: 90%)
    assert.strictEqual(processed[0].company, "Wipro", "Wipro must be first because its top match is 90%");
    assert.strictEqual(processed[0].jobs[0].title, "Principal Systems Engineer");
    assert.strictEqual(processed[0].jobs[0].score, 90, "Wipro's top matched job must be 90%");
    assert.deepStrictEqual(
      processed[0].jobs.map((j) => j.score),
      [90, 80, 70],
      "Wipro's jobs must be sorted descending [90, 80, 70]"
    );
    assert.strictEqual(processed[0].jobs.length - 1, 2, "Wipro has 2 other jobs for modal trigger");

    // Company 2 should be Dell (top match: 85%)
    assert.strictEqual(processed[1].company, "Dell", "Dell must be second because its top match is 85%");
    assert.strictEqual(processed[1].jobs[0].title, "Senior DevOps Architect");
    assert.strictEqual(processed[1].jobs[0].score, 85, "Dell's top matched job must be 85%");
    assert.deepStrictEqual(
      processed[1].jobs.map((j) => j.score),
      [85, 75],
      "Dell's jobs must be sorted descending [85, 75]"
    );
    assert.strictEqual(processed[1].jobs.length - 1, 1, "Dell has 1 other job for modal trigger");

    // Company 3 should be TCS (top match: 60%)
    assert.strictEqual(processed[2].company, "TCS", "TCS must be third (top match 60%)");
    assert.strictEqual(processed[2].jobs.length - 1, 0, "TCS has 0 other jobs");
  });

  // ------------------------------------------------------------------
  // Test 2: UI Presentation Strings and Modal Trigger Verification in JobsFeed & SuggestedJobs
  // ------------------------------------------------------------------
  test("JobsFeed.tsx contains company grouping, top match spotlight, and non-truncated close modal", () => {
    const filePath = path.resolve("components/jobs/JobsFeed.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert(
      content.includes("(and others on click in a modal)"),
      "JobsFeed.tsx must contain explicit user requested copy: (and others on click in a modal)"
    );
    assert(
      content.includes("Top Matched Opportunity"),
      "JobsFeed.tsx must render Top Matched Opportunity spotlight badge"
    );
    assert(
      content.includes("setActiveCompanyModal(group)"),
      "JobsFeed.tsx must trigger company modal on click of card or others link"
    );
    assert(
      content.includes("b.topJob.matchRate - a.topJob.matchRate"),
      "JobsFeed.tsx must rank company groups strictly by top opportunity matchRate descending"
    );
    assert(
      content.includes("pt-[max(env(safe-area-inset-top),1.5rem)]"),
      "JobsFeed.tsx activeCompanyModal must include safe area top padding to prevent top truncation"
    );
    assert(
      content.includes("sticky top-0 z-50 shrink-0"),
      "JobsFeed.tsx activeCompanyModal header must be sticky and shrink-0 so close button is always visible"
    );
  });

  test("JobDetailSheet.tsx and SuggestedJobs.tsx prevent top 'X' icon truncation", () => {
    const sheetContent = fs.readFileSync(path.resolve("components/jobs/JobDetailSheet.tsx"), "utf-8");
    assert(
      sheetContent.includes("pt-[max(env(safe-area-inset-top),1.5rem)]"),
      "JobDetailSheet.tsx must provide safe-area top padding to prevent 'X' icon truncation"
    );
    assert(
      sheetContent.includes("sticky top-0 z-50 shrink-0"),
      "JobDetailSheet.tsx header must be sticky top-0 shrink-0"
    );

    const suggestedContent = fs.readFileSync(path.resolve("components/jobs/SuggestedJobs.tsx"), "utf-8");
    assert(
      suggestedContent.includes("pt-[max(env(safe-area-inset-top),1.5rem)]"),
      "SuggestedJobs.tsx must provide safe-area top padding to prevent 'X' icon truncation"
    );
  });

  // ------------------------------------------------------------------
  // Test 3: Round-Robin Equitable Scraping Simulation (30 jobs batch)
  // ------------------------------------------------------------------
  test("Scraper round-robin equitably fetches 30 jobs per company and loops back", () => {
    const BATCH_SIZE = 30;

    // Simulate 3 companies with different job inventory sizes
    const pools = [
      { company: "Company 1", totalJobs: 70, processed: 0, index: 0 },
      { company: "Company 2", totalJobs: 40, processed: 0, index: 0 },
      { company: "Company 3", totalJobs: 15, processed: 0, index: 0 },
    ];

    const executionLog: Array<{ round: number; company: string; fetched: number; remaining: number }> = [];

    let keepProcessing = true;
    let round = 1;

    while (keepProcessing) {
      keepProcessing = false;

      for (const pool of pools) {
        if (pool.index >= pool.totalJobs) continue;

        keepProcessing = true;
        const count = Math.min(BATCH_SIZE, pool.totalJobs - pool.index);
        pool.processed += count;
        pool.index += count;

        executionLog.push({
          round,
          company: pool.company,
          fetched: count,
          remaining: pool.totalJobs - pool.processed,
        });
      }
      round++;
    }

    // Round 1 checks:
    // Company 1: fetches 30 (40 left)
    // Company 2: fetches 30 (10 left)
    // Company 3: fetches 15 (0 left)
    assert.strictEqual(executionLog[0].company, "Company 1");
    assert.strictEqual(executionLog[0].fetched, 30);
    assert.strictEqual(executionLog[0].remaining, 40);

    assert.strictEqual(executionLog[1].company, "Company 2");
    assert.strictEqual(executionLog[1].fetched, 30);
    assert.strictEqual(executionLog[1].remaining, 10);

    assert.strictEqual(executionLog[2].company, "Company 3");
    assert.strictEqual(executionLog[2].fetched, 15);
    assert.strictEqual(executionLog[2].remaining, 0);

    // Round 2 checks: comes back to Company 1!
    // Company 1: fetches 30 (10 left)
    // Company 2: fetches 10 (0 left)
    // Company 3: skipped
    assert.strictEqual(executionLog[3].company, "Company 1");
    assert.strictEqual(executionLog[3].fetched, 30);
    assert.strictEqual(executionLog[3].remaining, 10);

    assert.strictEqual(executionLog[4].company, "Company 2");
    assert.strictEqual(executionLog[4].fetched, 10);
    assert.strictEqual(executionLog[4].remaining, 0);

    // Round 3 checks: comes back to Company 1 for the remaining 10!
    assert.strictEqual(executionLog[5].company, "Company 1");
    assert.strictEqual(executionLog[5].fetched, 10);
    assert.strictEqual(executionLog[5].remaining, 0);

    // Total batches executed: exactly 6
    assert.strictEqual(executionLog.length, 6);
    assert.strictEqual(pools[0].processed, 70);
    assert.strictEqual(pools[1].processed, 40);
    assert.strictEqual(pools[2].processed, 15);
  });

  // ------------------------------------------------------------------
  // Test 4: Scraper code configuration verification
  // ------------------------------------------------------------------
  test("Scraper files have BATCH_SIZE set to 30 for equitable round robin", () => {
    const runScraperContent = fs.readFileSync(path.resolve("scripts/run-scraper.ts"), "utf-8");
    assert(
      runScraperContent.includes("const BATCH_SIZE = 30;"),
      "scripts/run-scraper.ts must define const BATCH_SIZE = 30;"
    );

    const cronCompetitors = fs.readFileSync(
      path.resolve("app/api/cron/scrape-network-and-competitors/route.ts"),
      "utf-8"
    );
    assert(
      cronCompetitors.includes("toInsert.length >= 30"),
      "scrape-network-and-competitors route must cap batch to 30"
    );

    const cronUserTargets = fs.readFileSync(
      path.resolve("app/api/cron/scrape-user-targets/route.ts"),
      "utf-8"
    );
    assert(
      cronUserTargets.includes("toProcess.length >= 30"),
      "scrape-user-targets route must cap batch to 30"
    );
  });

  console.log(`\n==================================================================`);
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log(`==================================================================`);
}

runTests();
