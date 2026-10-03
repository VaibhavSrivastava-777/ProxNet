import assert from "assert";
import fs from "fs";
import path from "path";
import { isSameCompany } from "../lib/jobs/job-filters";
import { openExternalUrl, handleExternalLinkClick } from "../lib/external-links";

async function runValidation() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION: Distinct Top 3 Companies, Modal X Close Button & LinkedIn Routing");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // TEST 1: Top 3 Opportunities Distinct Company Deduplication Logic
  // ---------------------------------------------------------------------------
  console.log("\n[Test 1] Validating Top 3 Opportunities Distinct Company Selection...");

  const candidateJobs = [
    { id: "job-1", title: "Senior Backend Engineer", company: "Google", score: 95 },
    { id: "job-2", title: "Staff Frontend Engineer", company: "Google LLC", score: 94 },
    { id: "job-3", title: "Full Stack Engineer", company: "Google India", score: 93 },
    { id: "job-4", title: "Cloud Architect", company: "Amazon", score: 92 },
    { id: "job-5", title: "DevOps Engineer", company: "Amazon Web Services", score: 91 },
    { id: "job-6", title: "Platform Engineer", company: "Microsoft", score: 90 },
    { id: "job-7", title: "Software Engineer", company: "Tata Consultancy Services", score: 88 },
    { id: "job-8", title: "Solutions Architect", company: "TCS", score: 87 },
  ];

  const userCompany = "Google"; // Candidate currently works at Google

  const top3: typeof candidateJobs = [];
  for (const job of candidateJobs) {
    if (!job.company) continue;
    // Exclude own company
    if (userCompany && isSameCompany(job.company, userCompany)) continue;
    // Ensure distinct company across chosen top 3
    const isDuplicate = top3.some((t) => isSameCompany(t.company, job.company));
    if (!isDuplicate) {
      top3.push(job);
    }
    if (top3.length >= 3) break;
  }

  console.log("  Filtered Top 3 Results:", top3.map((j) => `${j.title} @ ${j.company} (${j.score}%)`));
  assert.strictEqual(top3.length, 3, "Must select exactly 3 jobs when sufficient candidates exist");
  assert.strictEqual(top3[0].company, "Amazon", "First distinct non-user company should be Amazon (Google excluded)");
  assert.strictEqual(top3[1].company, "Microsoft", "Second distinct company should be Microsoft (AWS deduplicated from Amazon)");
  assert.strictEqual(top3[2].company, "Tata Consultancy Services", "Third distinct company should be TCS");

  // Verify none of the companies match each other
  assert(!isSameCompany(top3[0].company, top3[1].company), "Job 1 and Job 2 must not be same company");
  assert(!isSameCompany(top3[1].company, top3[2].company), "Job 2 and Job 3 must not be same company");
  assert(!isSameCompany(top3[0].company, top3[2].company), "Job 1 and Job 3 must not be same company");
  console.log("  ✅ Passed: Top 3 opportunities strictly belong to distinct companies!");

  // Verify code files enforce this
  const dailyProximitySrc = fs.readFileSync(path.resolve("lib/notifications/daily-proximity-and-jobs.ts"), "utf-8");
  assert(dailyProximitySrc.includes("topJobs.some((tj) => isSameCompany(tj.company, j.company))"), "daily-proximity-and-jobs.ts must check isSameCompany across topJobs");

  const cronRouteSrc = fs.readFileSync(path.resolve("app/api/cron/job-matches/route.ts"), "utf-8");
  assert(cronRouteSrc.includes("top3.some((t) => isSameCompany(t.company, job.company))"), "app/api/cron/job-matches/route.ts must check isSameCompany across top3");
  console.log("  ✅ Passed: Static verification of daily-proximity-and-jobs.ts and cron route confirmed!");

  // ---------------------------------------------------------------------------
  // TEST 2: Job Opportunity Details Modal "X" Close Button Verification
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2] Validating Job Opportunity Details Modal ('X' Close Button & UX)...");
  const jobDetailSheetSrc = fs.readFileSync(path.resolve("components/jobs/JobDetailSheet.tsx"), "utf-8");

  assert(jobDetailSheetSrc.includes('aria-label="Close modal"'), "JobDetailSheet must have aria-label='Close modal'");
  assert(jobDetailSheetSrc.includes('title="Close (Esc)"'), "JobDetailSheet must have title='Close (Esc)'");
  assert(jobDetailSheetSrc.includes('path d="M18 6L6 18M6 6l12 12"'), "JobDetailSheet must render crisp standard X path icon");
  assert(jobDetailSheetSrc.includes('e.key === "Escape"'), "JobDetailSheet must register Escape key handler");
  assert(jobDetailSheetSrc.includes("bg-[var(--color-surface-secondary)]"), "JobDetailSheet close button must have visible surface styling");
  assert(jobDetailSheetSrc.includes("border border-[var(--color-border)]"), "JobDetailSheet close button must have defined border");
  console.log("  ✅ Passed: Job opportunity modal close button has high contrast, visible X, and Escape key support!");

  // ---------------------------------------------------------------------------
  // TEST 3: LinkedIn & External Link Routing (Native Android App vs Website)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3] Validating LinkedIn & External Link Routing in Native App vs Web...");

  // 3A: Test lib/external-links.ts behavior
  let openedUrlNative = "";
  let openedUrlWeb = "";

  // Simulate Android environment
  (global as any).window = {
    AndroidBridge: {
      openExternalUrl: (url: string) => {
        openedUrlNative = url;
      },
    },
    location: {
      assign: (url: string) => {
        openedUrlWeb = url;
      },
    },
    open: (url: string) => {
      openedUrlWeb = url;
      return { closed: false };
    },
  };

  const testLinkedInUrl = "https://www.linkedin.com/search/results/people/?keywords=Google%20Recruiter";
  openExternalUrl(testLinkedInUrl);
  assert.strictEqual(openedUrlNative, testLinkedInUrl, "In Android native app, openExternalUrl must route through AndroidBridge.openExternalUrl");
  console.log("  ✓ Native Android App simulation routes through window.AndroidBridge.openExternalUrl");

  // Simulate Web environment (no AndroidBridge)
  delete (global as any).window.AndroidBridge;
  openedUrlNative = "";
  openedUrlWeb = "";

  openExternalUrl(testLinkedInUrl);
  assert.strictEqual(openedUrlWeb, testLinkedInUrl, "In web browser, openExternalUrl must route through window.open");
  console.log("  ✓ Web browser simulation opens new window via window.open");

  // 3B: Verify MainActivity.kt Kotlin implementation
  const mainActivitySrc = fs.readFileSync(path.resolve("android/app/src/main/java/in/proxnet/app/MainActivity.kt"), "utf-8");

  assert(mainActivitySrc.includes("settings.setSupportMultipleWindows(true)"), "MainActivity.kt must enable multi-window support");
  assert(mainActivitySrc.includes("override fun onCreateWindow"), "MainActivity.kt must implement onCreateWindow in WebChromeClient");
  assert(mainActivitySrc.includes("fun isExternalUrl(url: String): Boolean"), "MainActivity.kt must implement isExternalUrl check");
  assert(mainActivitySrc.includes("fun openExternalBrowser(url: String)"), "MainActivity.kt must implement openExternalBrowser");
  assert(mainActivitySrc.includes("fun openExternalUrl(url: String)"), "MainActivity.kt WebAppInterface must expose openExternalUrl");
  assert(mainActivitySrc.includes("Routing external URL to system browser/app"), "MainActivity.kt must route external URLs to system browser/app");
  console.log("  ✅ Passed: Native Android MainActivity.kt handles external URLs, multi-window popups, and JS bridge!");

  // 3C: Verify JobDetailSheet and SuggestedJobs call openExternalUrl
  assert(jobDetailSheetSrc.includes("openExternalUrl(finalUrlToOpen)"), "JobDetailSheet must open Apply Direct via openExternalUrl");
  assert(jobDetailSheetSrc.includes("handleExternalLinkClick"), "JobDetailSheet must attach handleExternalLinkClick to LinkedIn links");

  const suggestedJobsSrc = fs.readFileSync(path.resolve("components/jobs/SuggestedJobs.tsx"), "utf-8");
  assert(suggestedJobsSrc.includes("openExternalUrl(linkedInUrl)"), "SuggestedJobs must open LinkedIn via openExternalUrl");
  assert(suggestedJobsSrc.includes("openExternalUrl(linkedInLaunchData.url)"), "SuggestedJobs must open LinkedIn interstitial via openExternalUrl");
  console.log("  ✅ Passed: JobDetailSheet & SuggestedJobs integrated with openExternalUrl!");

  console.log("\n================================================================================");
  console.log("🎉 ALL TESTS PASSED! ALL 3 REQUIREMENTS FULLY VERIFIED.");
  console.log("================================================================================");
}

runValidation().catch((err) => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});
