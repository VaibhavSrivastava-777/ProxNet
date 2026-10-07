import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  console.log('Testing query timing for scraped_jobs...');
  const t0 = performance.now();

  // Test 1: Fetching full descriptions for 7k jobs
  let countAll = 0;
  let totalBytes = 0;
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const tBatch0 = performance.now();
    const { data: batch, error } = await supabase
      .from('scraped_jobs')
      .select('id, company, title, location, url, description, posted_at, keywords')
      .gte('posted_at', thirtyDaysIso)
      .order('posted_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('Batch error:', error);
      break;
    }
    const batchLen = batch?.length || 0;
    countAll += batchLen;
    const batchJson = JSON.stringify(batch);
    totalBytes += Buffer.byteLength(batchJson, 'utf-8');
    console.log(`Batch ${from}-${from + batchLen - 1}: ${batchLen} rows in ${(performance.now() - tBatch0).toFixed(0)}ms (${(Buffer.byteLength(batchJson, 'utf-8') / 1024 / 1024).toFixed(2)} MB)`);

    if (batchLen < batchSize || countAll >= 10000) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }

  const t1 = performance.now();
  console.log(`\nTOTAL: ${countAll} jobs fetched in ${(t1 - t0).toFixed(0)}ms (${(totalBytes / 1024 / 1024).toFixed(2)} MB payload!)`);
}

main().catch(console.error);
