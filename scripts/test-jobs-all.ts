import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createAdminClient } from '../lib/supabase/admin';

async function testJobsAll() {
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  const { data: jobs, error } = await supabase
    .from('scraped_jobs')
    .select('id, company, title, location, url, description, posted_at, keywords')
    .gte('posted_at', thirtyDaysIso)
    .order('posted_at', { ascending: false })
    .limit(100);

  console.log(`Found ${jobs?.length} jobs in /api/jobs/all query`, error ? `Error: ${error.message}` : '');
}

testJobsAll().catch(console.error);
