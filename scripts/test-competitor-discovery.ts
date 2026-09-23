import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import { createAdminClient } from "../lib/supabase/admin";
import {
  getNetworkCompanies,
  discoverCompetitorsForCompany,
  mapAllNetworkCompetitors,
} from "../lib/competitors/discover-competitors";
import { validateAndSaveCompetitorAts } from "../lib/competitors/validate-competitor-ats";

async function run() {
  console.log("================================================================================");
  console.log("🧪 TEST SUITE: COMPETITOR DISCOVERY & ATS VALIDATION ENGINE");
  console.log("================================================================================\n");

  const supabase = createAdminClient();

  // 1. Test Network Companies Extraction
  console.log("[Test 1] Extracting active network companies from users table...");
  const networkCompanies = await getNetworkCompanies(supabase);
  console.log(`✅ Extracted ${networkCompanies.length} distinct enterprise companies.`);
  assert(networkCompanies.length > 0, "Network companies list must not be empty");
  console.log(`   Sample companies: ${networkCompanies.slice(0, 8).join(", ")}`);

  // 2. Test Canonical Competitor Discovery (Swiggy, Dell, Razorpay)
  console.log("\n[Test 2] Testing canonical competitor mappings...");
  const swiggyComps = await discoverCompetitorsForCompany("Swiggy");
  console.log(`   Swiggy competitors:`, swiggyComps.competitors.map((c) => c.name));
  assert(swiggyComps.competitors.some((c) => c.name.toLowerCase().includes("zomato")), "Swiggy must include Zomato");
  assert(swiggyComps.competitors.some((c) => c.name.toLowerCase().includes("zepto")), "Swiggy must include Zepto");

  const dellComps = await discoverCompetitorsForCompany("Dell");
  console.log(`   Dell competitors:`, dellComps.competitors.map((c) => c.name));
  assert(dellComps.competitors.some((c) => c.name.toLowerCase().includes("hp")), "Dell must include HP");

  const razorpayComps = await discoverCompetitorsForCompany("Razorpay");
  console.log(`   Razorpay competitors:`, razorpayComps.competitors.map((c) => c.name));
  assert(razorpayComps.competitors.some((c) => c.name.toLowerCase().includes("cashfree")), "Razorpay must include Cashfree");

  // 3. Test AI-Powered Discovery Fallback for Niche/Custom Company
  console.log("\n[Test 3] Testing AI-powered competitor discovery fallback for niche company...");
  const nicheComps = await discoverCompetitorsForCompany("Postman");
  console.log(`   Postman competitors (AI/Canonical):`, nicheComps.competitors.map((c) => c.name));
  assert(nicheComps.competitors.length > 0, "Must discover competitors for Postman");

  // 4. Test ATS Validation for Discovered Competitor
  console.log("\n[Test 4] Testing ATS validation & persistence for a competitor...");
  const valResult = await validateAndSaveCompetitorAts(supabase, "Meesho", "Flipkart");
  console.log(`   Validation Result for Meesho:`, {
    provider: valResult.provider,
    boardToken: valResult.boardTokenOrUrl,
    isValid: valResult.isValid,
    sampleJobs: valResult.sampleJobCount,
  });
  assert(valResult.provider === "lever", "Meesho ATS provider must be lever");
  assert(valResult.isValid, "Meesho ATS must be valid");

  // 5. Verify company_ats_config row was written/updated
  console.log("\n[Test 5] Verifying database persistence in company_ats_config...");
  const { data: dbRow, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .ilike("company_name", "Meesho")
    .single();

  assert(!error, `Failed to query company_ats_config: ${error?.message}`);
  assert(dbRow.provider === "lever", "Database provider should be lever");
  assert(dbRow.scrape_notes?.includes("Flipkart"), "Scrape notes should link competitor to Flipkart");
  console.log(`✅ Database record verified: ${dbRow.company_name} [${dbRow.provider}]`);

  console.log("\n================================================================================");
  console.log("🎉 ALL COMPETITOR DISCOVERY & ATS VALIDATION TESTS PASSED!");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
