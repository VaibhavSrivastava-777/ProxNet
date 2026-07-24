import { createAdminClient } from './lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data: users, error: usersError } = await supabase.from('users').select('company').eq('is_blocked', false).not('company', 'is', null);
  console.log("Active Companies from users:", Array.from(new Set(users?.map(u => u.company.trim().toLowerCase()))));

  const { data: jobs, error } = await supabase.from('scraped_jobs').select('company_name').order('created_at', { ascending: false }).limit(100);
  if (error) {
    console.error(error);
    return;
  }
  
  const counts = jobs.reduce((acc: any, job: any) => {
    const comp = job.company_name?.trim().toLowerCase();
    acc[comp] = (acc[comp] || 0) + 1;
    return acc;
  }, {});

  console.log("Top 100 Scraped Jobs Company Distribution:", counts);

  const { data: allJobs, error: allErr } = await supabase.from('scraped_jobs').select('company_name');
  if (allErr) return;
  const allCounts = allJobs.reduce((acc: any, job: any) => {
    const comp = job.company_name?.trim().toLowerCase();
    acc[comp] = (acc[comp] || 0) + 1;
    return acc;
  }, {});
  console.log("All Scraped Jobs Company Distribution:", allCounts);
}

main();
