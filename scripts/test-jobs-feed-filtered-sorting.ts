import assert from "assert";
import fs from "fs";
import path from "path";

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  raw_posted_at?: string;
  matchRate: number;
  keywords?: string[];
}

interface CompanyJobGroup {
  company: string;
  topJob: JobItem;
  otherJobs: JobItem[];
  allJobs: JobItem[];
  totalJobsCount: number;
  contactsCount: number;
}

function sortCompanyGroups(groups: CompanyJobGroup[]): CompanyJobGroup[] {
  return groups.sort((a, b) => {
    const topDiff = b.topJob.matchRate - a.topJob.matchRate;
    if (topDiff !== 0) return topDiff;
    if (b.totalJobsCount !== a.totalJobsCount) return b.totalJobsCount - a.totalJobsCount;
    return a.company.localeCompare(b.company);
  });
}

function filterAndSortCompanyGroups(
  allGroups: CompanyJobGroup[],
  filterFn: (j: JobItem) => boolean
): CompanyJobGroup[] {
  const filteredGroups = allGroups
    .map((g) => {
      const matchedJobs = g.allJobs.filter(filterFn);
      if (matchedJobs.length === 0) return null;

      matchedJobs.sort((a, b) => {
        const matchDiff = b.matchRate - a.matchRate;
        if (matchDiff !== 0) return matchDiff;
        const dateA = a.raw_posted_at ? new Date(a.raw_posted_at).getTime() : 0;
        const dateB = b.raw_posted_at ? new Date(b.raw_posted_at).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return a.title.localeCompare(b.title);
      });

      return {
        ...g,
        topJob: matchedJobs[0],
        otherJobs: matchedJobs.slice(1),
        allJobs: matchedJobs,
        totalJobsCount: matchedJobs.length,
      };
    })
    .filter(Boolean) as CompanyJobGroup[];

  return sortCompanyGroups(filteredGroups);
}

