import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createAdminClient } from '../lib/supabase/admin';
import { isIndiaLocation } from '../lib/jobs/job-filters';

async function purgeForeignJobs() {
  const supabase = createAdminClient();
  console.log("=== Purging Foreign / USA Jobs from scraped_jobs ===");

  const { data: allJobs, error } = await supabase
    .from('scraped_jobs')
    .select('id, title, location, company, description');

  if (error || !allJobs) {
    console.error("Error fetching jobs:", error);
    process.exit(1);
  }

  console.log(`Total jobs currently in DB: ${allJobs.length}`);

  const toDeleteIds: string[] = [];
  const foreignSamples: any[] = [];

  for (const job of allJobs) {
    const isIndia = isIndiaLocation(job.location, job.description, job.title);
    if (!isIndia) {
      toDeleteIds.push(job.id);
      if (foreignSamples.length < 15) {
        foreignSamples.push({ company: job.company, title: job.title, location: job.location });
      }
    }
  }

  console.log(`Identified ${toDeleteIds.length} foreign / non-India jobs to purge.`);
  if (foreignSamples.length > 0) {
    console.log("Sample jobs being removed:");
    console.table(foreignSamples);
  }

  if (toDeleteIds.length === 0) {
    console.log("No foreign jobs found. Database is already clean!");
    return;
  }

  // Delete in batches of 50
  let deletedCount = 0;
  for (let i = 0; i < toDeleteIds.length; i += 50) {
    const batch = toDeleteIds.slice(i, i + 50);
    const { error: delErr } = await supabase
      .from('scraped_jobs')
      .delete()
      .in('id', batch);

    if (delErr) {
      console.error(`Error deleting batch ${i}-${i + 50}:`, delErr.message);
    } else {
      deletedCount += batch.length;
    }
  }

  console.log(`Successfully purged ${deletedCount} foreign jobs from scraped_jobs.`);

  // Verify remaining count
  const { count: remainingCount } = await supabase
    .from('scraped_jobs')
    .select('*', { count: 'exact', head: true });

  console.log(`Remaining clean India jobs in DB: ${remainingCount}`);
}

purgeForeignJobs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
