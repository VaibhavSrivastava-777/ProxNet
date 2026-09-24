import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function testDiversity() {
  const supabase = createAdminClient();

  const { data: userProfile } = await supabase
    .from("users")
    .select("id, full_name, job_title, company, about, resume_text, embedding, profile_digest")
    .eq("id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .single();

  const { data: matchedJobs } = await supabase.rpc("match_scraped_jobs", {
    query_embedding: userProfile!.embedding,
    match_threshold: 0.25,
    match_count: 250,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const candidateJobs = (matchedJobs || []).filter((j: any) => {
    if (j.posted_at) {
      const d = new Date(j.posted_at);
      if (!isNaN(d.getTime()) && d < thirtyDaysAgo) return false;
    }
    return true;
  });

  const companyJobCounts = new Map<string, number>();
  const diverseJobs: any[] = [];

  for (const job of candidateJobs) {
    const cKey = (job.company || "").toLowerCase().trim();
    const currentCount = companyJobCounts.get(cKey) || 0;
    if (currentCount < 3) {
      diverseJobs.push(job);
      companyJobCounts.set(cKey, currentCount + 1);
    }
    if (diverseJobs.length >= 45) break;
  }

  console.log(`Selected ${diverseJobs.length} diverse jobs across ${companyJobCounts.size} companies for reranking:`);
  for (const [comp, cnt] of companyJobCounts.entries()) {
    console.log(`  - ${comp}: ${cnt} jobs`);
  }
}

testDiversity();