async function runValidationTests() {
  console.log("==================================================================");
  console.log("🧪 VALIDATION TEST: Jobs Feed Filtered Sorting Consistency");
  console.log("==================================================================\n");

  const cwd = process.cwd();

  // TEST 1: Static code verification in JobsFeed.tsx
  console.log("[Test 1] Verifying JobsFeed.tsx static code has sorting in filteredCompanyGroups...");
  const jobsFeedPath = path.join(cwd, "components/jobs/JobsFeed.tsx");
  const jobsFeedContent = fs.readFileSync(jobsFeedPath, "utf-8");

  assert(
    jobsFeedContent.includes("matchedJobs.sort("),
    "JobsFeed must sort matchedJobs within each company descending by matchRate"
  );
  assert(
    jobsFeedContent.includes("filteredGroups.sort("),
    "JobsFeed must sort filteredGroups descending by topJob.matchRate"
  );
  assert(
    jobsFeedContent.includes("b.topJob.matchRate - a.topJob.matchRate"),
    "JobsFeed must use b.topJob.matchRate - a.topJob.matchRate for ranking filtered company groups"
  );
  console.log("✅ Passed: JobsFeed.tsx contains both matchedJobs and filteredGroups descending sorting.\n");

  // TEST 2: Functional simulation of filter sorting behavior
  console.log("[Test 2] Functional simulation: Unsorted filter vs Sorted filter verification...");

  // Mock initial groups (sorted in default state)
  const companyA: CompanyJobGroup = {
    company: "Acme Corp",
    topJob: {
      id: "a1",
      title: "Senior Fullstack Engineer",
      company: "Acme Corp",
      location: "Bengaluru",
      url: "https://acme.com/job1",
      description: "React Node AWS",
      posted_at: "1d ago",
      matchRate: 95,
      keywords: ["React", "AWS"],
    },
    otherJobs: [
      {
        id: "a2",
        title: "Operations Associate",
        company: "Acme Corp",
        location: "Mumbai",
        url: "https://acme.com/job2",
        description: "Logistics ops",
        posted_at: "2d ago",
        matchRate: 55,
        keywords: ["Operations"],
      },
    ],
    allJobs: [],
    totalJobsCount: 2,
    contactsCount: 1,
  };
  companyA.allJobs = [companyA.topJob, ...companyA.otherJobs];

  const companyB: CompanyJobGroup = {
    company: "Beta Tech",
    topJob: {
      id: "b1",
      title: "Product Manager",
      company: "Beta Tech",
      location: "Mumbai",
      url: "https://beta.com/job1",
      description: "Product strategy",
      posted_at: "1d ago",
      matchRate: 88,
      keywords: ["Product Management"],
    },
    otherJobs: [],
    allJobs: [],
    totalJobsCount: 1,
    contactsCount: 2,
  };
  companyB.allJobs = [companyB.topJob];

  const companyC: CompanyJobGroup = {
    company: "Cyber Dynamics",
    topJob: {
      id: "c1",
      title: "Data Analyst",
      company: "Cyber Dynamics",
      location: "Mumbai",
      url: "https://cyber.com/job1",
      description: "SQL Python Analytics",
      posted_at: "3d ago",
      matchRate: 72,
      keywords: ["SQL", "Analytics"],
    },
    otherJobs: [],
    allJobs: [],
    totalJobsCount: 1,
    contactsCount: 0,
  };
  companyC.allJobs = [companyC.topJob];

  // Default state: sorted descending by topJob.matchRate: Acme (95) -> Beta (88) -> Cyber (72)
  const defaultGroups = sortCompanyGroups([companyB, companyA, companyC]);
  assert.strictEqual(defaultGroups[0].company, "Acme Corp");
  assert.strictEqual(defaultGroups[0].topJob.matchRate, 95);
  assert.strictEqual(defaultGroups[1].company, "Beta Tech");
  assert.strictEqual(defaultGroups[1].topJob.matchRate, 88);
  assert.strictEqual(defaultGroups[2].company, "Cyber Dynamics");
  assert.strictEqual(defaultGroups[2].topJob.matchRate, 72);
  console.log("  ✓ Default state correctly ordered: Acme (95%) -> Beta (88%) -> Cyber (72%)");

  // Filter for location = "Mumbai"
  const filteredMumbai = filterAndSortCompanyGroups(defaultGroups, (j) =>
    j.location.toLowerCase().includes("mumbai")
  );

  // In Mumbai:
  // Acme has only Job 2 (55% match)
  // Beta has Job 1 (88% match)
  // Cyber has Job 1 (72% match)
  assert.strictEqual(filteredMumbai.length, 3);
  assert.strictEqual(
    filteredMumbai[0].company,
    "Beta Tech",
    "Beta Tech must be 1st because 88% is highest in Mumbai"
  );
  assert.strictEqual(filteredMumbai[0].topJob.matchRate, 88);

  assert.strictEqual(
    filteredMumbai[1].company,
    "Cyber Dynamics",
    "Cyber Dynamics must be 2nd because 72% > 55%"
  );
  assert.strictEqual(filteredMumbai[1].topJob.matchRate, 72);

  assert.strictEqual(
    filteredMumbai[2].company,
    "Acme Corp",
    "Acme Corp must drop to 3rd because its top Mumbai job is 55%"
  );
  assert.strictEqual(filteredMumbai[2].topJob.matchRate, 55);

  // Assert strict descending monotonic order
  for (let i = 0; i < filteredMumbai.length - 1; i++) {
    assert(
      filteredMumbai[i].topJob.matchRate >= filteredMumbai[i + 1].topJob.matchRate,
      `Order violation: ${filteredMumbai[i].topJob.matchRate} < ${filteredMumbai[i + 1].topJob.matchRate}`
    );
  }
  console.log("  ✓ Filtered state correctly re-sorted: Beta (88%) -> Cyber (72%) -> Acme (55%)");

  // TEST 3: Multi-role company internal sort preservation
  console.log("\n[Test 3] Verifying jobs within a company remain sorted descending by match fit...");
  const companyMulti: CompanyJobGroup = {
    company: "Omni Global",
    topJob: { id: "m1", title: "Dev 1", company: "Omni Global", location: "Pune", url: "", description: "", posted_at: "", matchRate: 90 },
    otherJobs: [
      { id: "m2", title: "Dev 2", company: "Omni Global", location: "Pune", url: "", description: "", posted_at: "", matchRate: 60 },
      { id: "m3", title: "Dev 3", company: "Omni Global", location: "Pune", url: "", description: "", posted_at: "", matchRate: 85 },
    ],
    allJobs: [],
    totalJobsCount: 3,
    contactsCount: 0,
  };
  companyMulti.allJobs = [companyMulti.topJob, ...companyMulti.otherJobs];

  const filteredMulti = filterAndSortCompanyGroups([companyMulti], (j) => j.location === "Pune");
  assert.strictEqual(filteredMulti[0].allJobs[0].matchRate, 90);
  assert.strictEqual(filteredMulti[0].allJobs[1].matchRate, 85);
  assert.strictEqual(filteredMulti[0].allJobs[2].matchRate, 60);
  console.log("  ✓ Internal jobs sorted: 90% -> 85% -> 60%");

  console.log("\n==================================================================");
  console.log("🎉 ALL SORT VALIDATION TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================================\n");
}

runValidationTests().catch((err) => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});
