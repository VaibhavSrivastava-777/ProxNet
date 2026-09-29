import assert from "assert";
import fs from "fs";
import path from "path";
import { isSameCompany } from "../lib/jobs/job-filters";
import { resolveConnector } from "../lib/jobs/deep-conversion-miner";
import { createAdminClient } from "../lib/supabase/admin";

async function runTests() {
  console.log("================================================================================");
  console.log("TEST SUITE: Validation of Paytm & Prmod Kumar (@ T) Referrer Bug Fix");
  console.log("================================================================================\n");

  // ── TEST 1: Unit Level Company Matching Rules ──────────────────────────────
  console.log(">>> [TEST 1] Testing isSameCompany & Short Name Protections...");
  assert.strictEqual(isSameCompany("T", "Paytm"), false, "Company 'T' must NOT match 'Paytm'");
  assert.strictEqual(isSameCompany("T", "Stripe"), false, "Company 'T' must NOT match 'Stripe'");
  assert.strictEqual(isSameCompany("T", "Turing"), false, "Company 'T' must NOT match 'Turing'");
  assert.strictEqual(isSameCompany("T", "Tata"), false, "Company 'T' must NOT match 'Tata'");
  assert.strictEqual(isSameCompany("T", "T"), true, "Company 'T' matches 'T'");
  assert.strictEqual(isSameCompany("Paytm", "Paytm"), true, "Paytm matches Paytm");
  assert.strictEqual(isSameCompany("Paytm", "Paytm Payments Bank"), true, "Paytm matches Paytm Payments Bank");
  console.log("✅ Passed [TEST 1]: Short company names like 'T' are strictly protected from partial substring matching.\n");

  // ── TEST 2: resolveConnector Resolution ─────────────────────────────────────
  console.log(">>> [TEST 2] Testing resolveConnector for Paytm, Stripe, and Turing...");
  const paytmConn = await resolveConnector("Paytm", "IIM Lucknow", "Product Manager", undefined, {
    currentCompany: "Dell Technologies",
    currentRole: "Consultant, Product Management",
  });
  console.log("Paytm connector result:", paytmConn.type, paytmConn.connectionPath);
  assert.notStrictEqual(paytmConn.proxnetUserId, "6052f1f7-b42c-4fab-bd08-2d98b0ff5252", "Paytm connector must NOT be Prmod Kumar");
  assert.strictEqual(paytmConn.type, "linkedin", "Paytm connector must default to LinkedIn when no authentic ProxNet employee exists");

  const stripeConn = await resolveConnector("Stripe", "IIM Lucknow", "Staff PM");
  assert.notStrictEqual(stripeConn.proxnetUserId, "6052f1f7-b42c-4fab-bd08-2d98b0ff5252", "Stripe connector must NOT be Prmod Kumar");

  const turingConn = await resolveConnector("Turing", "IIM Lucknow", "AI Engineer");
  assert.notStrictEqual(turingConn.proxnetUserId, "6052f1f7-b42c-4fab-bd08-2d98b0ff5252", "Turing connector must NOT be Prmod Kumar");
  console.log("✅ Passed [TEST 2]: resolveConnector cleanly returns LinkedIn direct contacts without Prmod Kumar leak.\n");

  // ── TEST 3: Supabase Database Sanitization ──────────────────────────────────
  console.log(">>> [TEST 3] Verifying Supabase Database profile_digest Sanitization...");
  const sb = createAdminClient();
  const { data: users, error } = await sb
    .from("users")
    .select("id, full_name, email, profile_digest");

  assert(!error, `Failed to query users: ${error?.message}`);

  let corruptCount = 0;
  for (const u of users || []) {
    const bps = u.profile_digest?.deep_career_blueprints;
    if (Array.isArray(bps)) {
      for (const bp of bps) {
        if (bp.connector?.proxnetUserId === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" && bp.company.toLowerCase().trim() !== "t") {
          console.error(`Found lingering corrupt connector in user ${u.email} for ${bp.company}!`);
          corruptCount++;
        }
      }
    }
  }

  assert.strictEqual(corruptCount, 0, "No corrupt Prmod Kumar connectors may exist in the database for non-'T' companies");
  console.log(`✅ Passed [TEST 3]: All ${users?.length} user profiles in Supabase are verified clean (0 corrupt blueprints).\n`);

  // ── TEST 4: Frontend Code & Cache Invalidation ──────────────────────────────
  console.log(">>> [TEST 4] Verifying Frontend Cache Invalidation & Blueprint Sanitizer...");
  const suggestedJobsPath = path.join(process.cwd(), "components", "jobs", "SuggestedJobs.tsx");
  const suggestedJobsCode = fs.readFileSync(suggestedJobsPath, "utf-8");

  assert(suggestedJobsCode.includes('JOBS_CACHE_KEY = "proxnet_last_jobs_pull_v2"'), "Cache key must be bumped to v2 to purge stale browser caches");
  assert(suggestedJobsCode.includes("isPramodMismatched"), "Must include isPramodMismatched sanitization guard");
  assert(suggestedJobsCode.includes("<DeepFetchModal"), "Must render DeepFetchModal");
  console.log("✅ Passed [TEST 4]: Frontend cache key bumped to v2 and client-side sanitizers are active.\n");

  // ── TEST 5: Backend Suggested Route Sanitizer ───────────────────────────────
  console.log(">>> [TEST 5] Verifying Backend /api/jobs/suggested Sanitization Guard...");
  const suggestedRoutePath = path.join(process.cwd(), "app", "api", "jobs", "suggested", "route.ts");
  const suggestedRouteCode = fs.readFileSync(suggestedRoutePath, "utf-8");

  assert(suggestedRouteCode.includes("deep_career_blueprints"), "Suggested route must check deep_career_blueprints");
  assert(suggestedRouteCode.includes("6052f1f7-b42c-4fab-bd08-2d98b0ff5252"), "Suggested route must specifically sanitize Prmod Kumar");
  console.log("✅ Passed [TEST 5]: Backend route /api/jobs/suggested contains fail-safe runtime sanitizer.\n");

  console.log("================================================================================");
  console.log("ALL 5 VALIDATION TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
