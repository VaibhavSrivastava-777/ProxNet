import { createClient } from "@supabase/supabase-js";
import { getScraper } from "../lib/scrapers/registry";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function repair() {
  const { data: companies, error } = await supabase.from('company_ats_config').select('*').eq('provider', 'workday');
  if (error || !companies) return console.error(error);

  for (const company of companies) {
    console.log(`Checking Workday config for ${company.company_name}...`);
    try {
      const scraper = getScraper(company.company_name, company);
      if (scraper) {
         const jobs = await scraper.scrape();
         if (jobs.length > 0) {
           console.log(`  -> Valid Workday! Found ${jobs.length} jobs.`);
           continue;
         }
      }
    } catch(e: any) {
      console.log(`  -> Failed: ${e.message}`);
    }

    // If we reach here, it failed to scrape anything, so it's a fake workday URL from the 422 bug.
    console.log(`  -> Invalid Workday! Resetting to custom...`);
    await supabase.from('company_ats_config').update({
      provider: 'custom',
      board_token_or_url: ''
    }).eq('company_name', company.company_name);
  }
}

repair();
