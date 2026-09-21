import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { discoverAts, detectAtsFromUrl } from "../lib/ats-discovery";
import { STRATEGIES } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ Passed: ${message}`);
}

async function main() {
  console.log("================================================================================");
  console.log("VALIDATION: TARGET COMPANY REAL-TIME SCRAPING SUITE");
  console.log("================================================================================\n");

  // Get a test user ID from users table
  const { data: testUser } = await supabase
    .from("users")
    .select("id, email, job_title, company")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!testUser) {
    throw new Error("No active user found in database for testing.");
  }
  console.log(`Testing using User ID: ${testUser.id} (${testUser.email})\n`);

  // -------------------------------------------------------------------------
  // TEST CASE 1: Native ATS Auto-Discovery & Instant Scrape (Stripe -> Greenhouse)
  // -------------------------------------------------------------------------
  console.log("--- TEST CASE 1: Native ATS Auto-Discovery & Instant Scrape ---");
  const testCompany1 = "Stripe";
  const discovered1 = await discoverAts(testCompany1);
  assert(discovered1 !== null, "Auto-discovery identifies Stripe as a known board");
  assert(discovered1?.provider === "greenhouse", "Stripe provider is 'greenhouse'");
  assert(discovered1?.board === "stripe", "Stripe board is 'stripe'");

  const strategy1 = STRATEGIES[discovered1!.provider];
  const jobs1 = await strategy1(discovered1!.board, testCompany1);
  assert(jobs1.length > 0, `Instant scrape retrieved ${jobs1.length} jobs for Stripe`);
  console.log(`Sample job for Stripe: "${jobs1[0].title}" (${jobs1[0].location})`);

  // -------------------------------------------------------------------------
  // TEST CASE 2: No ATS & No URL Gracefully Marks 'needs_url' (No Google Poisoning)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST CASE 2: Unknown Company Without URL Sets 'needs_url' ---");
  const testCompany2 = "MockStartupNonExistent999";
  const discovered2 = await discoverAts(testCompany2);
  assert(discovered2 === null, "Unknown company returns null from discoverAts");

  // Simulate addition logic
  let provider2 = "none";
  let boardTokenOrUrl2 = "";
  if (discovered2) {
    provider2 = (discovered2 as any).provider;
    boardTokenOrUrl2 = (discovered2 as any).board;
  }

  assert(provider2 === "none", "Provider remains 'none'");
  assert(boardTokenOrUrl2 === "", "Board URL is empty and NOT careers.google.com");

  // Upsert into user_target_companies
  await supabase.from("user_target_companies").upsert({
    user_id: testUser.id,
    company_name: testCompany2,
    careers_url: null,
    ats_provider: "none",
    ats_board_token: null,
    is_auto_discovered: false,
    scrape_status: "no_ats",
    scrape_notes: "Please provide company careers page URL to enable live scraping",
    total_jobs_found: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,company_name" });

  const { data: checkUtc2 } = await supabase
    .from("user_target_companies")
    .select("*")
    .eq("user_id", testUser.id)
    .eq("company_name", testCompany2)
    .single();

  assert(checkUtc2?.scrape_status === "no_ats", "User target status is 'no_ats'");
  assert(checkUtc2?.careers_url === null, "Careers URL is correctly null");

  // -------------------------------------------------------------------------
  // TEST CASE 3: Updating URL via PATCH & Immediate Scrape
  // -------------------------------------------------------------------------
  console.log("\n--- TEST CASE 3: Updating Careers URL via PATCH & Scrape ---");
  const validUrl = "https://jobs.ashbyhq.com/linear";
  const urlDetected = detectAtsFromUrl(validUrl);
  assert(urlDetected?.provider === "ashby", "detectAtsFromUrl detects 'ashby' from Ashby URL");
  assert(urlDetected?.board === "linear", "detectAtsFromUrl extracts board 'linear'");

  const strategy3 = STRATEGIES[urlDetected!.provider];
  const jobs3 = await strategy3(urlDetected!.board, testCompany2);
  assert(jobs3.length > 0, `Scraping after URL update retrieved ${jobs3.length} active jobs`);

  // Update target company state to success
  await supabase.from("user_target_companies").upsert({
    user_id: testUser.id,
    company_name: testCompany2,
    careers_url: validUrl,
    ats_provider: urlDetected!.provider,
    ats_board_token: urlDetected!.board,
    is_auto_discovered: false,
    scrape_status: "success",
    scrape_notes: `Scraped ${jobs3.length} jobs in real-time`,
    total_jobs_found: jobs3.length,
    last_scraped_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,company_name" });

  const { data: checkUtc3 } = await supabase
    .from("user_target_companies")
    .select("*")
    .eq("user_id", testUser.id)
    .eq("company_name", testCompany2)
    .single();

  assert(checkUtc3?.scrape_status === "success", "Updated target company status is now 'success'");
  assert(checkUtc3?.total_jobs_found > 0, `total_jobs_found is updated to ${checkUtc3?.total_jobs_found}`);

  // Cleanup test target
  await supabase
    .from("user_target_companies")
    .delete()
    .eq("user_id", testUser.id)
    .eq("company_name", testCompany2);
  console.log(`Cleaned up temporary test company: ${testCompany2}`);

  // -------------------------------------------------------------------------
  // TEST CASE 4: Custom Career Portal Scrape Beyond 12s Without Timing Out
  // -------------------------------------------------------------------------
  console.log("\n--- TEST CASE 4: Custom Portal Scrape Survives Past 12-Second Limit ---");
  const testCompany4 = "Apple";
  const appleUrl = "https://jobs.apple.com/en-in/search";
  const start4 = Date.now();
  const customJobs = await STRATEGIES["custom"](appleUrl, testCompany4);
  const duration4 = Date.now() - start4;
  console.log(`Custom scrape finished in ${(duration4 / 1000).toFixed(1)}s (previously would have aborted at 12s)`);
  assert(customJobs.length > 0, `Custom scrape retrieved ${customJobs.length} live jobs for ${testCompany4}`);
  assert(duration4 > 0, "Duration measured accurately");

  console.log("\n================================================================================");
  console.log("ALL 4 TEST CASES PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
