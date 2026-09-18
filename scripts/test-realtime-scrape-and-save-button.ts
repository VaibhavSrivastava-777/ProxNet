import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { detectAtsFromUrl } from "../lib/ats-discovery";
import { STRATEGIES } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });

const TEST_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

async function runTests() {
  console.log("==================================================");
  console.log("  TEST: REAL-TIME SCRAPING & SAVE BUTTON TRACKER  ");
  console.log("==================================================\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!url || !key) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // ----------------------------------------------------
  // TEST 1: detectAtsFromUrl Pattern Validation
  // ----------------------------------------------------
  console.log("👉 Test 1: Testing ATS URL auto-detection...");
  const testUrls = [
    { url: "https://boards.greenhouse.io/stripe", expectedProvider: "greenhouse", expectedBoard: "stripe" },
    { url: "https://job-boards.greenhouse.io/openai", expectedProvider: "greenhouse", expectedBoard: "openai" },
    { url: "https://jobs.lever.co/spotify", expectedProvider: "lever", expectedBoard: "spotify" },
    { url: "https://jobs.ashbyhq.com/linear", expectedProvider: "ashby", expectedBoard: "linear" },
    { url: "https://careers.smartrecruiters.com/BoschGroup", expectedProvider: "smartrecruiters", expectedBoard: "BoschGroup" },
    { url: "https://jobs.smartrecruiters.com/Visa", expectedProvider: "smartrecruiters", expectedBoard: "Visa" },
    { url: "https://randomcompany.com/careers", expectedProvider: null, expectedBoard: null },
  ];

  let test1Passed = true;
  for (const t of testUrls) {
    const result = detectAtsFromUrl(t.url);
    if (t.expectedProvider === null) {
      if (result !== null) {
        console.error(`  ❌ Failed: ${t.url} returned ${JSON.stringify(result)}, expected null`);
        test1Passed = false;
      } else {
        console.log(`  ✓ Correctly identified non-ATS URL as null: ${t.url}`);
      }
    } else {
      if (!result || result.provider !== t.expectedProvider || result.board !== t.expectedBoard) {
        console.error(`  ❌ Failed: ${t.url} -> ${JSON.stringify(result)}, expected { provider: "${t.expectedProvider}", board: "${t.expectedBoard}" }`);
        test1Passed = false;
      } else {
        console.log(`  ✓ Detected ${result.provider} (board: ${result.board}) from ${t.url}`);
      }
    }
  }

  if (!test1Passed) {
    throw new Error("Test 1 failed: detectAtsFromUrl had mismatches");
  }
  console.log("  ✅ Test 1 Passed: All ATS URL patterns recognized correctly.\n");

  // ----------------------------------------------------
  // TEST 2: Real-time Scraping of Target Company
  // ----------------------------------------------------
  console.log("👉 Test 2: Testing real-time target company scraping execution...");
  const testCompany = "Linear";
  const testCareerUrl = "https://jobs.ashbyhq.com/linear";
  const detected = detectAtsFromUrl(testCareerUrl);

  if (!detected) {
    throw new Error(`Failed to detect ATS for ${testCareerUrl}`);
  }

  console.log(`  Detected provider: ${detected.provider}, board: ${detected.board}`);
  const strategy = STRATEGIES[detected.provider];
  if (!strategy) {
    throw new Error(`Strategy not found for ${detected.provider}`);
  }

  const startTime = Date.now();
  console.log(`  Executing real-time scrape for ${testCompany}...`);
  const rawJobs = await strategy(detected.board, testCompany);
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`  ⚡ Scrape completed in ${elapsed.toFixed(2)}s. Found ${rawJobs.length} raw listings.`);

  if (rawJobs.length === 0) {
    throw new Error(`Expected at least 1 job from ${testCareerUrl}, got 0`);
  }

  // Verify company_ats_config schema compatibility (no scrape_status column error)
  console.log("  Testing company_ats_config upsert...");
  const { error: configErr } = await supabase.from("company_ats_config").upsert({
    company_name: testCompany,
    provider: detected.provider,
    board_token_or_url: detected.board,
    total_jobs_found: rawJobs.length,
    scrape_notes: `status: success (${rawJobs.length} jobs)`,
    last_scraped_at: new Date().toISOString(),
  }, { onConflict: "company_name" });

  if (configErr) {
    throw new Error(`company_ats_config upsert error: ${JSON.stringify(configErr)}`);
  }
  console.log("  ✓ company_ats_config updated successfully without schema errors.");

  // Store a sample job in scraped_jobs to verify table insertion
  const sampleJob = rawJobs[0];
  console.log(`  Testing scraped_jobs upsert with: "${sampleJob.title}"...`);
  const { error: jobInsertErr } = await supabase.from("scraped_jobs").upsert({
    company: testCompany,
    title: sampleJob.title,
    location: sampleJob.location || "Remote",
    url: sampleJob.url,
    posted_at: sampleJob.posted_at || new Date().toISOString(),
    description: sampleJob.description || sampleJob.title,
    ats_source: sampleJob.source || detected.provider,
    created_at: new Date().toISOString(),
  }, { onConflict: "url" });

  if (jobInsertErr) {
    throw new Error(`scraped_jobs upsert error: ${JSON.stringify(jobInsertErr)}`);
  }
  console.log("  ✓ Sample job inserted into scraped_jobs.");
  console.log("  ✅ Test 2 Passed: Real-time scraping & database upserts succeed.\n");

  // ----------------------------------------------------
  // TEST 3: Job Application Save Button & Pipeline Storage
  // ----------------------------------------------------
  console.log("👉 Test 3: Testing Save Job functionality in job_applications...");
  
  // 3a. Save a job using the check-then-upsert logic
  const testJobId = "00000000-0000-0000-0000-000000000001";
  const testJobTitle = "Staff Frontend Engineer";
  const testJobCompany = "Stripe";

  console.log(`  Saving job "${testJobTitle} @ ${testJobCompany}" to pipeline for user ${TEST_USER_ID}...`);
  
  // First check existing
  const { data: existingApp } = await supabase
    .from("job_applications")
    .select("id, stage")
    .eq("user_id", TEST_USER_ID)
    .eq("job_id", testJobId)
    .maybeSingle();

  let savedApp: any;
  if (existingApp) {
    const { data: updated, error: updateErr } = await supabase
      .from("job_applications")
      .update({
        company: testJobCompany,
        job_title: testJobTitle,
        stage: "saved",
        match_score: 95,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingApp.id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    savedApp = updated;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("job_applications")
      .insert({
        user_id: TEST_USER_ID,
        job_id: testJobId,
        company: testJobCompany,
        job_title: testJobTitle,
        job_url: "https://stripe.com/jobs/staff-fe",
        stage: "saved",
        match_score: 95,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    savedApp = inserted;
  }

  console.log(`  ✓ Job application saved with ID: ${savedApp.id}, stage: ${savedApp.stage}`);

  // 3b. Verify query retrieves saved jobs
  const { data: userApps, error: queryErr } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", TEST_USER_ID);

  if (queryErr) {
    throw new Error(`Failed to query job applications: ${JSON.stringify(queryErr)}`);
  }

  const found = userApps.find((a: any) => a.job_id === testJobId);
  if (!found) {
    throw new Error(`Saved job application with job_id ${testJobId} was not found in user's pipeline`);
  }
  console.log(`  ✓ Verified job appears in user's pipeline (Total applications: ${userApps.length})`);

  // 3c. Clean up test job application
  const { error: deleteErr } = await supabase
    .from("job_applications")
    .delete()
    .eq("id", savedApp.id);

  if (deleteErr) {
    console.warn("  ⚠️ Warning: Could not clean up test job application:", deleteErr);
  } else {
    console.log("  ✓ Cleaned up test job application.");
  }

  console.log("  ✅ Test 3 Passed: Save button pipeline storage and retrieval verified.\n");

  console.log("==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error("❌ Test runner failed:", err);
  process.exit(1);
});
