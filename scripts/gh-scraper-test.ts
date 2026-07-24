import { getScraper } from '../lib/scrapers/registry';

async function runTest() {
  console.log("Starting scraping test for 3 random companies...");
  const startTime = Date.now();

  const companies = [
    { company_name: "Kotak Mahindra Bank Ltd", provider: "custom", board_token_or_url: "" },
    { company_name: "Cognizant Technology Solutions", provider: "custom", board_token_or_url: "" },
    { company_name: "Wipro", provider: "custom", board_token_or_url: "" }
  ];

  console.log(`Selected companies: ${companies.map(c => c.company_name).join(', ')}`);

  for (const config of companies) {
    console.log(`\n--- Scraping ${config.company_name} ---`);
    const compStartTime = Date.now();
    const scraper = getScraper(config.company_name, config);
    
    if (!scraper) {
      console.log(`No scraper found for ${config.company_name}`);
      continue;
    }

    try {
      const jobs = await scraper.scrape();
      console.log(`Successfully extracted ${jobs.length} raw jobs.`);
    } catch (err: any) {
      console.error(`Failed to scrape ${config.company_name}:`, err.message);
    }
    
    const compEndTime = Date.now();
    console.log(`Time taken for ${config.company_name}: ${((compEndTime - compStartTime) / 1000).toFixed(2)}s`);
  }

  const endTime = Date.now();
  console.log(`\nTotal time taken for all 3 companies: ${((endTime - startTime) / 1000).toFixed(2)}s`);
}

runTest();
