import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function balanceWipro() {
  const supabase = createAdminClient();

  console.log('=== Balancing Wipro Representation in scraped_jobs ===');

  // 1. Check applied job IDs to never delete them
  const { data: apps } = await supabase.from('job_applications').select('id, company, job_title');
  console.log(`Found ${apps?.length || 0} user job applications.`);

  // 2. Fetch all Wipro jobs ordered by posted_at descending
  // We want to keep top 50 freshest Wipro jobs
  const { data: freshestWipro, error: freshErr } = await supabase
    .from('scraped_jobs')
    .select('id, title, posted_at')
    .ilike('company', '%wipro%')
    .order('posted_at', { ascending: false })
    .limit(50);

  if (freshErr || !freshestWipro || freshestWipro.length === 0) {
    console.error('Error fetching freshest Wipro jobs:', freshErr);
    return;
  }

  const keepIds = new Set(freshestWipro.map(j => j.id));
  console.log(`Keeping ${keepIds.size} freshest Wipro jobs (newest: ${freshestWipro[0]?.posted_at}, oldest kept: ${freshestWipro[freshestWipro.length - 1]?.posted_at})`);

  // 3. Count total Wipro jobs
  const { count: totalWipro } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true })
    .ilike('company', '%wipro%');

  console.log(`Total Wipro jobs currently: ${totalWipro}`);

  if (!totalWipro || totalWipro <= 50) {
    console.log('Wipro is already balanced (<= 50 jobs). No pruning needed.');
    return;
  }

  // 4. Delete excess Wipro jobs in batches of 500
  let deletedTotal = 0;
  let batchNum = 0;
  const keepArray = Array.from(keepIds);

  while (true) {
    batchNum++;
    // Find a batch of Wipro jobs that are NOT in keepIds
    const { data: toDeleteBatch, error: fetchErr } = await supabase
      .from('scraped_jobs')
      .select('id')
      .ilike('company', '%wipro%')
      .not('id', 'in', `(${keepArray.join(',')})`)
      .limit(500);

    if (fetchErr) {
      console.error('Error fetching batch to delete:', fetchErr);
      break;
    }

    if (!toDeleteBatch || toDeleteBatch.length === 0) {
      console.log('No more excess Wipro jobs to delete.');
      break;
    }

    const idsToDelete = toDeleteBatch.map(r => r.id);
    const { error: delErr } = await supabase
      .from('scraped_jobs')
      .delete()
      .in('id', idsToDelete);

    if (delErr) {
      console.error('Error deleting batch:', delErr);
      break;
    }

    deletedTotal += idsToDelete.length;
    console.log(`Batch ${batchNum}: Deleted ${idsToDelete.length} excess Wipro jobs (Total deleted so far: ${deletedTotal})`);
  }

  // 5. Final count check
  const { count: remainingWipro } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true })
    .ilike('company', '%wipro%');

  const { count: totalRemaining } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true });

  console.log(`\n=== Pruning Complete ===`);
  console.log(`Remaining Wipro jobs: ${remainingWipro}`);
  console.log(`Total jobs in DB across all companies: ${totalRemaining}`);
}

balanceWipro().catch(console.error);
