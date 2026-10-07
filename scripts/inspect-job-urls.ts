import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data: sampleJobs, error } = await supabase
    .from('scraped_jobs')
    .select('id, company, title, url, description, posted_at')
    .limit(200);

  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  const jobsWithDesc = (sampleJobs || []).filter(j => j.description && j.description.length > 200);
  console.log(`Out of ${sampleJobs.length} jobs, ${jobsWithDesc.length} have descriptions > 200 chars.`);

  for (const j of jobsWithDesc.slice(0, 10)) {
    console.log(`\nCompany: ${j.company} | Title: ${j.title}`);
    console.log(`URL: ${j.url}`);
    console.log(`Desc length: ${j.description?.length} chars`);
    
    // Check if URL is responsive or 404
    try {
      const res = await fetch(j.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
      console.log(`HEAD status: ${res.status} | Final URL: ${res.url}`);
    } catch (e: any) {
      console.log(`Fetch error: ${e.message}`);
    }
  }
}

main().catch(console.error);
