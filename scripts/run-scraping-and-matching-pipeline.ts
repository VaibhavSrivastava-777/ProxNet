import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { STRATEGIES } from "../lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle, isSameCompany } from "../lib/jobs/job-filters";
import { rerankJobsForCandidate } from "../lib/jobs/reranker";

interface ScrapeStats {
  company: string;
  provider: string;
  rawFound: number;
  eligible: number;
  saved: number;
  status: string;
}

interface MatchStats {
  userId: string;
  userName: string;
  userRole: string;
  userCompany: string;
  totalCandidatesEvaluated: number;
  matches: Array<{
    jobId: string;
    title: string;
    company: string;
    score: number;
    label: string;
    reason: string;
  }>;
}

async function runPipeline() {
  console.log("================================================================================");
  console.log("🚀 PROXNET PIPELINE: LIVE SCRAPING & AI MATCHING ENGINE");
  console.log("================================================================================\n");

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    console.error("❌ Missing OPENAI_API_KEY in environment variables.");
    process.exit(1);
  }

  // ===========================================================================
  // PHASE 1: SCRAPING ENGINE
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("📡 PHASE 1: RUNNING SCRAPING ON PROXNET COMPANIES & COMPETITORS");
  console.log("--------------------------------------------------------------------------------");

  // Fetch active company ATS configs
  const { data: configs, error: configErr } = await supabase
    .from("company_ats_config")
    .select("*")
    .not("provider", "in", '("none","error","cron_status")')
    .order("last_scraped_at", { ascending: true, nullsFirst: true })
    .limit(10); // Process batch of active companies

  if (configErr || !configs || configs.length === 0) {
    console.warn("⚠️ No active company ATS configs found.");
  } else {
    console.log(`Found ${configs.length} company ATS targets in this batch:\n` +
      configs.map(c => `  • ${c.company_name} (${c.provider}) -> ${c.board_token_or_url}`).join("\n") + "\n"
    );
  }

  const scrapeReports: ScrapeStats[] = [];
  let totalJobsScraped = 0;
  let totalJobsSaved = 0;

  for (const config of configs || []) {
    const strategy = STRATEGIES[config.provider];
    if (!strategy) {
      scrapeReports.push({
        company: config.company_name,
        provider: config.provider,
        rawFound: 0,
        eligible: 0,
        saved: 0,
        status: `No strategy for provider: ${config.provider}`,
      });
      continue;
    }

    console.log(`⏳ Scraping ${config.company_name} using [${config.provider}] strategy...`);
    let rawJobs: any[] = [];

    try {
      rawJobs = await strategy(config.board_token_or_url || "", config.company_name);
    } catch (err: any) {
      console.warn(`   ⚠️ Scraper error for ${config.company_name}:`, err.message);
      scrapeReports.push({
        company: config.company_name,
        provider: config.provider,
        rawFound: 0,
        eligible: 0,
        saved: 0,
        status: `Error: ${err.message}`,
      });
      continue;
    }

    totalJobsScraped += rawJobs.length;

    // Filter eligible jobs
    const eligibleJobs = rawJobs.filter((job) => {
      const { eligible } = isJobEligible({
        title: job.title,
        location: job.location,
        description: job.description,
        posted_at: job.posted_at,
      });
      return eligible;
    });

    console.log(`   Found ${rawJobs.length} raw listings -> ${eligibleJobs.length} eligible India/Remote listings.`);

    // Check existing jobs in database to avoid duplicate work
    const { data: existingJobs } = await supabase
      .from("scraped_jobs")
      .select("url, title")
      .ilike("company", config.company_name);

    const existingUrls = new Set((existingJobs || []).map((r) => normalizeJobUrl(r.url)));
    const existingTitles = new Set((existingJobs || []).map((r) => normalizeJobTitle(r.title)));

    const toInsert = eligibleJobs.filter((j) => {
      const u = normalizeJobUrl(j.url || "");
      const t = normalizeJobTitle(j.title || "");
      return (!u || !existingUrls.has(u)) && (!t || !existingTitles.has(t));
    }).slice(0, 15); // Cap to 15 newest per company per run

    let savedThisCompany = 0;

    for (const job of toInsert) {
      let embedding: number[] | null = null;
      let keywords: string[] = [];

      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description || job.title}`.slice(0, 7500);

        // Embedding generation
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: textToEmbed,
            model: "text-embedding-3-small",
          }),
        });

        if (embRes.ok) {
          const embData = await embRes.json();
          embedding = embData.data?.[0]?.embedding || null;
        }

        // Keywords extraction
        const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: `Extract 3 to 5 key technical or domain skills from this job title and description. Return JSON: {"keywords": string[]}.\n\nJob Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${(job.description || job.title).slice(0, 1200)}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (kwRes.ok) {
          const kwData = await kwRes.json();
          try {
            const parsed = JSON.parse(kwData.choices[0].message.content);
            keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
          } catch {}
        }
      } catch (err: any) {
        console.warn(`   ⚠️ AI enrichment warning:`, err.message);
      }

      const jobRecord = {
        company: config.company_name,
        title: job.title,
        location: job.location || "India",
        url: job.url,
        description: (job.description || job.title).substring(0, 5000),
        posted_at: job.posted_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
        embedding,
        keywords: keywords.slice(0, 5),
      };

      const { error: insErr } = await supabase.from("scraped_jobs").upsert(jobRecord, {
        onConflict: "url",
      });

      if (!insErr) {
        savedThisCompany++;
      } else {
        console.warn(`   ⚠️ Insert error:`, insErr.message);
      }
    }

    totalJobsSaved += savedThisCompany;

    // Update config record
    await supabase
      .from("company_ats_config")
      .update({
        total_jobs_found: rawJobs.length,
        last_scraped_at: new Date().toISOString(),
        scrape_notes: `Scraped ${rawJobs.length} raw, saved ${savedThisCompany} new eligible listings.`,
      })
      .eq("id", config.id);

    scrapeReports.push({
      company: config.company_name,
      provider: config.provider,
      rawFound: rawJobs.length,
      eligible: eligibleJobs.length,
      saved: savedThisCompany,
      status: `Success (${savedThisCompany} new saved)`,
    });

    console.log(`   ✅ Saved ${savedThisCompany} new jobs for ${config.company_name}.\n`);
  }

  // ===========================================================================
  // PHASE 2: MATCHING ENGINE
  // ===========================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("🧠 PHASE 2: RUNNING AI VECTOR MATCHING & RERANKING FOR PROXNET MEMBERS");
  console.log("--------------------------------------------------------------------------------");

  // Query sample active users across diverse roles
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, professional_bio, resume_text, profile_digest, embedding, tags")
    .eq("is_blocked", false)
    .not("job_title", "is", null)
    .limit(5);

  if (uErr || !users || users.length === 0) {
    console.error("❌ Failed to fetch users for matching:", uErr);
    process.exit(1);
  }

  console.log(`Evaluating matches for ${users.length} representative ProxNet members...\n`);

  const matchReports: MatchStats[] = [];

  for (const user of users) {
    console.log(`🎯 Evaluating matches for: ${user.full_name} (${user.job_title} @ ${user.company || "Independent"})`);
    let userEmbedding = user.embedding;

    // Generate embedding if missing
    if (!userEmbedding && openaiKey) {
      const denseContext = user.resume_text
        ? `Resume: ${user.resume_text}`
        : `About: ${user.about || user.professional_bio || "None"}`;
      const textToEmbed = `Company: ${user.company || "None"}\nRole: ${user.job_title || "None"}\n${denseContext}`.slice(0, 8000);

      try {
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            input: textToEmbed,
            model: "text-embedding-3-small",
          }),
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          userEmbedding = oaiData.data[0]?.embedding;
          if (userEmbedding) {
            await supabase.from("users").update({ embedding: userEmbedding }).eq("id", user.id);
            console.log(`   Generated & stored fresh vector embedding for user.`);
          }
        }
      } catch (err: any) {
        console.warn(`   ⚠️ User embedding generation warning:`, err.message);
      }
    }

    if (!userEmbedding) {
      console.log(`   Skipping user (no embedding available).\n`);
      continue;
    }

    // Step 2.1: Supabase pgvector RPC search
    const { data: matchedVectorJobs, error: matchRpcError } = await supabase.rpc("match_scraped_jobs", {
      query_embedding: userEmbedding,
      match_threshold: 0.25,
      match_count: 50,
    });

    if (matchRpcError) {
      console.warn(`   ⚠️ match_scraped_jobs RPC error:`, matchRpcError.message);
      continue;
    }

    const candidatePool = (matchedVectorJobs || []).filter((j: any) => {
      // Exclude jobs at candidate's own company
      if (user.company && j.company && j.company.toLowerCase().trim() === user.company.toLowerCase().trim()) {
        return false;
      }
      return true;
    });

    console.log(`   Vector retrieval returned ${matchedVectorJobs?.length || 0} jobs (${candidatePool.length} outside current company).`);

    if (candidatePool.length === 0) {
      console.log(`   No external candidate jobs found.\n`);
      continue;
    }

    // Diverse sample up to 10 jobs for intelligent reranking
    const companyCounts = new Map<string, number>();
    const diverseCandidatePool: any[] = [];
    for (const job of candidatePool) {
      const c = (job.company || "").toLowerCase().trim();
      const cnt = companyCounts.get(c) || 0;
      if (cnt < 2) {
        diverseCandidatePool.push(job);
        companyCounts.set(c, cnt + 1);
      }
      if (diverseCandidatePool.length >= 10) break;
    }

    // Step 2.2: Intelligent Reranking
    const candidateProfile = {
      id: user.id,
      job_title: user.job_title,
      company: user.company,
      about: user.about || user.professional_bio,
      resume_text: user.resume_text,
      profile_digest: user.profile_digest,
      tags: user.tags,
    };

    const jobsToRerank = diverseCandidatePool.map((j: any) => ({
      id: j.id,
      title: j.title || "",
      company: j.company || "",
      location: j.location,
      description: j.description,
      keywords: j.keywords || [],
      posted_at: j.posted_at,
      url: j.url,
      rawSimilarity: j.similarity,
    }));

    const rerankedMap = await rerankJobsForCandidate(candidateProfile, jobsToRerank);

    const userMatches: MatchStats["matches"] = [];

    for (const job of jobsToRerank) {
      const reranked = rerankedMap.get(job.id);
      if (reranked) {
        userMatches.push({
          jobId: job.id,
          title: job.title,
          company: job.company,
          score: reranked.score,
          label: reranked.label,
          reason: reranked.reason,
        });
      }
    }

    // Sort descending by score and select top 3 from strictly distinct companies
    userMatches.sort((a, b) => b.score - a.score);
    const top3DistinctMatches: typeof userMatches = [];
    for (const m of userMatches) {
      if (!m.company) continue;
      if (user.company && isSameCompany(m.company, user.company)) continue;
      const isDuplicate = top3DistinctMatches.some(t => isSameCompany(t.company, m.company));
      if (!isDuplicate) {
        top3DistinctMatches.push(m);
      }
      if (top3DistinctMatches.length >= 3) break;
    }

    matchReports.push({
      userId: user.id,
      userName: user.full_name || "Neighbor",
      userRole: user.job_title || "Professional",
      userCompany: user.company || "Independent",
      totalCandidatesEvaluated: jobsToRerank.length,
      matches: top3DistinctMatches,
    });

    console.log(`   Top Matches for ${user.full_name}:`);
    for (const m of top3DistinctMatches) {
      console.log(`     ⭐ [Score: ${m.score} | ${m.label}] ${m.title} @ ${m.company}`);
      console.log(`        Rationale: ${m.reason}`);
    }
    console.log();
  }

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log("================================================================================");
  console.log("📊 PIPELINE EXECUTION SUMMARY");
  console.log("================================================================================");
  console.log(`• Companies Processed: ${scrapeReports.length}`);
  console.log(`• Total Raw Listings Scraped: ${totalJobsScraped}`);
  console.log(`• Total New Jobs Saved with Embeddings: ${totalJobsSaved}`);
  console.log(`• Users Evaluated for Matchmaking: ${matchReports.length}`);
  console.log("================================================================================\n");

  // Verify scraped_jobs total in DB
  const { count: totalScrapedCount } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  console.log(`✅ Current total active scraped jobs in ProxNet database: ${totalScrapedCount}`);
}

runPipeline().catch((err) => {
  console.error("❌ Pipeline failed:", err);
  process.exit(1);
});
