import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';

async function testJobsForUsers() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, job_title, company, about, resume_text, embedding, profile_digest')
    .eq('is_active', true);

  console.log(`Checking Jobs Suggested API logic for ${users?.length} users...\n`);

  for (const u of (users || []).slice(0, 15)) {
    console.log(`\n================ User: ${u.full_name} (${u.email}) ================`);
    console.log(`Role: ${u.job_title} @ ${u.company}`);
    console.log(`Has Embedding: ${Boolean(u.embedding)}, Has Resume: ${Boolean(u.resume_text)}`);

    if (!u.embedding) {
      console.log(`❌ FAILED: User has NO embedding! (/api/jobs/suggested returns empty companies: [])`);
      continue;
    }

    // Run match_scraped_jobs
    const { data: matchedJobs, error: mErr } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: u.embedding,
      match_threshold: 0.25,
      match_count: 250
    });

    if (mErr) {
      console.log(`❌ RPC Error:`, mErr.message);
      continue;
    }

    console.log(`Matched RPC jobs count: ${matchedJobs?.length}`);

    // Check how many have similarity >= 0.50 or what reranker would do
    const highSim = (matchedJobs || []).filter((j: any) => (j.similarity || 0) >= 0.50);
    const midSim = (matchedJobs || []).filter((j: any) => (j.similarity || 0) >= 0.40);
    console.log(`Jobs with vector similarity >= 50%: ${highSim.length}`);
    console.log(`Jobs with vector similarity >= 40%: ${midSim.length}`);

    if (matchedJobs && matchedJobs.length > 0) {
      console.log(`Top 3 jobs:`, matchedJobs.slice(0, 3).map((j: any) => `${j.title} @ ${j.company} (${Math.round((j.similarity || 0)*100)}%)`).join(' | '));
    }
  }
}

testJobsForUsers().catch(console.error);
