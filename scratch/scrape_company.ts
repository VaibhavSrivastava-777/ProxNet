import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!url || !key || !openaiKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

const stripHtml = (html: string) => {
  if (!html) return "";
  let text = html.replace(/<[^>]*>?/gm, " ");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&ndash;/g, "-");
  text = text.replace(/&mdash;/g, "-");
  return text.replace(/\s+/g, " ").trim();
};

const fetchWithHeaders = (url: string, options: any = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...options.headers
    }
  });
};

async function run() {
  const companyName = process.argv[2];
  if (!companyName) {
    console.error("Please specify a company name (e.g. npx tsx scratch/scrape_company.ts Microsoft)");
    process.exit(1);
  }

  console.log(`🔎 Fetching ATS configuration for "${companyName}"...`);
  const { data: configs, error: configError } = await supabase
    .from("company_ats_config")
    .select("*")
    .ilike("company_name", companyName);

  if (configError) {
    console.error("DB Error:", configError.message);
    return;
  }

  if (!configs || configs.length === 0) {
    console.log(`❌ No configuration found for "${companyName}".`);
    return;
  }

  const config = configs[0];
  console.log(`✅ Config found: ID=${config.id}, Provider=${config.provider}, Token/URL=${config.board_token_or_url}`);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  let jobs: any[] = [];

  try {
    if (config.provider === 'greenhouse') {
      const targetUrl = `https://boards-api.greenhouse.io/v1/boards/${config.board_token_or_url}/jobs?content=true`;
      console.log(`  [FETCH] Starting Greenhouse download: ${targetUrl} (Timeout: 5m)...`);
      const res = await fetchWithHeaders(targetUrl, { signal: AbortSignal.timeout(300000) });
      console.log(`  [FETCH] Completed Greenhouse download. Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        for (const j of data.jobs || []) {
          jobs.push({
            title: j.title,
            location: j.location?.name || 'Remote',
            url: j.absolute_url,
            posted_at: j.updated_at,
            description: stripHtml(j.content || j.title),
            source: 'greenhouse'
          });
        }
      }
    } else if (config.provider === 'lever') {
      const targetUrl = `https://api.lever.co/v0/postings/${config.board_token_or_url}?mode=json`;
      console.log(`  [FETCH] Starting Lever download: ${targetUrl} (Timeout: 5m, payload can be large/throttled)...`);
      const res = await fetchWithHeaders(targetUrl, { signal: AbortSignal.timeout(300000) });
      console.log(`  [FETCH] Completed Lever download. Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        for (const j of data || []) {
          jobs.push({
            title: j.text,
            location: j.categories?.location || 'Remote',
            url: j.hostedUrl,
            posted_at: new Date(j.createdAt).toISOString(),
            description: j.descriptionPlain || j.text,
            source: 'lever'
          });
        }
      }
    } else if (config.provider === 'ashby') {
      const targetUrl = `https://api.ashbyhq.com/posting-api/job-board/${config.board_token_or_url}`;
      console.log(`  [FETCH] Starting Ashby download: ${targetUrl} (Timeout: 5m)...`);
      const res = await fetchWithHeaders(targetUrl, { signal: AbortSignal.timeout(300000) });
      console.log(`  [FETCH] Completed Ashby download. Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        for (const j of data.jobs || []) {
          jobs.push({
            title: j.title,
            location: j.location?.name || 'Remote',
            url: j.jobUrl,
            posted_at: j.publishedAt,
            description: stripHtml(j.descriptionHtml || j.descriptionPlain || ''),
            source: 'ashby'
          });
        }
      }
    } else if (config.provider === 'breezy') {
      const targetUrl = `https://${config.board_token_or_url}.breezy.hr/json`;
      console.log(`  [FETCH] Starting Breezy download: ${targetUrl} (Timeout: 5m)...`);
      const res = await fetchWithHeaders(targetUrl, { signal: AbortSignal.timeout(300000) });
      console.log(`  [FETCH] Completed Breezy download. Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        for (const j of (Array.isArray(data) ? data : [])) {
          jobs.push({
            title: j.name,
            location: j.location?.name || j.location?.city || 'Remote',
            url: j.url,
            posted_at: j.creation_date,
            description: stripHtml(j.description || ''),
            source: 'breezy'
          });
        }
      }
    } else if (config.provider === 'custom') {
      const targetUrl = config.board_token_or_url;
      console.log(`  [CUSTOM] Crawling custom URL: ${targetUrl} (Timeout: 5m)...`);
      const res = await fetchWithHeaders(targetUrl, { signal: AbortSignal.timeout(300000) });
      console.log(`  [CUSTOM] Completed custom download. Status: ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        const plainText = stripHtml(html).substring(0, 15000);

        console.log(`  [CUSTOM] Webpage content fetched (${plainText.length} chars). Extracting jobs using OpenAI...`);
        const prompt = `Extract the core job details from the following webpage text. Return ONLY valid JSON.
Schema:
{
  "title": "Job Title",
  "location": "Job Location (or Remote)",
  "description": "Full text of the job description"
}

Webpage Text:
${plainText}`;

        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const extracted = JSON.parse(oaiData.choices[0].message.content);
          if (extracted && extracted.title && extracted.title !== "Job Title" && extracted.title !== "Unknown Title") {
            jobs.push({
              title: extracted.title,
              location: extracted.location || "Remote",
              url: config.board_token_or_url,
              posted_at: new Date().toISOString(),
              description: extracted.description || "No description provided",
              source: 'custom_ai'
            });
          }
        }
      }
    }
  } catch (e: any) {
    console.error("Fetch failed:", e.message);
    return;
  }

  console.log(`Found ${jobs.length} total postings. Processing & upserting...`);
  
  let totalProcessed = 0;
  let totalAdded = 0;

  for (const job of jobs) {
    if (job.posted_at) {
      const jobDate = new Date(job.posted_at);
      if (!isNaN(jobDate.getTime()) && jobDate < oneMonthAgo) {
        console.log(`  [SKIP] "${job.title}" (${job.location}) - Posted over 1 month ago (posted: ${job.posted_at})`);
        continue;
      }
    }

    const loc = job.location ? job.location.toLowerCase() : "";
    const isIndia = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => loc.includes(k));
    if (!isIndia) {
      console.log(`  [SKIP] "${job.title}" (${job.location}) - Location does not match India or Remote criteria`);
      continue;
    }

    const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
    const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided" && job.description !== "Full text of the job description";
    if (!hasTitle || !hasDesc) {
      console.log(`  [SKIP] "${job.title}" (${job.location}) - Missing or placeholder job title/description`);
      continue;
    }

    console.log(`\n[PROCESSING] "${job.title}" (${job.location}) - URL: ${job.url}`);
    totalProcessed++;

    let embedding = null;
    let keywords: string[] = [];
    try {
      const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000); 
      
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
        })
      });
      
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        const parsed = JSON.parse(kwData.choices[0].message.content);
        keywords = Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[];
        if (!Array.isArray(keywords)) keywords = [];
        console.log(`  [OPENAI] Keywords extracted: ${JSON.stringify(keywords)}`);
      }

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
        })
      });
      
      if (oaiRes.ok) {
        const oaiData = await oaiRes.json();
        if (oaiData.data && oaiData.data.length > 0) {
          embedding = oaiData.data[0].embedding;
          console.log(`  [OPENAI] Embedding generated successfully.`);
        }
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
        const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
        insertError = retryError;
      }
    }

    if (!insertError) {
      console.log(`  ✅ Successfully saved job "${job.title}" to DB`);
      totalAdded++;
    } else {
      console.error(`  ❌ Failed to insert job "${job.title}" to DB:`, insertError.message);
    }
  }

  console.log(`\n🎉 Scraping complete! Processed: ${totalProcessed}, Added/updated: ${totalAdded}`);
}

run();
