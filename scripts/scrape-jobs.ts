import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  STRATEGIES,
  stripHtml,
  usesFirecrawl,
  FirecrawlCreditsExhaustedError,
  FirecrawlRateLimitedError,
} from "../lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "../lib/jobs/job-filters";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * Fairness quota: maximum NEW jobs saved per company in a single daily run.
 *
 * Previously the round-robin loop kept cycling until EVERY company's pool was fully drained,
 * so round-robin only affected ordering, not volume. A single large India-heavy board
 * (e.g. Wipro, 5,000+ postings) therefore contributed ~97% of a day's inserts.
 * With this cap, no company can exceed this many new jobs per run; the remainder is picked
 * up on subsequent days (already-saved jobs are de-duplicated, so each run advances).
 */
const MAX_NEW_JOBS_PER_COMPANY_PER_RUN = Math.max(
  1,
  parseInt(process.env.SCRAPE_MAX_NEW_PER_COMPANY || "30", 10) || 30
);

interface CompanyPool {
  config: any;
  allJobs: any[];
  index: number;
  added: number;
  processed: number;
  skippedFilter: number;
  skippedDuplicate: number;
  existingUrls: Set<string>;
  existingTitles: Set<string>;
  seenBatchUrls: Set<string>;
  capped: boolean;
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

  // 1. Fetch ATS configurations in round-robin priority order (never scraped first, then oldest last_scraped_at)
  let dbQuery = supabase
    .from("company_ats_config")
    .select("*")
    .not("provider", "in", '("none","error","cron_status")')
    .order("last_scraped_at", { ascending: true, nullsFirst: true });

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

  console.log("Fetching ATS configurations from database in round-robin priority order...");
  const { data: configs, error: configsError } = await dbQuery;

  if (configsError) {
    console.error("Failed to fetch configs:", configsError.message);
    process.exit(1);
  }

