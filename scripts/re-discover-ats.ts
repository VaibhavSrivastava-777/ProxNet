import { createClient } from "@supabase/supabase-js";
import { discoverAts } from "../lib/ats-discovery";
import { getScraper } from "../lib/scrapers/registry";
import fs from "fs";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: companies, error } = await supabase.from('company_ats_config').select('*');
  if (error || !companies) {
    console.error("Failed to fetch companies:", error);
    return;
  }

  const results = [];

  for (const company of companies) {
    console.log(`\nAnalyzing ${company.company_name}...`);
    const oldProvider = company.provider;
    
    let domain = "";
    try {
      if (company.board_token_or_url && company.board_token_or_url.startsWith('http')) {
        domain = new URL(company.board_token_or_url).hostname;
      }
    } catch(e) {}

    let discovered = await discoverAts(company.company_name);
    
    // Check SuccessFactors specifically for custom ones if not found
    if (!discovered && domain && company.provider === 'custom') {
      try {
        console.log(`  -> Probing ${domain} for SuccessFactors sitemap...`);
        const r = await fetch(`https://${domain}/sitemap.xml`);
        if (r.ok) {
           const text = await r.text();
           if (text.includes('successfactors') || text.includes('sitemap')) {
             discovered = { provider: 'successfactors_sitemap', board: `https://${domain}/sitemap.xml` };
           }
        }
      } catch(e) {}
    }

    let updated = false;
    if (discovered && discovered.provider !== 'custom') {
      if (discovered.provider !== company.provider || discovered.board !== company.board_token_or_url) {
         console.log(`  -> Found better provider: ${discovered.provider} (${discovered.board})`);
         await supabase.from('company_ats_config').update({
           provider: discovered.provider,
           board_token_or_url: discovered.board
         }).eq('company_name', company.company_name);
         
         updated = true;
         company.provider = discovered.provider;
         company.board_token_or_url = discovered.board;
      }
    }

    console.log(`  -> Using provider: ${company.provider} | Board: ${company.board_token_or_url}`);
    
    let jobCount = 0;
    try {
      const scraper = getScraper(company.company_name, company);
      if (scraper) {
         const jobs = await scraper.scrape();
         jobCount = jobs.length;
         console.log(`  -> SUCCESS: Scraped ${jobCount} jobs.`);
      } else {
         console.log(`  -> No scraper found.`);
      }
    } catch(e: any) {
      console.log(`  -> FAILED to scrape: ${e.message}`);
    }

    results.push({
      company: company.company_name,
      oldProvider: oldProvider,
      newProvider: company.provider,
      updated: updated,
      jobsFound: jobCount
    });
  }

  // Write markdown report
  let md = "# ATS Re-Discovery & Scraper Test Report\n\n";
  md += "| Company | Old Provider | New Provider | Jobs Found | Config Updated? |\n";
  md += "|---|---|---|---|---|\n";
  for (const r of results) {
    const updatedStr = r.updated ? '✅ Yes' : 'No';
    md += `| ${r.company} | ${r.oldProvider} | ${r.newProvider} | ${r.jobsFound} | ${updatedStr} |\n`;
  }
  
  fs.writeFileSync('ats-rediscovery-report.md', md);
  console.log("\nDone! Report written to ats-rediscovery-report.md");
}

main();
