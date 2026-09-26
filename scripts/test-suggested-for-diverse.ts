import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';

async function testSuggestedForDiverseUsers() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, job_title, company, embedding, resume_text')
    .eq('is_active', true)
    .limit(10);

  console.log(`Auditing suggested jobs logic across ${users?.length} users...\n`);

  for (const u of users || []) {
    let matchedJobsList: any[] = [];
    if (u.embedding) {
      const { data: matchedJobs } = await supabase.rpc("match_scraped_jobs", {
        query_embedding: u.embedding,
        match_threshold: 0.20,
        match_count: 250
      });
      if (matchedJobs && matchedJobs.length > 0) {
        matchedJobsList = matchedJobs;
      }
    }

    if (matchedJobsList.length === 0) {
      const { data: fallbackJobs } = await supabase
        .from("scraped_jobs")
        .select("id, title, company, location, url, description, posted_at, keywords")
        .order("posted_at", { ascending: false })
        .limit(100);
      matchedJobsList = (fallbackJobs || []).map((j, i) => ({
        ...j,
        similarity: Math.max(0.40, 0.58 - (i * 0.002))
      }));
    }

    // Diverse candidate selection
    const companyJobCounts = new Map<string, number>();
    const diverseCandidateJobs: any[] = [];
    for (const job of matchedJobsList) {
      const cKey = (job.company || "").toLowerCase().trim();
      const count = companyJobCounts.get(cKey) || 0;
      if (count < 3) {
        diverseCandidateJobs.push(job);
        companyJobCounts.set(cKey, count + 1);
      }
      if (diverseCandidateJobs.length >= 45) break;
    }

    const uniqueCompanies = new Set(diverseCandidateJobs.map(j => j.company));
    console.log(`User: ${u.full_name || 'No Name'} (${u.email}) | Role: ${u.job_title} @ ${u.company}`);
    console.log(`  -> Available suggested candidate jobs: ${diverseCandidateJobs.length} across ${uniqueCompanies.size} companies`);
    console.log(`  -> Sample companies: ${Array.from(uniqueCompanies).slice(0, 5).join(', ')}`);
  }
}

testSuggestedForDiverseUsers().catch(console.error);
