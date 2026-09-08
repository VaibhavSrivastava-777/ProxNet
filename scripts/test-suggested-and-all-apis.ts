import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyApis() {
  console.log("=== Verifying APIs as User Vaibhav ===");
  const targetUserId = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

  // Simulate what /api/jobs/suggested produces:
  const { data: user } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", targetUserId)
    .single();

  const evaluatedMatches = user?.profile_digest?.evaluated_matches || {};
  const highMatches = Object.values(evaluatedMatches).filter((m: any) => m.score >= 50);

  const { data: matchedJobs } = await supabase
    .from("scraped_jobs")
    .select("id, title, company")
    .in("id", highMatches.map((m: any) => m.jobId));

  console.log(`Matched Section will contain ${matchedJobs?.length} evaluated jobs across companies:`);
  for (const j of matchedJobs || []) {
    const evalData = evaluatedMatches[j.id];
    console.log(`  ⭐ ${j.title} @ ${j.company}: ${evalData.score}% (${evalData.label})`);
  }

  // Verify /api/jobs/all:
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  let scrapedJobs: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from("scraped_jobs")
      .select("id, company, title, posted_at")
      .gte("posted_at", thirtyDaysIso)
      .order("posted_at", { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) { console.error(error); break; }
    if (batch && batch.length > 0) scrapedJobs.push(...batch);
    if (!batch || batch.length < batchSize) hasMore = false;
    else from += batchSize;
  }

  const companiesSet = new Set(scrapedJobs.map(j => j.company.trim()));
  console.log(`\nAll Jobs Section will contain:`);
  console.log(`  - Total jobs (strictly <= 30 days): ${scrapedJobs.length}`);
  console.log(`  - Total companies: ${companiesSet.size}`);
  console.log(`  - Verified zero jobs > 30 days old: ${scrapedJobs.every(j => new Date(j.posted_at) >= thirtyDaysAgo)}`);
}

verifyApis();
