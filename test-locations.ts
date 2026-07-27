import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.prod' });
import { getScraper } from './lib/scrapers/registry';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data } = await supabase.from('company_ats_config').select('*').in('company_name', ['Kotak Mahindra Bank Ltd', 'Cognizant Technology Solutions']);
  
  for (const config of data || []) {
    console.log("----");
    console.log(config.company_name);
    const scraper = getScraper(config.company_name, config);
    if (!scraper) continue;
    const jobs = await scraper.scrape();
    console.log(`Found ${jobs.length} jobs.`);
    jobs.forEach(j => {
      console.log(`Title: ${j.title}`);
      console.log(`Location: "${j.location}"`);
      console.log(`Posted: ${j.posted_at}`);
    });
  }
}
run();
