import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysIso = thirtyDaysAgo.toISOString();

  console.log('BENCHMARKING LATENCY OPTIMIZATIONS:\n');

  // ── Baseline: Current serial fetch of 7k rows with full description ──
  console.log('1. Measuring current baseline serial fetch with full description...');
  const tStartSerial = performance.now();
  let serialJobs: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch } = await supabase
      .from('scraped_jobs')
      .select('id, company, title, location, url, description, posted_at, keywords')
      .gte('posted_at', thirtyDaysIso)
      .order('posted_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (batch) serialJobs.push(...batch);
    if (!batch || batch.length < batchSize || serialJobs.length >= 10000) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }
  const tEndSerial = performance.now();
  const serialBytes = Buffer.byteLength(JSON.stringify(serialJobs), 'utf-8');
  console.log(`   Baseline: ${serialJobs.length} jobs fetched in ${(tEndSerial - tStartSerial).toFixed(0)}ms | Size: ${(serialBytes / 1024 / 1024).toFixed(2)} MB`);

  // ── Optimization 1: Parallel batches with selected lightweight columns ──
  console.log('\n2. Measuring parallel batch fetch without heavy description...');
  const tStartParallel = performance.now();

  // Get total count first or run parallel range slices
  const { count: totalCount } = await supabase
    .from('scraped_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('posted_at', thirtyDaysIso);

  const total = totalCount || 7000;
  const ranges: Array<[number, number]> = [];
  for (let f = 0; f < total; f += batchSize) {
    ranges.push([f, f + batchSize - 1]);
  }

  const parallelBatches = await Promise.all(
    ranges.map(([start, end]) =>
      supabase
        .from('scraped_jobs')
        .select('id, company, title, location, url, posted_at, keywords')
        .gte('posted_at', thirtyDaysIso)
        .order('posted_at', { ascending: false })
        .range(start, end)
    )
  );

  const parallelJobs = parallelBatches.flatMap(b => b.data || []);
  const tEndParallel = performance.now();
  const parallelBytes = Buffer.byteLength(JSON.stringify(parallelJobs), 'utf-8');
  console.log(`   Parallel (No heavy desc): ${parallelJobs.length} jobs fetched in ${(tEndParallel - tStartParallel).toFixed(0)}ms | Size: ${(parallelBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   --> SPEEDUP: ${(tEndSerial - tStartSerial) / (tEndParallel - tStartParallel)}x faster! Payload size reduced by ${((1 - parallelBytes / serialBytes) * 100).toFixed(1)}%!`);
}

main().catch(console.error);
