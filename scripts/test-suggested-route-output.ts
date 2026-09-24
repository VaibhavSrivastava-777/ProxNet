import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function simulateSuggested() {
  const supabase = createAdminClient();

  const { data: userProfile } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, about, resume_text, embedding, profile_digest")
    .eq("id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .single();

  if (!userProfile?.embedding) {
    console.log("No embedding");
    return;
  }

  // 1. Fetch top matched jobs
  const { data: matchedJobs, error } = await supabase.rpc("match_scraped_jobs", {
    query_embedding: userProfile.embedding,
    match_threshold: 0.25,
    match_count: 200,
  });

  if (error) {
    console.error("RPC error:", error);
    return;
  }

  console.log(`RPC returned ${matchedJobs?.length || 0} candidate jobs.`);

  // Check unique companies in RPC results
  const companyCounts: Record<string, number> = {};
  for (const j of matchedJobs || []) {
    companyCounts[j.company] = (companyCounts[j.company] || 0) + 1;
  }

  console.log("Unique companies in matchedJobs:", Object.keys(companyCounts).length);
  console.log("Breakdown of top 15 companies in matches:");
  const sortedCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]);
  for (const [comp, count] of sortedCompanies.slice(0, 15)) {
    console.log(`  - ${comp}: ${count} jobs`);
  }
}

simulateSuggested();
