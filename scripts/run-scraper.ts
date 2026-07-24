import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getScraper } from '../lib/scrapers/registry';
import { isIndianOrIndianRemote } from '../lib/scrapers/utils';

// Load environment variables (for local runs)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.prod' }); // fallback

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials! Please provide NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isJuniorJob(title: string, description: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  const d = description ? description.toLowerCase() : "";
  
  const badTitles = ["intern", "trainee", "fresher", "junior", "jr", "student"];
  if (badTitles.some(bt => t.includes(bt) || t === bt)) return true;
  
  if (d.includes("0-1 years") || d.includes("0 to 1 years") || d.includes("freshers eligible")) {
    return true;
  }
  
  return false;
}

async function runScraper() {
  console.log("==========================================");
  console.log("Starting GitHub Actions Job Scraper");
  console.log("==========================================");
  
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalAdded = 0;
  
  // 1. Fetch all active companies to scrape
  const { data: companies, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status")
    .order("last_scraped_at", { ascending: true, nullsFirst: true });
    
  if (error || !companies || companies.length === 0) {
    console.error("Failed to fetch companies or no companies found:", error);
    process.exit(1);
  }

  console.log(`Found ${companies.length} companies to scrape. Processing sequentially...`);
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // 2. Loop through companies sequentially
  for (const config of companies) {
    console.log(`\n------------------------------------------`);
    console.log(`Running for ${config.company_name} Org`);
    
    const scraper = getScraper(config.company_name, config);
    if (!scraper) {
      console.warn(`No scraping strategy found for company: ${config.company_name}`);
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Failed: No scraping strategy registered for '${config.company_name}'.`
        })
        .eq("company_name", config.company_name);
      continue;
    }

    let jobs: any[] = [];
    try {
      jobs = await scraper.scrape();
    } catch (err: any) {
      console.error(`Failed to fetch jobs for ${config.company_name}:`, err.message);
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Failed to scrape: ${err.message}`
        })
        .eq("company_name", config.company_name);
      continue;
    }

    let companyProcessed = 0;
    let companyAdded = 0;
    let companySkippedDate = 0;
    let companySkippedLocation = 0;
    let companySkippedExperience = 0;
    let companySkippedContent = 0;

    let jobsInLastWeek = 0;
    for (const job of jobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate >= oneWeekAgo) {
          jobsInLastWeek++;
        }
      }
    }
    console.log(`- Fetched ${jobs.length} total expected jobs from ATS`);
    console.log(`- ${jobsInLastWeek} Job posts in last 1 week`);

    let jobIndex = 0;
    const totalJobsInCompany = jobs.length;

    for (const job of jobs) {
      jobIndex++;
      if (jobIndex % 5 === 0 || jobIndex === totalJobsInCompany) {
        const percent = Math.round((jobIndex / totalJobsInCompany) * 100);
        console.log(`[${jobIndex}/${totalJobsInCompany}] (${percent}%) processing jobs for ${config.company_name}...`);
      }
      // 1. Date cut-off check
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < oneWeekAgo) {
          companySkippedDate++;
          continue;
        }
      }

      // 2. India Location check
      if (!isIndianOrIndianRemote(job.location)) {
        console.log(`- Skipped location check for job: "${job.title}", location: "${job.location}"`);
        companySkippedLocation++;
        continue;
      }

      // 3. Title/description completeness
      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
      const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided" && job.description !== "Full text of the job description";
      if (!hasTitle || !hasDesc) {
        companySkippedContent++;
        continue;
      }

      // 4. Experience check (no junior roles)
      if (isJuniorJob(job.title, job.description)) {
        companySkippedExperience++;
        continue;
      }

      // 4.5. URL validation check (reject hallucinated / 404 URLs)
      let urlIsValid = true;
      try {
        const urlRes = await fetch(job.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (urlRes.status === 404) {
          urlIsValid = false;
        }
      } catch (e: any) {
        // We only care about explicit 404s. If it times out or blocks HEAD, we assume it might be valid.
      }
      
      if (!urlIsValid) {
        console.log(`- Skipped fake/404 URL: ${job.url}`);
        companySkippedContent++;
        continue;
      }

      companyProcessed++;
      totalProcessed++;

      // 5. Generate Keywords & Embedding
      let embedding = null;
      let keywords: string[] = [];
      
      if (OPENAI_KEY) {
        try {
          const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000);

          // Keywords extraction
          const kwPrompt = `Extract 3 to 5 technical skills or buzzwords from the job. Return a JSON object with key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`;
          const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: kwPrompt }],
              response_format: { type: "json_object" }
            })
          });

          if (kwRes.ok) {
            const kwData = await kwRes.json();
            try {
              const parsed = JSON.parse(kwData.choices[0].message.content);
              keywords = Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[];
              if (!Array.isArray(keywords)) keywords = [];
            } catch(e) {}
          }

          // Embedding generation
          const embRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              input: textToEmbed,
              model: "text-embedding-3-small"
            })
          });

          if (embRes.ok) {
            const embData = await embRes.json();
            if (embData.data && embData.data.length > 0) {
              embedding = embData.data[0].embedding;
            }
          }
        } catch(e: any) {
          console.error(`AI processing error for ${job.title}:`, e.message);
        }
      } else {
        console.warn(`OPENAI_API_KEY missing, skipping embeddings for ${job.title}`);
      }

      const jobData = {
        company: config.company_name,
        title: job.title,
        location: job.location,
        url: job.url,
        description: job.description.substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at,
        embedding
      };

      let { error: insertError } = await supabase.from("scraped_jobs").upsert({
        ...jobData,
        keywords: keywords.slice(0, 5)
      }, { onConflict: "url" });

      if (insertError) {
        // Retry without keywords column
        const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
        insertError = retryError;
      }

      if (!insertError) {
        companyAdded++;
        totalAdded++;
        if (companyAdded % 3 === 0) {
          console.log(`- Extracted ${companyAdded} jobs -> ${companyAdded + 3} jobs ....`);
        }
      }
    }
    
    console.log(`- Extracted all ${companyAdded} jobs in ${config.company_name}`);

    // Update config metadata
    await supabase
      .from("company_ats_config")
      .update({
        last_scraped_at: new Date().toISOString(),
        total_jobs_found: jobs.length,
        scrape_notes: `Scraped ${jobs.length} total. Saved ${companyAdded}. Skipped: ${companySkippedDate} date, ${companySkippedLocation} loc, ${companySkippedExperience} exp, ${companySkippedContent} empty.`
      })
      .eq("company_name", config.company_name);
  }

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);
  
  // Update cron status pseudo-record
  await supabase.from("company_ats_config").upsert({
    company_name: "cron_status",
    provider: "cron_status",
    board_token_or_url: "cron_status",
    scrape_notes: `GitHub Actions Cron finished successfully. Processed: ${totalProcessed}. Added/Updated: ${totalAdded} in ${durationSeconds}s.`,
    last_scraped_at: new Date().toISOString(),
    total_jobs_found: totalProcessed
  }, { onConflict: "company_name" });

  console.log("==========================================");
  console.log(`Scraping Finished!`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Added/Updated: ${totalAdded}`);
  console.log(`Total Duration: ${durationSeconds}s`);
  console.log("==========================================");
}

runScraper();
