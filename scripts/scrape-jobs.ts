import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { STRATEGIES, stripHtml } from "../lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "../lib/jobs/job-filters";

dotenv.config({ path: ".env.local" });

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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

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

    console.log(`Found ${jobs.length} total postings. Pre-checking duplicates and filters...`);

    // Fetch existing recent jobs for this company
    const { data: existingRows } = await supabase
      .from("scraped_jobs")
      .select("url, title")
      .ilike("company", config.company_name)
      .gte("posted_at", cutoffIso);

    const existingUrls = new Set((existingRows || []).map(r => normalizeJobUrl(r.url)));
    const existingTitles = new Set((existingRows || []).map(r => normalizeJobTitle(r.title)));

    let companyProcessed = 0;
    let companyAdded = 0;
    let companySkippedFilter = 0;
    let companySkippedDuplicate = 0;
    const seenBatchUrls = new Set<string>();

    for (const job of jobs) {
      // 1. Eligibility Check: 30-day age limit, India location, not junior
      const { eligible, reason } = isJobEligible({
        title: job.title,
        location: job.location,
        description: job.description,
        posted_at: job.posted_at,
      });

      if (!eligible) {
        console.log(`  [SKIP FILTER] "${job.title}" (${job.location}) - ${reason}`);
        companySkippedFilter++;
        continue;
      }

      // 2. Duplicate Check: Before calling OpenAI
      const normUrl = normalizeJobUrl(job.url || "");
      const normTitle = normalizeJobTitle(job.title || "");
      if (normUrl && (existingUrls.has(normUrl) || seenBatchUrls.has(normUrl))) {
        console.log(`  [SKIP DUPLICATE] "${job.title}" (${job.location}) - URL already exists in database`);
        companySkippedDuplicate++;
        continue;
      }
      if (normTitle && existingTitles.has(normTitle)) {
        console.log(`  [SKIP DUPLICATE] "${job.title}" (${job.location}) - Title already exists for ${config.company_name}`);
        companySkippedDuplicate++;
        continue;
      }

      if (normUrl) seenBatchUrls.add(normUrl);

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
          embedding = oaiData.data[0].embedding;
          console.log(`  [OPENAI] Embedding generated successfully.`);
        } else {
          console.warn(`  ⚠️ [OPENAI] Failed to generate embedding. Status: ${oaiRes.status}`);
        }

      } catch (e: any) {
        console.error(`OpenAI processing failed for "${job.title}":`, e.message);
      }

      const jobData: any = {
        company: config.company_name,
        title: job.title,
        location: job.location || "India",
        url: job.url,
        description: (job.description || "").substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at || new Date().toISOString(),
        embedding: embedding,
        created_at: new Date().toISOString(),
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
    console.log(`    Skipped (filters - age/loc/seniority): ${companySkippedFilter}`);
    console.log(`    Skipped (duplicate URLs/titles): ${companySkippedDuplicate}`);
    console.log(`    Processed (AI embeddings): ${companyProcessed}`);
    console.log(`    Successfully saved/updated: ${companyAdded}`);

    // Update config metadata
    await supabase
      .from("company_ats_config")
      .update({
        last_scraped_at: new Date().toISOString(),
        total_jobs_found: jobs.length,
        scrape_notes: `Scraped ${jobs.length} total. Saved ${companyAdded}. Skipped: ${companySkippedFilter} filtered, ${companySkippedDuplicate} duplicate.`
      })
      .eq("company_name", config.company_name);
  }

  console.log(`\n🎉 Finished Scraping All Configs!`);
  console.log(`  Total Processed across all companies: ${totalProcessed}`);
  console.log(`  Total Successfully Added/Updated: ${totalAdded}`);
}

main();
