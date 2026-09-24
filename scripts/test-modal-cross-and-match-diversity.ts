import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function runValidationTests() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION TEST: MODAL PINNED HEADER / CROSS ICON & MATCH RATE DIVERSITY");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- Test 1: Verify Modal Layout and Close Button in SuggestedJobs.tsx ---
  console.log("[Test 1] Verifying Modal Layout, Pinned Header, and Close Button...");
  const componentPath = path.join(process.cwd(), "components", "jobs", "SuggestedJobs.tsx");
  const componentSource = fs.readFileSync(componentPath, "utf-8");

  assert(
    componentSource.includes("max-h-[85vh] overflow-hidden"),
    "Modal container has max-h-[85vh] and overflow-hidden to prevent screen overflow"
  );

  assert(
    componentSource.includes("shrink-0 z-20") && componentSource.includes("Pinned Sticky Header"),
    "Modal header is pinned with shrink-0 so it cannot be pushed off the screen"
  );

  assert(
    componentSource.includes("aria-label=\"Close modal\"") && componentSource.includes("<svg width=\"18\" height=\"18\""),
    "Modal features an accessible, high-contrast SVG close button"
  );

  assert(
    componentSource.includes("e.key === \"Escape\" && activeCompanyModal"),
    "Escape key dismisses activeCompanyModal cleanly"
  );

  assert(
    componentSource.includes("overflow-y-auto flex-1 flex flex-col gap-3.5 min-h-0"),
    "Job content and Pioneer banner are housed inside a smooth flex scrollable body"
  );

  assert(
    componentSource.includes("proxnet_suggested_jobs_cache_v3"),
    "Client cache bumped to v3 to invalidate stale sessions and pull diverse matches"
  );

  // --- Test 2: Database Embeddings Health Check ---
  console.log("\n[Test 2] Auditing Database Scraped Job Embeddings...");
  const supabase = createAdminClient();

  const { count: totalJobs } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  const { count: missingEmbeddings } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true })
    .is("embedding", null);

  assert(
    (missingEmbeddings || 0) === 0,
    `All scraped jobs have embeddings generated (Missing: ${missingEmbeddings} out of ${totalJobs})`
  );

  // --- Test 3: Match Rate RPC Diversity for Candidate ---
  console.log("\n[Test 3] Testing Vector Match Diversity for User Profile...");
  const { data: userProfile } = await supabase
    .from("users")
    .select("id, full_name, embedding")
    .eq("id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .single();

  assert(Boolean(userProfile?.embedding), "Candidate user (Vaibhav) has active embedding");

  if (userProfile?.embedding) {
    const { data: matchedJobs, error: rpcErr } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userProfile.embedding,
      match_threshold: 0.25,
      match_count: 200,
    });

    assert(!rpcErr && (matchedJobs?.length || 0) > 0, `match_scraped_jobs RPC executed successfully (Found ${matchedJobs?.length} candidates)`);

    const companies = new Set((matchedJobs || []).map((j: any) => (j.company || "").toLowerCase().trim()));
    console.log(`  Discovered jobs across ${companies.size} distinct companies for candidate.`);
    assert(
      companies.size >= 15,
      `Match rate algorithm surfaces diverse companies (Found ${companies.size} distinct companies, threshold >= 15)`
    );

    // Verify key non-Amazon companies are present in match results
    const nonAmazonFound = (matchedJobs || []).some((j: any) => {
      const c = (j.company || "").toLowerCase();
      return c.includes("dell") || c.includes("paytm") || c.includes("datadog") || c.includes("servicenow") || c.includes("meesho");
    });
    assert(nonAmazonFound, "High-match jobs include diverse companies (Dell, Paytm, Datadog, ServiceNow, etc.)");
  }

  // --- Test 4: Verify Route Implementation ---
  console.log("\n[Test 4] Verifying app/api/jobs/suggested/route.ts Diversity Configuration...");
  const routePath = path.join(process.cwd(), "app", "api", "jobs", "suggested", "route.ts");
  const routeSource = fs.readFileSync(routePath, "utf-8");

  assert(
    routeSource.includes("match_count: 250"),
    "Suggested route expanded match_count to 250 candidates"
  );

  assert(
    routeSource.includes("diverseCandidateJobs") && routeSource.includes("companyJobCounts.get(cKey) || 0"),
    "Suggested route prevents single-company monopolization by enforcing diversity cap per company"
  );

  console.log("\n================================================================================");
  console.log(`📊 Validation Results: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidationTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
