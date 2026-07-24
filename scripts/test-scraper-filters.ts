import { createClient } from "@supabase/supabase-js";
import { getScraper } from "../lib/scrapers/registry";
import { isIndianOrIndianRemote } from "../lib/scrapers/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function isJuniorJob(title: string, description: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  const d = description ? description.toLowerCase() : "";
  const badTitles = ["intern", "trainee", "fresher", "junior", "jr", "student"];
  if (badTitles.some(bt => t.includes(bt) || t === bt)) return true;
  if (d.includes("0-1 years") || d.includes("0 to 1 years") || d.includes("freshers eligible")) return true;
  return false;
}

async function testFilters() {
  const { data: companies } = await supabase.from("company_ats_config").select("*");
  const validCompanies = companies!.filter(c => c.company_name !== "cron_status");
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let report = "# Scraper Filter Diagnostic Report\n\n";
  
  for (const config of validCompanies) {
    const scraper = getScraper(config.company_name, config);
    if (!scraper) continue;

    console.log(`Testing ${config.company_name}...`);

    try {
      const jobs = await scraper.scrape();
      if (jobs.length === 0) continue;

      report += `## ${config.company_name}\n`;
      report += `- **Total Raw Jobs Found:** ${jobs.length}\n`;
      
      const sample = jobs.slice(0, 5);
      report += `- **Evaluating first ${sample.length} jobs:**\n\n`;

      let passedCount = 0;

      for (const job of sample) {
        let reason = "✅ PASSED (Would be added!)";
        
        const jobDate = job.posted_at ? new Date(job.posted_at) : null;
        if (jobDate && !isNaN(jobDate.getTime()) && jobDate < oneWeekAgo) {
          reason = `❌ FAILED (Date: Too old - ${job.posted_at})`;
        } else if (!isIndianOrIndianRemote(job.location)) {
          reason = `❌ FAILED (Location: Not India or is Remote - "${job.location}")`;
        } else if (!job.title || !job.description) {
          reason = `❌ FAILED (Content: Missing title or description)`;
        } else if (isJuniorJob(job.title, job.description)) {
          reason = `❌ FAILED (Experience: Junior role)`;
        } else {
          passedCount++;
        }

        report += `  - **${job.title}**\n`;
        report += `    - Location: ${job.location}\n`;
        report += `    - Date: ${job.posted_at}\n`;
        report += `    - Result: ${reason}\n\n`;
      }
      
      report += `**Result:** ${passedCount}/${sample.length} jobs from the sample passed the filters.\n\n---\n`;
    } catch(e: any) {
        // Skip failures for this clean report
    }
  }

  const fs = require('fs');
  fs.writeFileSync('C:/Users/Swati/.gemini/antigravity-ide/brain/c0fa7788-3ca1-4551-ac77-2c3227cb6ca9/scraping_filter_report.md', report);
  console.log("Diagnostic complete. Report saved.");
}

testFilters();
