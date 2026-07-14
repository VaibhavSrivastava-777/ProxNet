import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as https from "react-native-level-fs" // Wait, do NOT use react-native-level-fs, use node's native 'https'
import * as nativeHttps from "https";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_KEY) {
  console.error("Error: Missing credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const stripHtml = (html: string) => {
  if (!html) return '';
  let text = html.replace(/<[^>]*>?/gm, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  return text.replace(/\s+/g, ' ').trim();
};

function cosineSimilarity(vecA: number[], vecB: number[]) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function postRequest(hostname: string, path: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname,
      port: 443,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    const req = nativeHttps.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`POST ${path} failed with status ${res.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function getRequest(hostname: string, path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    const req = nativeHttps.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GET ${path} failed with status ${res.statusCode}: ${body}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  console.log("🚀 Step 1: Seeding ATS Configuration for Wellsfargo...");
  
  const { error: seedError } = await supabase
    .from("company_ats_config")
    .upsert({
      company_name: "Wellsfargo",
      provider: "custom",
      board_token_or_url: "https://wf.wd1.myworkdayjobs.com/WellsFargoJobs"
    }, { onConflict: "company_name" });

  if (seedError) {
    console.error("❌ Failed to seed Wellsfargo ATS config:", seedError.message);
    return;
  }
  console.log("✅ Wellsfargo ATS seeded successfully.");

  console.log("\n🚀 Step 2: Fetching user profiles & embeddings...");
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, full_name, embedding, resume_text, about, job_title, company");

  if (usersError) {
    console.error("❌ Failed to fetch users:", usersError.message);
    return;
  }

  const userEmbeddings: { userId: string; name: string; embedding: number[] }[] = [];

  for (const u of users || []) {
    let embeddingVal = u.embedding;
    if (embeddingVal) {
      if (typeof embeddingVal === "string") {
        try {
          embeddingVal = JSON.parse(embeddingVal);
        } catch (e) {
          embeddingVal = (embeddingVal as string)
            .replace(/[\[\]\s]/g, "")
            .split(",")
            .map(Number);
        }
      }
      
      if (Array.isArray(embeddingVal) && embeddingVal.length > 0) {
        userEmbeddings.push({ userId: u.id, name: u.full_name, embedding: embeddingVal });
      }
    }
  }

  console.log(`✅ Loaded ${userEmbeddings.length} user embeddings for matchmaking.`);

  console.log("\n🚀 Step 3: Fetching jobs from Wells Fargo Workday Portal...");
  const hostname = "wf.wd1.myworkdayjobs.com";
  const listPath = "/wday/cxs/wf/WellsFargoJobs/jobs";

  let offset = 0;
  const limit = 20;
  let keepPaging = true;
  const rawJobsList: any[] = [];

  while (keepPaging) {
    console.log(`  Fetching jobs offset=${offset}...`);
    try {
      const res = await postRequest(hostname, listPath, {
        appliedFacets: {},
        limit,
        offset,
        searchText: ""
      });

      const postings = res.jobPostings || [];
      if (postings.length === 0) {
        console.log("  No more jobs returned from Workday list API.");
        break;
      }

      for (const job of postings) {
        const postedOn = job.postedOn || "";
        const locText = job.locationsText || "";

        // Check if job is older than 1 week (e.g. 2 Weeks Ago, 3 Weeks Ago, 30+ Days Ago, etc.)
        const tooOld = postedOn.includes("2 Weeks") || 
                        postedOn.includes("3 Weeks") || 
                        postedOn.includes("30+") || 
                        postedOn.includes("Month");

        if (tooOld) {
          console.log(`  Found job posted "${postedOn}". Stopping paging.`);
          keepPaging = false;
          break;
        }

        // Location pre-filter
        const locLower = locText.toLowerCase();
        const hasDigits = /\d/.test(locText);
        const isIndiaOrRemoteOrMultiple = hasDigits || ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => locLower.includes(k));

        if (isIndiaOrRemoteOrMultiple) {
          rawJobsList.push(job);
        }
      }

      if (!keepPaging) break;
      offset += limit;
      
      if (offset >= 300) {
        console.log("  Reached safety limit of 300 jobs fetched. Stopping paging.");
        break;
      }

      // Add a slight delay to be nice to the API
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      console.error("  ❌ Failed to fetch list page:", e.message);
      break;
    }
  }

  console.log(`✅ Collected ${rawJobsList.length} candidate jobs to fetch details for.`);

  console.log("\n🚀 Step 4: Fetching job details, filtering, and matchmaking (Timeframe: 1 week)...");
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkippedDate = 0;
  let totalSkippedLocation = 0;
  let totalSkippedNoMatch = 0;

  for (const job of rawJobsList) {
    const detailPath = `/wday/cxs/wf/WellsFargoJobs${job.externalPath}`;
    console.log(`\n  Fetching details for "${job.title}" (${job.locationsText})...`);
    
    let details: any = null;
    try {
      const res = await getRequest(hostname, detailPath);
      details = res.jobPostingInfo;
    } catch (e: any) {
      console.warn(`  ⚠️ Failed to fetch details for job "${job.title}":`, e.message);
      continue;
    }

    if (!details) continue;

    const startDate = details.startDate; // e.g. "2026-06-25"
    const descriptionHtml = details.jobDescription || "";
    const description = stripHtml(descriptionHtml);
    
    // Parse location details (all alternative locations)
    const primaryLocation = details.location || "";
    const additionalLocations = Array.isArray(details.additionalLocations) ? details.additionalLocations : [];
    const allLocations = [primaryLocation, ...additionalLocations].join(", ");

    // 1. Date filter (must be within last 7 days)
    if (startDate) {
      const jobDate = new Date(startDate);
      if (!isNaN(jobDate.getTime()) && jobDate < oneWeekAgo) {
        console.log(`    ⏩ Skipped: Posted on ${startDate} (older than 1 week)`);
        totalSkippedDate++;
        continue;
      }
    }

    // 2. Location filter (only India / Remote)
    const locLower = allLocations.toLowerCase();
    const isIndiaOrRemote = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => locLower.includes(k));
    if (!isIndiaOrRemote) {
      console.log(`    ⏩ Skipped: Location "${allLocations}" does not match India/Remote`);
      totalSkippedLocation++;
      continue;
    }

    totalProcessed++;

    // Generate Embedding
    let jobEmbedding: number[] | null = null;
    const textToEmbed = `Title: ${job.title}\nCompany: Wellsfargo\nDescription: ${description}`.slice(0, 8000);

    try {
      const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: textToEmbed,
          model: "text-embedding-3-small"
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (embedRes.ok) {
        const embedData = await embedRes.json();
        if (embedData.data && embedData.data.length > 0) {
          jobEmbedding = embedData.data[0].embedding;
        }
      }
    } catch (e: any) {
      console.warn(`    ⚠️ Failed to generate embedding:`, e.message);
    }

    if (!jobEmbedding) {
      console.warn(`    ⚠️ Skipping because embedding generation failed.`);
      continue;
    }

    // Match against user resumes
    let maxSim = 0;
    let matchedUser = "";

    for (const ue of userEmbeddings) {
      const sim = cosineSimilarity(jobEmbedding, ue.embedding);
      if (sim > maxSim) {
        maxSim = sim;
        matchedUser = ue.name;
      }
    }

    if (maxSim < 0.50) {
      console.log(`    ⏩ Skipped: No matching user resume (Best Match: "${matchedUser}" at ${Math.round(maxSim * 100)}%)`);
      totalSkippedNoMatch++;
      continue;
    }

    console.log(`    🌟 [MATCH FOUND] Best Match: "${matchedUser}" (Similarity: ${Math.round(maxSim * 100)}%)`);

    // Generate Keywords
    let keywords: string[] = [];
    try {
      const keywordPrompt = `Extract 3 to 5 highly relevant technical skills, tools, or buzzwords (e.g., "React", "Python", "B2B Sales") from the following job posting. Return a JSON object with a single key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`;
      const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
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
        const parsed = JSON.parse(kwData.choices[0].message.content);
        keywords = Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[];
        if (!Array.isArray(keywords)) keywords = [];
        console.log(`    [KEYWORDS] ${JSON.stringify(keywords)}`);
      }
    } catch (e: any) {
      console.warn(`    ⚠️ Failed to extract keywords:`, e.message);
    }

    // Save to Supabase
    const jobData = {
      company: "Wellsfargo",
      title: job.title,
      location: allLocations,
      url: `https://wellsfargo.wd5.myworkdayjobs.com/en-US/WellsFargoJobs${job.externalPath}`,
      description: description.substring(0, 5000),
      ats_source: "workday",
      posted_at: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      embedding: jobEmbedding,
      keywords: keywords.slice(0, 5)
    };

    const { error: insertError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });

    if (insertError) {
      console.error(`    ❌ Failed to save job:`, insertError.message);
    } else {
      console.log(`    ✅ Successfully saved matched job to DB`);
      totalAdded++;
    }

    // Be nice to the API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n🎉 Process Run Completed!`);
  console.log(`  Total candidate jobs checked: ${rawJobsList.length}`);
  console.log(`  Skipped (older than 1 week): ${totalSkippedDate}`);
  console.log(`  Skipped (location does not match): ${totalSkippedLocation}`);
  console.log(`  Skipped (no matching user resume): ${totalSkippedNoMatch}`);
  console.log(`  Total processed matching criteria: ${totalProcessed}`);
  console.log(`  Successfully added/updated in scraped_jobs: ${totalAdded}`);
}

run().catch(console.error);