  console.log(`Found ${configs?.length || 0} ATS configurations to scrape.`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  // 2. Build Company Pools by fetching raw postings from ATS
  console.log("\n==========================================");
  console.log("Building Company Pools from ATS endpoints...");
  console.log("==========================================");

  const pools: CompanyPool[] = [];

  // Circuit breaker: once Firecrawl is out of credits, stop calling it for the rest of the run.
  let firecrawlExhausted = false;
  let firecrawlDeferred = 0;

  for (const config of configs || []) {
    const needsFirecrawl = usesFirecrawl(config.provider, config.board_token_or_url);
    if (needsFirecrawl && firecrawlExhausted) {
      // Do NOT touch last_scraped_at: keep this company at the front of tomorrow's queue.
      firecrawlDeferred++;
      continue;
    }

    console.log(`Fetching jobs for ${config.company_name} [${config.provider}]...`);

    const strategy = STRATEGIES[config.provider];
    if (!strategy) {
      console.warn(`  ⚠️ No strategy registered for provider: ${config.provider}`);
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Failed: No scraping strategy registered for provider '${config.provider}'.`
        })
        .eq("company_name", config.company_name);
      continue;
    }

    let jobs: any[] = [];
    try {
      jobs = await strategy(config.board_token_or_url, config.company_name);
    } catch (e: any) {
      console.error(`  Error fetching jobs for ${config.company_name}:`, e.message);

      if (e instanceof FirecrawlCreditsExhaustedError) {
        firecrawlExhausted = true;
        firecrawlDeferred++;
        console.error("  ⛔ Firecrawl credits exhausted — deferring all remaining Firecrawl-based companies to the next run.");
        await supabase
          .from("company_ats_config")
          .update({ scrape_notes: `Deferred: Firecrawl credits exhausted (${new Date().toISOString()}). Will retry next run.` })
          .eq("company_name", config.company_name);
        continue;
      }
      if (e instanceof FirecrawlRateLimitedError) {
        // Keep queue priority (no last_scraped_at bump) so it is retried first next run.
        await supabase
          .from("company_ats_config")
          .update({ scrape_notes: `Deferred: Firecrawl rate limited after retries (${new Date().toISOString()}).` })
          .eq("company_name", config.company_name);
        continue;
      }

      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_notes: `Failed to scrape: ${e.message}`
        })
        .eq("company_name", config.company_name);
      continue;
    }

    console.log(`  Found ${jobs.length} total postings from ${config.company_name} ATS.`);

    // Pre-fetch existing recent jobs for this company to check duplicates
    const { data: existingRows } = await supabase
      .from("scraped_jobs")
      .select("url, title")
      .ilike("company", config.company_name)
      .gte("posted_at", cutoffIso);

    const existingUrls = new Set((existingRows || []).map(r => normalizeJobUrl(r.url)));
    const existingTitles = new Set((existingRows || []).map(r => normalizeJobTitle(r.title)));

    pools.push({
      config,
      allJobs: jobs,
      index: 0,
      added: 0,
      processed: 0,
      skippedFilter: 0,
      skippedDuplicate: 0,
      existingUrls,
      existingTitles,
      seenBatchUrls: new Set<string>(),
      capped: false,
    });
  }

  // 3. Round-Robin Processing: 30 jobs per company per round, looping until all jobs are processed
  console.log(`\n==========================================`);
  console.log(`Starting Round-Robin Scraping (Batch size: 30 jobs per company per round)`);
  console.log(`==========================================`);

  const BATCH_SIZE = 30;
  let keepProcessing = true;
  let round = 1;
  let totalProcessed = 0;
  let totalAdded = 0;

  while (keepProcessing) {
    keepProcessing = false;
    let roundProcessedAny = false;

    console.log(`\n--- Round-Robin Pass #${round} ---`);

    for (const pool of pools) {
      if (pool.index >= pool.allJobs.length) continue;
      // Fairness quota reached: this company is done for today.
      if (pool.added >= MAX_NEW_JOBS_PER_COMPANY_PER_RUN) {
        pool.capped = true;
        continue;
      }

      keepProcessing = true;
      roundProcessedAny = true;

      const batch = pool.allJobs.slice(pool.index, pool.index + BATCH_SIZE);
      const endIndex = Math.min(pool.index + BATCH_SIZE, pool.allJobs.length);
      console.log(`\n[${pool.config.company_name}] (Round ${round}) Processing jobs ${pool.index + 1} to ${endIndex} of ${pool.allJobs.length}...`);

      let companyBatchAdded = 0;

      let consumed = 0;
      for (const job of batch) {
        if (pool.added >= MAX_NEW_JOBS_PER_COMPANY_PER_RUN) {
          pool.capped = true;
          break;
        }
        consumed++;
        // 1. Eligibility Check: 30-day age limit, India location, not junior
        const { eligible, reason } = isJobEligible({
          title: job.title,
          location: job.location,
          description: job.description,
          posted_at: job.posted_at,
        });

        if (!eligible) {
          pool.skippedFilter++;
          continue;
        }

        // 2. Duplicate Check
        const normUrl = normalizeJobUrl(job.url || "");
        const normTitle = normalizeJobTitle(job.title || "");
        if (normUrl && (pool.existingUrls.has(normUrl) || pool.seenBatchUrls.has(normUrl))) {
          pool.skippedDuplicate++;
          continue;
        }
        if (normTitle && pool.existingTitles.has(normTitle)) {
          pool.skippedDuplicate++;
          continue;
        }

        if (normUrl) pool.seenBatchUrls.add(normUrl);

        pool.processed++;
        totalProcessed++;

        // 3. AI Extraction & Embeddings
        let embedding = null;
        let keywords: string[] = [];
        try {
          const textToEmbed = `Title: ${job.title}\nCompany: ${pool.config.company_name}\nDescription: ${job.description || ""}`.slice(0, 8000);

          // Keyword extraction
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
            } catch {}
          }

          // OpenAI Embedding
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
          }
        } catch (aiErr: any) {
          console.warn(`    ⚠️ AI processing notice for "${job.title}":`, aiErr.message);
        }

        const jobData: any = {
          company: pool.config.company_name,
          title: job.title,
          location: job.location || "India",
          url: job.url,
          description: (job.description || "").substring(0, 5000),
          ats_source: job.source,
          posted_at: job.posted_at || new Date().toISOString(),
          embedding: embedding,
          created_at: new Date().toISOString(),
        };

        let { error: insertError } = await supabase.from("scraped_jobs").upsert({
          ...jobData,
          keywords: keywords.slice(0, 5)
        }, { onConflict: "url" });

        if (insertError) {
          const errMsg = insertError.message || "";
          if (errMsg.includes("keywords") || errMsg.includes("column")) {
            const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
            insertError = retryError;
          }
        }

        if (!insertError) {
          pool.added++;
          companyBatchAdded++;
          totalAdded++;
        }
      }

      pool.index += consumed;

      // Update config metadata after each batch to persist round-robin progress immediately
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          total_jobs_found: pool.allJobs.length,
          scrape_notes: `Round-robin (Round ${round}): Evaluated ${Math.min(pool.index, pool.allJobs.length)}/${pool.allJobs.length}. Saved ${pool.added}${pool.capped ? ` (daily cap ${MAX_NEW_JOBS_PER_COMPANY_PER_RUN} reached)` : ""}. Skipped: ${pool.skippedFilter} filtered, ${pool.skippedDuplicate} duplicate.`
        })
        .eq("company_name", pool.config.company_name);

      console.log(`  [${pool.config.company_name}] Batch complete! Saved ${companyBatchAdded} fresh jobs this round (Total saved: ${pool.added}).`);
    }

    if (!roundProcessedAny) break;
    round++;
  }

  // 4. Update global cron status for admin dashboard
  await supabase
    .from("company_ats_config")
    .upsert({
      company_name: "cron_status",
      provider: "cron_status",
      board_token_or_url: "cron_status",
      last_scraped_at: new Date().toISOString(),
      total_jobs_found: totalProcessed,
      scrape_notes: `Daily Morning Scraper finished. Processed: ${totalProcessed} postings across ${pools.length} companies in ${round - 1} rounds. Saved: ${totalAdded} fresh jobs (cap ${MAX_NEW_JOBS_PER_COMPANY_PER_RUN}/company; ${pools.filter((p) => p.capped).length} capped). Firecrawl: ${firecrawlExhausted ? `CREDITS EXHAUSTED, ${firecrawlDeferred} companies deferred` : "ok"}.`,
    }, { onConflict: "company_name" });

  console.log(`\n==========================================`);
  console.log(`🎉 Finished Scraping All Companies in Round-Robin Mode!`);
  console.log(`  Total Companies Scraped: ${pools.length}`);
  console.log(`  Total Rounds Completed: ${round - 1}`);
  console.log(`  Total Processed across all companies: ${totalProcessed}`);
  console.log(`  Total Successfully Added/Updated: ${totalAdded}`);
  console.log(`  Per-company cap: ${MAX_NEW_JOBS_PER_COMPANY_PER_RUN} (companies capped: ${pools.filter((p) => p.capped).length})`);
  if (firecrawlExhausted) {
    console.log(`  ⛔ Firecrawl credits exhausted: ${firecrawlDeferred} companies deferred to next run.`);
  }
  console.log(`==========================================`);
}

main().catch(console.error);
