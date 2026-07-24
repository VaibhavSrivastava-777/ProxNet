import { createClient } from "@supabase/supabase-js";
import { getScraper } from "../lib/scrapers/registry";
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.prod' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const testCompanies = [
    'Wells Fargo',
    'Capita',
    'NPS HSR School',
    'McKinsey & Company',
    'Rakuten India',
    'ThirdAct Labs Private Limited',
    'Applause',
    'Qorvo Semiconductor Private Limited',
    'Fitsol',
    'ECGC Limited'
  ];
  
  const { data: companies, error } = await supabase.from('company_ats_config').select('*').in('company_name', testCompanies).limit(10);
  if (error || !companies) return console.error(error);

  let report = "# Scraping Test Report\n\n| Company | Provider | Jobs Found | Status |\n|---|---|---|---|\n";

  for (const company of companies) {
    let count = 0;
    let status = "N/A";
    try {
      const scraper = getScraper(company.company_name, company);
      if (scraper) {
        const jobs = await scraper.scrape(10);
        count = jobs.length;
        if (count > 0) {
           status = "Success";
           console.log(`\n--- Sample Job for ${company.company_name} ---`);
           console.log(jobs[0]);
           console.log(`-----------------------------------\n`);
        } else {
           status = "Zero Jobs";
        }
      } else {
         status = "No Scraper Strategy";
      }
    } catch(e: any) {
      status = `Error: ${e.message.replace(/[\r\n]/g, " ")}`;
    }
    report += `| ${company.company_name} | ${company.provider} | ${count} | ${status} |\n`;
    console.log(`Tested ${company.company_name}: ${status}`);
  }

  fs.writeFileSync('scraping_test_results.md', report);
  console.log("Wrote scraping_test_results.md");
}

run();
