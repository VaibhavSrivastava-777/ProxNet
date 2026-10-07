import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const testUserId = (await supabase.from('users').select('id').limit(1).single()).data?.id;

  console.log('Testing fully parallel server-side fetch...');
  const t0 = performance.now();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  // Run all 7 job batches + users query + follows query ALL IN PARALLEL!
  const batchRanges = [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999], [5000, 5999], [6000, 6999]];

  const [
    batch0, batch1, batch2, batch3, batch4, batch5, batch6,
    usersRes, followsRes
  ] = await Promise.all([
    ...batchRanges.map(([s, e]) =>
      supabase
        .from('scraped_jobs')
        .select('id, company, title, location, url, description, posted_at, keywords')
        .gte('posted_at', thirtyDaysIso)
        .order('posted_at', { ascending: false })
        .range(s, e)
    ),
    supabase
      .from('users')
      .select('id, company, job_title')
      .eq('is_blocked', false)
      .not('company', 'is', null),
    testUserId
      ? supabase.from('follows').select('following_id').eq('follower_id', testUserId)
      : Promise.resolve({ data: [] }),
  ]);

  const allJobs = [
    ...(batch0.data || []),
    ...(batch1.data || []),
    ...(batch2.data || []),
    ...(batch3.data || []),
    ...(batch4.data || []),
    ...(batch5.data || []),
    ...(batch6.data || []),
  ];

  const t1 = performance.now();
  console.log(`Fetched ${allJobs.length} jobs, ${usersRes.data?.length} users, ${followsRes.data?.length} follows in ${(t1 - t0).toFixed(0)}ms!`);
}

main().catch(console.error);
