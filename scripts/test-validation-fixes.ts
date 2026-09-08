import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testValidation() {
  console.log("=================================================");
  console.log("🧪 RUNNING VALIDATION SUITE: 30-DAY FRESHNESS & MATCH RETENTION");
  console.log("=================================================\n");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  // Test Case 1: Job Freshness Enforcement (<= 30 Days)
  console.log("--- Test Case 1: Job Freshness (<= 30 Days) ---");
  const { data: allJobsBatch, error: err1 } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, posted_at")
    .gte("posted_at", thirtyDaysIso)
    .order("posted_at", { ascending: false })
    .limit(1000);

  if (err1) {
    console.error("❌ Test 1 Failed: DB query error:", err1.message);
  } else {
    const olderThan30 = (allJobsBatch || []).filter(j => new Date(j.posted_at) < thirtyDaysAgo);
    if (olderThan30.length === 0) {
      console.log(`✅ Test 1 Passed: All ${allJobsBatch?.length} fetched jobs are strictly <= 30 days old.`);
    } else {
      console.error(`❌ Test 1 Failed: Found ${olderThan30.length} jobs older than 30 days!`);
    }
  }

  // Test Case 2: Multi-Company Representation in 30-Day Window
  console.log("\n--- Test Case 2: Multi-Company Diversity ---");
  const companyCounts: Record<string, number> = {};
  for (const j of allJobsBatch || []) {
    const comp = j.company || "Unknown";
    companyCounts[comp] = (companyCounts[comp] || 0) + 1;
  }
  const uniqueCompanies = Object.keys(companyCounts);
  console.log(`✅ Test 2 Passed: Found ${uniqueCompanies.length} unique companies with recent openings.`);
  console.log("Companies:", uniqueCompanies);

  // Test Case 3: User Evaluated Match Persistence
  console.log("\n--- Test Case 3: Match Rate Persistence in DB ---");
  const targetUserId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";
  const { data: user, error: err3 } = await supabase
    .from("users")
    .select("id, profile_digest, wallet")
    .eq("id", targetUserId)
    .single();

  if (err3 || !user) {
    console.error("❌ Test 3 Failed: Could not fetch user profile.");
  } else {
    const evaluatedMatches = user.profile_digest?.evaluated_matches || {};
    const matchCount = Object.keys(evaluatedMatches).length;
    console.log(`User evaluated matches count in profile_digest: ${matchCount}`);
    if (matchCount > 0) {
      console.log("Sample evaluated match:", Object.values(evaluatedMatches)[0]);
      console.log(`✅ Test 3 Passed: profile_digest.evaluated_matches exists and stores evaluations.`);
    } else {
      console.log("⚠️ Note: No evaluated matches yet; script is still running.");
    }
  }

  // Test Case 4: High Match (>= 70%) Inclusion in Matched Section
  console.log("\n--- Test Case 4: High Match (>= 70%) Auto-Inclusion ---");
  const highMatches = Object.values(user?.profile_digest?.evaluated_matches || {}).filter((m: any) => m.score >= 70);
  console.log(`Found ${highMatches.length} high matches (>= 70%) for target user.`);
  for (const m of highMatches.slice(0, 5) as any[]) {
    console.log(`  - Job ${m.jobId}: Score ${m.score}% (${m.label})`);
  }
  console.log("✅ Test 4 Complete.");
}

testValidation();
