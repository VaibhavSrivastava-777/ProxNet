import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { STRATEGIES, stripHtml } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });

function isJuniorJob(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const d = description.toLowerCase();

  // If title explicitly says Senior, Principal, Lead, Staff, Director, Manager, VP, Architect, etc., it is NOT a junior job.
  const seniorKeywords = ["senior", "sr.", "sr ", "lead", "principal", "staff", "director", "manager", "architect", "head", "vp", "chief"];
  const isExplicitlySenior = seniorKeywords.some(kw => t.includes(kw));
  if (isExplicitlySenior) {
    return false;
  }

  // Check explicit junior titles
  const juniorTitles = ["junior", "jr.", "jr ", "intern", "trainee", "fresher", "entry-level", "entry level"];
  if (juniorTitles.some(kw => t.includes(kw))) {
    return true;
  }

  // Look for years of experience mentions in description:
  // e.g. "0-2 years", "1-2 years", "1+ years", "2+ years", "0 to 2 years", "1 to 2 years"
  const expRegexes = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?/gi,
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi,
    /min(?:imum)?\s*(\d+)\s*years?/gi
  ];

  for (const regex of expRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(d)) !== null) {
      const val1 = parseInt(match[1], 10);
      const val2 = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(val1)) {
        if (val2 !== null) {
          if (val2 < 3) {
            return true;
          }
        } else {
          if (val1 < 3) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!url || !key) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  if (!openaiKey) {
    console.error("Error: Missing OPENAI_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Parse command-line args
  const onlyProxNet = process.argv.includes("--only-proxnet");
  const companyArgIndex = process.argv.indexOf("--company");
  const companyFilter = companyArgIndex !== -1 ? process.argv[companyArgIndex + 1] : null;

  let dbQuery = supabase.from("company_ats_config").select("*").neq("provider", "cron_status");

  if (companyFilter) {
    console.log(`Filtering to company name: "${companyFilter}"`);
    dbQuery = dbQuery.ilike("company_name", companyFilter);
  } else if (onlyProxNet) {
    console.log("Filtering to ProxNet network companies only...");
    const { data: users } = await supabase.from("users").select("company");
    if (users && users.length > 0) {
      const proxNetCompanies = Array.from(new Set(users.map((u: any) => {
        if (!u.company) return "";
        const clean = u.company.trim();
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      }).filter(Boolean)));
      
      if (proxNetCompanies.length > 0) {
        dbQuery = dbQuery.in("company_name", proxNetCompanies);
      }
    }
  }

  console.log("Fetching ATS configurations from database...");
  const { data: configs, error: configsError } = await dbQuery;

  if (configsError) {
    console.error("Failed to fetch configs:", configsError.message);
    process.exit(1);
  }

  console.log(`Found ${configs.length} ATS configurations to scrape.`);

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  let totalProcessed = 0;
  let totalAdded = 0;

  for (const config of configs) {
    let jobs: any[] = [];
    console.log(`\nScraping jobs for ${config.company_name} (${config.provider})...`);

    const strategy = STRATEGIES[config.provider];
    if (!strategy) {
      console.error(`  ⚠️ No strategy registered for provider: ${config.provider}`);
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Failed: No scraping strategy registered for provider '${config.provider}'.`
        })
        .eq("company_name", config.company_name);
      continue;
    }

    try {
      jobs = await strategy(config.board_token_or_url, config.company_name);
    } catch (e: any) {
      console.error(`Error fetching jobs for ${config.company_name}:`, e.message);
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Failed to scrape: ${e.message}`
        })
        .eq("company_name", config.company_name);
      continue;
    }

    console.log(`Found ${jobs.length} total postings. Processing & upserting...`);

    let companyProcessed = 0;
    let companyAdded = 0;
    let companySkippedDate = 0;
    let companySkippedLocation = 0;
    let companySkippedExperience = 0;
    let companySkippedContent = 0;

    for (const job of jobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) {
          console.log(`  [SKIP] "${job.title}" (${job.location}) - Posted over 2 weeks ago (posted: ${job.posted_at})`);
          companySkippedDate++;
          continue;
        }
      }

      const loc = job.location ? job.location.toLowerCase() : "";
      const isIndiaOrRemote = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => loc.includes(k));
      if (!isIndiaOrRemote) {
        console.log(`  [SKIP] "${job.title}" (${job.location}) - Location does not match India or Remote criteria`);
        companySkippedLocation++;
        continue;
      }

      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
      const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided" && job.description !== "Full text of the job description";
      if (!hasTitle || !hasDesc) {
        console.log(`  [SKIP] "${job.title}" (${job.location}) - Missing or placeholder job title/description`);
        companySkippedContent++;
        continue;
      }

      if (isJuniorJob(job.title, job.description)) {
        console.log(`  [SKIP] "${job.title}" (${job.location}) - Skipped junior role (< 3 years experience required)`);
        companySkippedExperience++;
        continue;
      }

      console.log(`\n[PROCESSING] "${job.title}" (${job.location}) - URL: ${job.url}`);
      companyProcessed++;
      totalProcessed++;

      let embedding = null;
      let keywords: string[] = [];
      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000); 
        
        // 1. Keywords
        console.log(`  [OPENAI] Extracting keywords for "${job.title}"...`);
        const keywordPrompt = `Extract 3 to 5 highly relevant technical skills, tools, or buzzwords (e.g., "React", "Python", "B2B Sales") from the following job posting. Return a JSON object with a single key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`;
        const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: keywordPrompt }],
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(15000)
        });
        
        if (kwRes.ok) {
          const kwData = await kwRes.json();
          try {
            const parsed = JSON.parse(kwData.choices[0].message.content);
            keywords = Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[];
            if (!Array.isArray(keywords)) keywords = [];
            console.log(`  [OPENAI] Keywords extracted: ${JSON.stringify(keywords)}`);
          } catch(e) {}
        } else {
          console.warn(`  ⚠️ [OPENAI] Failed to extract keywords. Status: ${kwRes.status}`);
        }

        // 2. Embedding
        console.log(`  [OPENAI] Generating embedding for "${job.title}"...`);
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: textToEmbed,
            model: "text-embedding-3-small"
          }),
          signal: AbortSignal.timeout(15000)
        });
        
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          if (oaiData.data && oaiData.data.length > 0) {
            embedding = oaiData.data[0].embedding;
            console.log(`  [OPENAI] Embedding generated successfully.`);
          }
        } else {
          console.warn(`  ⚠️ [OPENAI] Failed to generate embedding. Status: ${oaiRes.status}`);
        }
      } catch(e: any) {
        console.error(`OpenAI processing failed for "${job.title}":`, e.message);
      }

      const jobData: any = {
        company: config.company_name,
        title: job.title,
        location: job.location,
        url: job.url,
        description: job.description.substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at,
        embedding: embedding
      };

      console.log(`  [DB] Upserting job into Supabase...`);
      let { error: insertError } = await supabase.from("scraped_jobs").upsert({
        ...jobData,
        keywords: keywords.slice(0, 5)
      }, { onConflict: "url" });
      
      if (insertError) {
        const errMsg = insertError.message || "";
        if (errMsg.includes("keywords") || errMsg.includes("column")) {
          console.log(`  [DB RETRY] Retrying upsert without keywords column...`);
          const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
          insertError = retryError;
        }
      }

      if (!insertError) {
        console.log(`  ✅ Successfully saved job "${job.title}" to DB`);
        companyAdded++;
        totalAdded++;
      } else {
        console.error(`  ❌ Failed to insert job "${job.title}" to DB:`, insertError.message);
      }
    }

    console.log(`\n  [SUMMARY for ${config.company_name}]`);
    console.log(`    Total checked: ${jobs.length}`);
    console.log(`    Skipped (date filter): ${companySkippedDate}`);
    console.log(`    Skipped (location filter): ${companySkippedLocation}`);
    console.log(`    Skipped (experience filter): ${companySkippedExperience}`);
    console.log(`    Skipped (content filter): ${companySkippedContent}`);
    console.log(`    Processed (AI embeddings): ${companyProcessed}`);
    console.log(`    Successfully saved/updated: ${companyAdded}`);

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

  console.log(`\n🎉 Finished Scraping All Configs!`);
  console.log(`  Total Processed across all companies: ${totalProcessed}`);
  console.log(`  Total Successfully Added/Updated: ${totalAdded}`);
}

main();
