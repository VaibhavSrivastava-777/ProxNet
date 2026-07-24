import { createClient } from "@supabase/supabase-js";
import { getScraper } from "../lib/scrapers/registry";

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testScrapers() {
  console.log("Fetching companies...");
  const { data: companies, error } = await supabase
    .from("company_ats_config")
    .select("*");

  if (error || !companies) {
    console.error("Failed to fetch companies", error);
    process.exit(1);
  }

  // Filter out cron_status if present
  const validCompanies = companies.filter(c => c.company_name !== "cron_status");
  console.log(`Found ${validCompanies.length} companies to test.`);

  let totalJobs = 0;
  let successfulCompanies = 0;
  
  const results: any = [];

  for (const config of validCompanies) {
    console.log(`\nTesting ${config.company_name}...`);
    const scraper = getScraper(config.company_name, config);
    
    if (!scraper) {
      console.log(`❌ No scraper found for ${config.company_name}`);
      results.push({ company: config.company_name, status: "NO_SCRAPER", jobs: 0 });
      continue;
    }

    try {
      const jobs = await scraper.scrape();
      const jobCount = jobs.length;
      
      console.log(`✅ Success for ${config.company_name}. Found ${jobCount} jobs.`);
      
      if (jobCount > 0) {
        successfulCompanies++;
        totalJobs += Math.min(10, jobCount);
        
        console.log(`First 3 jobs for ${config.company_name}:`);
        for (let i = 0; i < Math.min(3, jobCount); i++) {
            console.log(`  - [${jobs[i].posted_at}] ${jobs[i].title} (${jobs[i].location})`);
        }
      }

      results.push({ company: config.company_name, status: "SUCCESS", jobs: jobCount, firstFew: jobs.slice(0, 10) });
    } catch (err: any) {
      console.log(`❌ Failed for ${config.company_name}: ${err.message}`);
      results.push({ company: config.company_name, status: "FAILED", error: err.message, jobs: 0 });
    }
  }

  console.log(`\n==========================================`);
  console.log(`Test Complete!`);
  console.log(`Successfully fetched jobs for ${successfulCompanies}/${validCompanies.length} companies.`);
  console.log(`Total jobs fetched (max 10 per company): ${totalJobs}`);
  console.log(`==========================================`);
  
  // Write full results to JSON file
  const fs = require('fs');
  fs.writeFileSync('scraper-test-results.json', JSON.stringify(results, null, 2));
  console.log('Detailed results written to scraper-test-results.json');
}

testScrapers();
