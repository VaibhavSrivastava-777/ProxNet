import { getScraper } from "../lib/scrapers/registry";

async function testEY() {
  const config = {
    company_name: "EY",
    provider: "successfactors_sitemap",
    board_token_or_url: "https://careers.ey.com/sitemap.xml",
  };
  
  const scraper = getScraper(config.company_name, config);
  if (!scraper) {
    console.log("No scraper found for this config");
    return;
  }
  
  console.log("Starting scrape for EY...");
  try {
    const jobs = await scraper.scrape();
    console.log(`Successfully scraped ${jobs.length} jobs.`);
    if (jobs.length > 0) {
      console.log("First 3 jobs:");
      console.log(jobs.slice(0, 3));
    }
  } catch (e: any) {
    console.error("Scrape failed:", e.message);
  }
}

testEY();
