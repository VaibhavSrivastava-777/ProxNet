import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function validateAdminPortal() {
  console.log("=== STEP 1: VALIDATING ADMIN LEADING INDICATORS LOGIC ===");
  const supabase = createAdminClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: blockedUsers },
    { data: missingEmbeddingsList },
    { data: usersList },
    { count: totalJobs },
    { count: freshJobs },
    { data: latestJobs },
    { count: totalCarpools },
    { data: configs }
  ] = await Promise.all([
    supabase.from("users").select("*", { head: true, count: "exact" }),
    supabase.from("users").select("*", { head: true, count: "exact" }).eq("is_active", true),
    supabase.from("users").select("*", { head: true, count: "exact" }).eq("is_blocked", true),
    supabase.from("users").select("id").is("embedding", null).eq("is_active", true),
    supabase.from("users").select("id, full_name, email, company, job_title, home_lat, home_lng, home_name, office_lat, office_lng, office_name"),
    supabase.from("scraped_jobs").select("*", { head: true, count: "exact" }),
    supabase.from("scraped_jobs").select("*", { head: true, count: "exact" }).gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("scraped_jobs").select("created_at, posted_at").order("created_at", { ascending: false }).limit(1),
    supabase.from("carpool_posts").select("*", { head: true, count: "exact" }),
    supabase.from("company_ats_config").select("company_name, provider, board_token_or_url, total_jobs_found, last_scraped_at")
  ]);

  console.log("1. Total Users Count:", totalUsers);
  console.log("2. Active Users Count:", activeUsers);
  console.log("3. Missing Embeddings Count:", missingEmbeddingsList?.length);
  console.log("4. Total Scraped Jobs:", totalJobs);
  console.log("5. Fresh Jobs (7d):", freshJobs);
  console.log("6. ATS Configs Count:", configs?.length);

  if (typeof totalUsers !== "number" || totalUsers <= 0) {
    throw new Error("Validation Failed: totalUsers is invalid");
  }
  if (!missingEmbeddingsList) {
    throw new Error("Validation Failed: missingEmbeddingsList query failed");
  }
  if (typeof totalJobs !== "number") {
    throw new Error("Validation Failed: totalJobs is invalid");
  }

  // Validate unmapped calculation
  const validConfigs = (configs || []).filter(c => c.provider && c.provider !== "none" && c.provider !== "cron_status");
  const configuredCompaniesSet = new Set(validConfigs.map(c => c.company_name.toLowerCase().trim()));

  const userCompaniesMap = new Map<string, number>();
  for (const u of (usersList || [])) {
    if (u.company && u.company.trim()) {
      const cleanComp = u.company.trim();
      userCompaniesMap.set(cleanComp, (userCompaniesMap.get(cleanComp) || 0) + 1);
    }
  }

  const unmappedCompanies: { name: string; userCount: number }[] = [];
  for (const [compName, count] of userCompaniesMap.entries()) {
    if (!configuredCompaniesSet.has(compName.toLowerCase().trim())) {
      unmappedCompanies.push({ name: compName, userCount: count });
    }
  }

  console.log("7. Unique User Companies:", userCompaniesMap.size);
  console.log("8. Mapped Configs:", validConfigs.length);
  console.log("9. Unmapped Companies Count:", unmappedCompanies.length);
  console.log("Top 5 Unmapped Companies:", unmappedCompanies.slice(0, 5));

  console.log("\n=== STEP 2: VALIDATING LEADING INDICATORS CONTRACT ===");
  const activeCount = activeUsers || 0;
  const missingEmb = missingEmbeddingsList?.length || 0;
  const readyEmb = Math.max(0, activeCount - missingEmb);
  const embCoverage = activeCount > 0 ? Math.round((readyEmb / activeCount) * 100) : 100;
  console.log(`AI Vector Coverage: ${embCoverage}% (${readyEmb}/${activeCount})`);
  console.log(`Action Required: Generate ${missingEmb} missing embeddings`);

  console.log("\n✅ ALL LEADING INDICATOR CONTRACT TESTS PASSED SUCCESSFULLY!");
}

validateAdminPortal().catch((err) => {
  console.error("Validation Error:", err);
  process.exit(1);
});
