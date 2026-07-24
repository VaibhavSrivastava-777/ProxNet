import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data: allJobs, error: allErr } = await supabase.from('scraped_jobs').select('company');
  if (allErr) {
    console.error(allErr);
    return;
  }
  const allCounts = allJobs.reduce((acc: any, job: any) => {
    const comp = job.company?.trim().toLowerCase();
    acc[comp] = (acc[comp] || 0) + 1;
    return acc;
  }, {});
  console.log("All Scraped Jobs Company Distribution:", allCounts);
}
main();
