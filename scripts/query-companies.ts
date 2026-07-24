import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  
  // 1. Get companies from users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('company, job_title')
    .eq('is_blocked', false)
    .not('company', 'is', null);
    
  if (usersError) {
    console.error("Users Error:", usersError);
    return;
  }
  
  const userCompanies = Array.from(new Set(users.map(u => u.company.trim().toLowerCase())));
  console.log(`Found ${userCompanies.length} distinct companies in users table:`);
  console.log(userCompanies);
  
  // 2. Get companies from scraped_jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('scraped_jobs')
    .select('company');
    
  if (jobsError) {
    console.error("Jobs Error:", jobsError);
    return;
  }
  
  const jobCompanies = Array.from(new Set(jobs.map(j => j.company?.trim().toLowerCase()).filter(Boolean)));
  console.log(`\nFound ${jobCompanies.length} distinct companies in scraped_jobs table:`);
  console.log(jobCompanies);
  
  // 3. Find intersection
  const intersection = userCompanies.filter(c => jobCompanies.includes(c));
  console.log(`\nIntersection (companies in BOTH users and scraped_jobs):`);
  console.log(intersection);
}

main();
