import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  const { count: totalJobs } = await supabase.from('scraped_jobs').select('*', { count: 'exact', head: true });
  const { count: wiproJobs } = await supabase.from('scraped_jobs').select('*', { count: 'exact', head: true }).ilike('company', '%wipro%');

  console.log(`Total jobs in DB: ${totalJobs}`);
  console.log(`Wipro jobs in DB: ${wiproJobs}`);
  console.log(`Non-Wipro jobs: ${(totalJobs || 0) - (wiproJobs || 0)}`);

  // Check company_ats_config
  const { data: configs } = await supabase
    .from('company_ats_config')
    .select('company_name, provider, last_scraped_at, jobs_found')
    .order('jobs_found', { ascending: false, nullsFirst: false })
    .limit(20);

  console.log('\nTop 20 configs by jobs_found:');
  console.table(configs);
}

main().catch(console.error);
