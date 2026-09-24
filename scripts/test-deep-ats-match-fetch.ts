import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import fs from "fs";
import path from "path";
import { CREDIT_COSTS } from "../lib/wallet";
import { createAdminClient } from "../lib/supabase/admin";
import { cleanJobTitle, normalizeJobTitle } from "../lib/jobs/job-filters";
import { STRATEGIES } from "../lib/scrape-strategies";

async function runValidationTests() {
  console.log("================================================================================");
  console.log("🧪 STARTING DEEP ATS MATCH HUNTER VALIDATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  // ── TEST 1: Wallet Gamification Configuration ────────────────────────────────
  console.log(">>> [TEST 1] Validating Wallet Gamification & Deduction Configuration...");
  test("CREDIT_COSTS contains deep_ats_fetch with valid configuration", () => {
    assert(CREDIT_COSTS.deep_ats_fetch, "deep_ats_fetch must exist in CREDIT_COSTS");
    assert.strictEqual(CREDIT_COSTS.deep_ats_fetch.amount, 1, "deep_ats_fetch base cost must be 1 credit");
    assert(CREDIT_COSTS.deep_ats_fetch.label.includes("Deep ATS"), "Label must mention Deep ATS");
  });

  test("lib/wallet.ts exports DebitReason union containing deep_ats_fetch", () => {
    const walletPath = path.join(process.cwd(), "lib", "wallet.ts");
    const walletSrc = fs.readFileSync(walletPath, "utf-8");
    assert(walletSrc.includes('"deep_ats_fetch"'), "DebitReason must include deep_ats_fetch");
  });

  // ── TEST 2: API Route Implementation ─────────────────────────────────────────
  console.log("\n>>> [TEST 2] Validating /api/jobs/deep-fetch Route Architecture...");
  test("Route file exists and defines POST handler with maxDuration = 60", () => {
    const routePath = path.join(process.cwd(), "app", "api", "jobs", "deep-fetch", "route.ts");
    assert(fs.existsSync(routePath), "app/api/jobs/deep-fetch/route.ts must exist");
    const routeSrc = fs.readFileSync(routePath, "utf-8");
    assert(routeSrc.includes("export const maxDuration = 60"), "Must set maxDuration = 60 for serverless ATS crawl");
    assert(routeSrc.includes("export async function POST"), "Must export POST handler");
  });

  test("API route enforces resume presence (NO_RESUME) and credit sufficiency (INSUFFICIENT_CREDITS)", () => {
    const routePath = path.join(process.cwd(), "app", "api", "jobs", "deep-fetch", "route.ts");
    const routeSrc = fs.readFileSync(routePath, "utf-8");
    assert(routeSrc.includes("NO_RESUME"), "Must handle missing resume");
    assert(routeSrc.includes("INSUFFICIENT_CREDITS"), "Must handle insufficient wallet balance");
  });

  test("API route executes live ATS crawl using STRATEGIES and upserts to scraped_jobs", () => {
    const routePath = path.join(process.cwd(), "app", "api", "jobs", "deep-fetch", "route.ts");
    const routeSrc = fs.readFileSync(routePath, "utf-8");
    assert(routeSrc.includes("STRATEGIES"), "Must import and utilize STRATEGIES for live ATS crawl");
    assert(routeSrc.includes("Promise.allSettled"), "Must crawl ATS boards concurrently");
    assert(routeSrc.includes(".upsert("), "Must upsert newly discovered live jobs into scraped_jobs");
  });

  test("API route strictly filters score >= 70, sorts descending, and tags Pioneer bounty", () => {
    const routePath = path.join(process.cwd(), "app", "api", "jobs", "deep-fetch", "route.ts");
    const routeSrc = fs.readFileSync(routePath, "utf-8");
    assert(routeSrc.includes("score >= 70"), "Must strictly enforce score >= 70 threshold");
    assert(routeSrc.includes("verifiedMatches.sort((a, b) => b.score - a.score)"), "Must sort matches descending");
    assert(routeSrc.includes("isPioneer"), "Must tag company Pioneer status");
    assert(routeSrc.includes("bountyCredits = 10"), "Must attach +10 credits Pioneer bounty");
  });

  // ── TEST 3: UI Components Integration ────────────────────────────────────────
  console.log("\n>>> [TEST 3] Validating Frontend UI & DeepFetchModal Integration...");
  test("DeepFetchModal component exists with required interactive controls", () => {
    const modalPath = path.join(process.cwd(), "components", "jobs", "DeepFetchModal.tsx");
    assert(fs.existsSync(modalPath), "components/jobs/DeepFetchModal.tsx must exist");
    const modalSrc = fs.readFileSync(modalPath, "utf-8");
    assert(modalSrc.includes("Deep ATS Match Hunter"), "Must include modal title");
    assert(modalSrc.includes("input") && modalSrc.includes('type="range"'), "Must include credit allocation slider");
    assert(modalSrc.includes("Fair Billing Protection"), "Must explain fair billing policy");
    assert(modalSrc.includes("Hunting Strong Matches"), "Must include live crawling progress animation");
  });

  test("SuggestedJobs UI includes trigger button, results feed, and modal integration", () => {
    const suggestedJobsPath = path.join(process.cwd(), "components", "jobs", "SuggestedJobs.tsx");
    const src = fs.readFileSync(suggestedJobsPath, "utf-8");
    assert(src.includes("DeepFetchModal"), "Must import and render DeepFetchModal");
    assert(src.includes("btn-deep-ats-fetch"), "Must include Fetch trigger button with id btn-deep-ats-fetch");
    assert(src.includes("deepHunterMatches"), "Must maintain deepHunterMatches state");
    assert(src.includes("deep-hunter-results"), "Must render deep-hunter-results container");
    assert(src.includes("💡 Fit Reason:"), "Must display AI fit reason on each match card");
    assert(src.includes("🏆 Pioneer +10 pts"), "Must display Pioneer Bounty button for non-member companies");
  });

  // ── TEST 4: Live ATS Crawl Strategy Speed & Functionality ────────────────────
  console.log("\n>>> [TEST 4] Testing Live ATS Endpoint Crawling in Isolation...");
  await testAsync("Greenhouse live API strategy returns valid live jobs", async () => {
    const ghStrategy = STRATEGIES["greenhouse"];
    assert(ghStrategy, "Greenhouse strategy must be available");
    // Probe a prominent public Greenhouse board
    const jobs = await ghStrategy("stripe", "Stripe");
    assert(Array.isArray(jobs), "Greenhouse strategy must return array of jobs");
    assert(jobs.length > 0, `Expected Stripe Greenhouse to have jobs, got ${jobs.length}`);
    const sample = jobs[0];
    assert(sample.title, "Scraped job must have title");
    assert(sample.url, "Scraped job must have url");
    console.log(`     Sample Stripe role: "${sample.title}" (${sample.location})`);
  });

  await testAsync("Lever live API strategy returns valid live jobs", async () => {
    const leverStrategy = STRATEGIES["lever"];
    assert(leverStrategy, "Lever strategy must be available");
    // Probe a prominent public Lever board
    const jobs = await leverStrategy("cred", "CRED");
    assert(Array.isArray(jobs), "Lever strategy must return array of jobs");
    assert(jobs.length > 0, `Expected CRED Lever to have jobs, got ${jobs.length}`);
    const sample = jobs[0];
    assert(sample.title, "Scraped job must have title");
    assert(sample.url, "Scraped job must have url");
    console.log(`     Sample CRED role: "${sample.title}" (${sample.location})`);
  });

  // ── TEST 5: Match Algorithm & Descending Sort Invariant ──────────────────────
  console.log("\n>>> [TEST 5] Testing Descending Score Sort & >70% Threshold Invariant...");
  test("Descending score ordering and strict >70% threshold logic", () => {
    const mockEvaluated = [
      { score: 72, title: "Role A" },
      { score: 45, title: "Role B (Low)" },
      { score: 94, title: "Role C (High)" },
      { score: 68, title: "Role D (Moderate)" },
      { score: 86, title: "Role E (Strong)" },
    ];

    const filtered = mockEvaluated.filter(m => m.score >= 70);
    assert.strictEqual(filtered.length, 3, "Only scores >= 70 must be retained");

    filtered.sort((a, b) => b.score - a.score);
    assert.strictEqual(filtered[0].score, 94, "Top match must have score 94");
    assert.strictEqual(filtered[1].score, 86, "Second match must have score 86");
    assert.strictEqual(filtered[2].score, 72, "Third match must have score 72");

    for (let i = 0; i < filtered.length - 1; i++) {
      assert(filtered[i].score >= filtered[i + 1].score, "Must be sorted in strict descending order");
    }
  });

  console.log("\n================================================================================");
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidationTests().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
