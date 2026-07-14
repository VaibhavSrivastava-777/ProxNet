import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

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
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&ndash;/g, '-');
  text = text.replace(/&mdash;/g, '-');
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

async function run() {
  console.log("🚀 Step 1: Seeding ATS Configuration for Zscaler...");
  
  const { error: seedError } = await supabase
    .from("company_ats_config")
    .upsert({
      company_name: "Zscaler",
      provider: "greenhouse",
      board_token_or_url: "zscaler"
    }, { onConflict: "company_name" });

  if (seedError) {
    console.error("❌ Failed to seed Zscaler ATS config:", seedError.message);
    return;
  }
  console.log("✅ Zscaler ATS seeded successfully (provider: greenhouse, token: zscaler)");

  console.log("\n🚀 Step 2: Fetching user profiles & generating missing embeddings...");
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
          // If it's a pgvector representation like "[0.123, -0.456, ...]"
          embeddingVal = (embeddingVal as string)
            .replace(/[\[\]\s]/g, "")
            .split(",")
            .map(Number);
        }
      }
      
      if (Array.isArray(embeddingVal) && embeddingVal.length > 0) {
        userEmbeddings.push({ userId: u.id, name: u.full_name, embedding: embeddingVal });
      } else {
        console.warn(`  ⚠️ User "${u.full_name}" has invalid embedding format:`, typeof u.embedding);
      }
    } else if (u.resume_text || u.about) {
      console.log(`  Generating embedding for user "${u.full_name}"...`);
      const denseContext = u.resume_text ? `Resume: ${u.resume_text}` : `About: ${u.about}`;
      const textToEmbed = `Company: ${u.company || "None"}\nRole: ${u.job_title || "None"}\n${denseContext}`.slice(0, 8000);
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
          })
        });
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const embedding = embedData.data[0].embedding;
          userEmbeddings.push({ userId: u.id, name: u.full_name, embedding });
          
          await supabase
            .from("users")
            .update({ embedding })
            .eq("id", u.id);
          console.log(`  ✅ Generated & saved embedding for user "${u.full_name}".`);
        }
      } catch (err: any) {
        console.warn(`  ⚠️ Failed to generate embedding for user "${u.full_name}":`, err.message);
      }
    }
  }

  console.log(`✅ Loaded ${userEmbeddings.length} valid user embeddings for matchmaking.`);

  console.log("\n🚀 Step 3: Fetching jobs from Zscaler Greenhouse Board...");
  const boardUrl = "https://boards-api.greenhouse.io/v1/boards/zscaler/jobs?content=true";
  let rawJobs: any[] = [];
  try {
    const res = await fetch(boardUrl);
    if (!res.ok) {
      throw new Error(`Greenhouse API responded with status ${res.status}`);
    }
    const data = await res.json();
    rawJobs = data.jobs || [];
    console.log(`Fetched ${rawJobs.length} total jobs from Zscaler.`);
  } catch (e: any) {
    console.error("❌ Failed to fetch jobs:", e.message);
    return;
  }

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  console.log("\n🚀 Step 4: Filtering and matchmaking jobs...");
  let totalProcessed = 0;
  let totalAdded = 0;
  let totalSkippedDate = 0;
  let totalSkippedLocation = 0;
  let totalSkippedContent = 0;
  let totalSkippedNoMatch = 0;

  for (const rj of rawJobs) {
    const title = rj.title;
    const location = rj.location?.name || "Remote";
    const url = rj.absolute_url;
    const posted_at = rj.updated_at;
    const description = stripHtml(rj.content || rj.title);

    // 1. Filter out jobs older than 2 weeks
    if (posted_at) {
      const jobDate = new Date(posted_at);
      if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) {
        totalSkippedDate++;
        continue;
      }
    }

    // 2. Filter location (only India / Remote)
    const loc = location.toLowerCase();
    const isIndiaOrRemote = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => loc.includes(k));
    if (!isIndiaOrRemote) {
      totalSkippedLocation++;
      continue;
    }

    const hasTitle = title && title.trim() !== "";
    const hasDesc = description && description.trim() !== "";
    if (!hasTitle || !hasDesc) {
      totalSkippedContent++;
      continue;
    }

    totalProcessed++;

    // Generate Embedding first to compare with users
    let jobEmbedding: number[] | null = null;
    const textToEmbed = `Title: ${title}\nCompany: Zscaler\nDescription: ${description}`.slice(0, 8000);

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
      console.warn(`  ⚠️ Failed to generate embedding for job "${title}":`, e.message);
    }

    if (!jobEmbedding) {
      console.warn(`  ⚠️ Skipping job "${title}" because embedding generation failed.`);
      continue;
    }

    // Match against user embeddings (cosine similarity >= 0.50)
    let isMatch = false;
    let maxSim = 0;
    let matchedUser = "";

    for (const ue of userEmbeddings) {
      const sim = cosineSimilarity(jobEmbedding, ue.embedding);
      if (sim > maxSim) {
        maxSim = sim;
        matchedUser = ue.name;
      }
    }

    if (maxSim >= 0.50) {
      isMatch = true;
    }

    if (!isMatch) {
      totalSkippedNoMatch++;
      continue;
    }

    console.log(`\n[MATCH FOUND] "${title}" (${location}) - Best Match: "${matchedUser}" (Similarity: ${Math.round(maxSim * 100)}%)`);

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
        console.log(`  [KEYWORDS] ${JSON.stringify(keywords)}`);
      }
    } catch (e: any) {
      console.warn(`  ⚠️ Failed to extract keywords:`, e.message);
    }

    // Upsert into Supabase
    const jobData: any = {
      company: "Zscaler",
      title,
      location,
      url,
      description: description.substring(0, 5000),
      ats_source: "greenhouse",
      posted_at,
      embedding: jobEmbedding
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

    if (insertError) {
      console.error(`  ❌ Failed to save job to DB:`, insertError.message);
    } else {
      console.log(`  ✅ Successfully saved matched job to DB`);
      totalAdded++;
    }

    // Wait a brief period
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 Process Run Completed!`);
  console.log(`  Total jobs checked: ${rawJobs.length}`);
  console.log(`  Skipped (older than 2 weeks): ${totalSkippedDate}`);
  console.log(`  Skipped (location does not match): ${totalSkippedLocation}`);
  console.log(`  Skipped (empty content): ${totalSkippedContent}`);
  console.log(`  Skipped (no matching user resume): ${totalSkippedNoMatch}`);
  console.log(`  Total processed matching criteria: ${totalProcessed}`);
  console.log(`  Successfully added/updated in scraped_jobs: ${totalAdded}`);
}

run().catch(console.error);
