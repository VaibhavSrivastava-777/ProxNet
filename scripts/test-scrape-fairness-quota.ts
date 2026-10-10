import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * Validates the scraping fairness fix:
 *  1. Per-company per-run quota (no single company can dominate a day's inserts)
 *  2. Firecrawl circuit breaker (credits exhausted -> stop calling, keep queue priority)
 *  3. Firecrawl 429 retry with backoff
 */

let passed = 0;
let total = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Faithful mirror of the round-robin + quota loop in scripts/scrape-jobs.ts
function simulateRun(
  companies: Array<{ name: string; eligibleNew: number; ineligible: number }>,
  cap: number,
  batchSize = 30
) {
  const pools = companies.map((c) => ({
    name: c.name,
    // interleave ineligible + eligible postings to mimic a real board
    allJobs: [
      ...Array.from({ length: c.ineligible }, () => ({ eligible: false })),
      ...Array.from({ length: c.eligibleNew }, () => ({ eligible: true })),
    ].sort(() => 0.5 - Math.random()),
    index: 0,
    added: 0,
    capped: false,
  }));

  let keep = true;
  while (keep) {
    keep = false;
    for (const pool of pools) {
      if (pool.index >= pool.allJobs.length) continue;
      if (pool.added >= cap) { pool.capped = true; continue; }
      keep = true;
      const batch = pool.allJobs.slice(pool.index, pool.index + batchSize);
      let consumed = 0;
      for (const job of batch) {
        if (pool.added >= cap) { pool.capped = true; break; }
        consumed++;
        if (!job.eligible) continue;
        pool.added++;
      }
      pool.index += consumed;
    }
  }
  return pools;
}

async function main() {
  console.log("==================================================================");
  console.log("🧪 VALIDATION: Scraping fairness quota & Firecrawl circuit breaker");
  console.log("==================================================================\n");

  const src = fs.readFileSync(path.resolve("scripts/scrape-jobs.ts"), "utf-8");
  const strat = fs.readFileSync(path.resolve("lib/scrape-strategies.ts"), "utf-8");

  await test("scrape-jobs.ts defines and enforces a per-company per-run quota", () => {
    assert(src.includes("MAX_NEW_JOBS_PER_COMPANY_PER_RUN"), "quota constant missing");
    assert(/pool\.added >= MAX_NEW_JOBS_PER_COMPANY_PER_RUN/.test(src), "quota not enforced in loop");
    assert(src.includes("pool.index += consumed"), "index must advance only by consumed jobs");
    assert(src.includes("const BATCH_SIZE = 30;"), "existing 30-job round-robin batch preserved");
    // quota must be read after dotenv loads
    assert(src.indexOf('dotenv.config({ path: ".env" })') < src.indexOf("const MAX_NEW_JOBS_PER_COMPANY_PER_RUN"),
      "quota must be evaluated after dotenv.config");
  });

  await test("scrape-jobs.ts has Firecrawl circuit breaker that preserves queue priority", () => {
    assert(src.includes("firecrawlExhausted"), "circuit-breaker flag missing");
    assert(src.includes("instanceof FirecrawlCreditsExhaustedError"), "credit-exhaustion not handled");
    assert(src.includes("instanceof FirecrawlRateLimitedError"), "rate-limit not handled");
    // deferred branch must not bump last_scraped_at
    const creditBlock = src.slice(src.indexOf("instanceof FirecrawlCreditsExhaustedError"), src.indexOf("instanceof FirecrawlRateLimitedError"));
    assert(!creditBlock.includes("last_scraped_at"), "credit-exhausted branch must NOT bump last_scraped_at");
  });

  await test("Simulation of today's data: Wipro can no longer dominate", () => {
    // Reproduce 2026-10-10: Wipro had 5055 postings (2193 new eligible); 80 others had a handful each
    const companies = [
      { name: "Wipro", eligibleNew: 2193, ineligible: 2862 },
      ...Array.from({ length: 80 }, (_, i) => ({ name: `Co${i}`, eligibleNew: (i % 8) + 1, ineligible: 150 })),
    ];

    const before = simulateRun(companies, Number.POSITIVE_INFINITY);
    const beforeTotal = before.reduce((a, p) => a + p.added, 0);
    const beforeWipro = before.find((p) => p.name === "Wipro")!.added;
    console.log(`     BEFORE (no cap): Wipro ${beforeWipro}/${beforeTotal} = ${((beforeWipro / beforeTotal) * 100).toFixed(1)}%`);
    assert.strictEqual(beforeWipro, 2193, "old policy reproduces the bug");

    const after = simulateRun(companies, 30);
    const afterTotal = after.reduce((a, p) => a + p.added, 0);
    const afterWipro = after.find((p) => p.name === "Wipro")!.added;
    const share = afterWipro / afterTotal;
    console.log(`     AFTER  (cap 30): Wipro ${afterWipro}/${afterTotal} = ${(share * 100).toFixed(1)}%`);

    assert.strictEqual(afterWipro, 30, "Wipro capped at 30");
    assert(after.every((p) => p.added <= 30), "no company exceeds 30");
    // smaller companies are unaffected — they still get every eligible job
    for (const c of companies.slice(1)) {
      assert.strictEqual(after.find((p) => p.name === c.name)!.added, c.eligibleNew, `${c.name} must keep all its jobs`);
    }
    assert(share < 0.1, `Wipro share should drop below 10% (got ${(share * 100).toFixed(1)}%)`);
  });

  await test("Capped company progresses across days (dedup advances the window)", () => {
    // Day N saves 30; next day those 30 are duplicates, so the next 30 new ones are saved
    let remainingNew = 2193;
    let days = 0;
    while (remainingNew > 0 && days < 200) {
      const [w] = simulateRun([{ name: "Wipro", eligibleNew: remainingNew, ineligible: 0 }], 30);
      remainingNew -= w.added;
      days++;
    }
    assert.strictEqual(remainingNew, 0);
    console.log(`     Wipro backlog fully absorbed in ${days} daily runs at 30/day`);
  });

  // ---------- Mocked-fetch tests of customStrategy Firecrawl handling ----------
  process.env.FIRECRAWL_API_KEY = "test-key";
  process.env.OPENAI_API_KEY = "test-openai";
  const mod = await import("../lib/scrape-strategies");
  const realFetch = globalThis.fetch;

  await test("usesFirecrawl() identifies Firecrawl-dependent configs (Wipro excluded)", () => {
    assert.strictEqual(mod.usesFirecrawl("custom", "https://careers.infosys.com"), true);
    assert.strictEqual(mod.usesFirecrawl("custom", "https://careers.wipro.com/sitemap.xml"), false);
    assert.strictEqual(mod.usesFirecrawl("greenhouse", "stripe"), false);
    assert.strictEqual(mod.usesFirecrawl("icims", "https://x.icims.com"), true);
  });

  await test("customStrategy throws FirecrawlCreditsExhaustedError on 402 'Insufficient credits'", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ success: false, error: "Insufficient credits to perform this request." }), { status: 402 });
    }) as any;
    try {
      await assert.rejects(() => mod.customStrategy("https://careers.example.com", "Example"), (e: any) => e instanceof mod.FirecrawlCreditsExhaustedError);
      assert.strictEqual(calls, 1, "must not retry when credits are exhausted");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await test("customStrategy retries 429 with backoff then proceeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), { status: 429, headers: { "retry-after": "1" } });
      }
      // 2nd attempt succeeds at HTTP level but returns no markdown -> proves we got past the 429
      return new Response(JSON.stringify({ success: false }), { status: 200 });
    }) as any;
    try {
      await assert.rejects(() => mod.customStrategy("https://careers.example.com", "Example"), /failed to return markdown/);
      assert.strictEqual(calls, 2, "should retry exactly once after a single 429");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await test("customStrategy throws FirecrawlRateLimitedError after exhausting retries", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), { status: 429, headers: { "retry-after": "1" } });
    }) as any;
    try {
      await assert.rejects(() => mod.customStrategy("https://careers.example.com", "Example"), (e: any) => e instanceof mod.FirecrawlRateLimitedError);
      assert.strictEqual(calls, 4, "4 attempts total");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await test("Vercel cron route still enforces its own 30/company cap", () => {
    const cron = fs.readFileSync(path.resolve("app/api/cron/scrape-network-and-competitors/route.ts"), "utf-8");
    assert(cron.includes("if (toInsert.length >= 30) break;"));
  });

  console.log("\n==================================================================");
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log("==================================================================");
}

main();
