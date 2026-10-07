import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  const ranges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999], [5000, 5999], [6000, 6999]];
  const batches = await Promise.all(
    ranges.map(([s, e]) =>
      supabase.from('scraped_jobs').select('id, company, title').gte('posted_at', thirtyDaysIso).range(s, e)
    )
  );
  const allJobs = batches.flatMap(b => b.data || []);
  const companies = new Set(allJobs.map(j => (j.company || '').trim().toLowerCase()));
  console.log(`Total jobs: ${allJobs.length}, Unique companies: ${companies.size}`);
}

main().catch(console.error);
