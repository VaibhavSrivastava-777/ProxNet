import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  console.log(`[purge-jobs] Starting cleanup of jobs older than: ${cutoffIso}`);

  // 1. Initial count
  const { count: initialTotal } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true });

  const { count: initialStale } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true })
    .lt('posted_at', cutoffIso);

  console.log(`[purge-jobs] Current total jobs in DB: ${initialTotal}`);
  console.log(`[purge-jobs] Stale jobs to purge (> 30 days): ${initialStale}`);

  if (!initialStale || initialStale === 0) {
    console.log('[purge-jobs] No stale jobs found. Database is already clean.');
    return;
  }

  let totalPurged = 0;
  let batchIndex = 0;
  const batchLimit = 500;

  while (true) {
    batchIndex++;
    
    // Direct delete with order and limit
    const { data: deletedBatch, error: deleteErr } = await supabase
      .from('scraped_jobs')
      .delete()
      .lt('posted_at', cutoffIso)
      .order('id', { ascending: true })
      .select('id')
      .limit(batchLimit);

    if (deleteErr) {
      console.error('[purge-jobs] Direct delete error:', deleteErr);
      
      // Fallback: chunk IDs in groups of 100 to avoid URL length limit
      console.log('[purge-jobs] Attempting ID-chunked delete fallback...');
      const { data: staleRows, error: fetchErr } = await supabase
        .from('scraped_jobs')
        .select('id')
        .lt('posted_at', cutoffIso)
        .order('id', { ascending: true })
        .limit(batchLimit);

      if (fetchErr || !staleRows || staleRows.length === 0) {
        break;
      }

      const allIds = staleRows.map((r: { id: string }) => r.id);
      for (let i = 0; i < allIds.length; i += 100) {
        const chunk = allIds.slice(i, i + 100);
        const { error: chunkErr } = await supabase
          .from('scraped_jobs')
          .delete()
          .in('id', chunk);

        if (chunkErr) {
          console.error('[purge-jobs] Chunk delete error:', chunkErr);
          process.exit(1);
        }
        totalPurged += chunk.length;
      }
      console.log(`[purge-jobs] Batch ${batchIndex}: Purged ${allIds.length} jobs via chunks. (Total: ${totalPurged} / ${initialStale})`);
      continue;
    }

    const count = deletedBatch?.length || 0;
    totalPurged += count;
    console.log(`[purge-jobs] Batch ${batchIndex}: Purged ${count} jobs. (Total purged so far: ${totalPurged} / ${initialStale})`);

    if (count < batchLimit) {
      break;
    }
  }

  // Also check if any jobs with null posted_at and old created_at exist
  const { data: nullOldBatch, error: nullErr } = await supabase
    .from('scraped_jobs')
    .delete()
    .is('posted_at', null)
    .lt('created_at', cutoffIso)
    .order('id', { ascending: true })
    .select('id')
    .limit(batchLimit);

  if (!nullErr && nullOldBatch && nullOldBatch.length > 0) {
    totalPurged += nullOldBatch.length;
    console.log(`[purge-jobs] Purged ${nullOldBatch.length} jobs with NULL posted_at and old created_at.`);
  }

  // Final count verification
  const { count: finalTotal } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true });

  const { count: finalStale } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true })
    .lt('posted_at', cutoffIso);

  console.log('\n[purge-jobs] Summary:');
  console.log(`- Stale jobs successfully purged: ${totalPurged}`);
  console.log(`- Remaining total jobs in DB: ${finalTotal}`);
  console.log(`- Remaining stale jobs in DB: ${finalStale} (Expected: 0)`);
}

main().catch(err => {
  console.error('Fatal error during purge:', err);
  process.exit(1);
});
