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

async function run() {
  console.log("Fetching Breezy jobs for Hera...");
  const res = await fetch("https://hera.breezy.hr/json");
  if (!res.ok) {
    console.error(`Failed to fetch from breezy: ${res.status}`);
    return;
  }

  const data = await res.json();
  console.log(`Fetched ${data.length} raw jobs from Hera.`);
  
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  let totalProcessed = 0;
  let totalAdded = 0;

  for (const j of (Array.isArray(data) ? data : [])) {
    const title = j.name;
    const location = j.location?.name || j.location?.city || "Remote";
    const url = j.url;
    const posted_at = j.creation_date;
    const description = stripHtml(j.description || "");

    console.log(`Processing job: "${title}" (${location})...`);

    if (posted_at) {
      const jobDate = new Date(posted_at);
      if (!isNaN(jobDate.getTime()) && jobDate < oneMonthAgo) {
        console.log(`  [SKIP] Job is older than 1 month.`);
        continue;
      }
    }

    const loc = location.toLowerCase();
    const isIndia = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => loc.includes(k));
    if (!isIndia) {
      console.log(`  [SKIP] Location does not match India or Remote.`);
      continue;
    }

    const hasTitle = title && title.trim() !== "";
    const hasDesc = description && description.trim() !== "";
    if (!hasTitle || !hasDesc) {
      console.log(`  [SKIP] Empty title or description.`);
      continue;
    }

    totalProcessed++;
    let embedding = null;
    let keywords: string[] = [];

    try {
      const textToEmbed = `Title: ${title}\nCompany: Hera\nDescription: ${description}`.slice(0, 8000); 
      
      // OpenAI Keywords
      console.log("  [OPENAI] Extracting keywords...");
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
        console.log(`  [OPENAI] Keywords: ${JSON.stringify(keywords)}`);
      }

      // OpenAI Embedding
      console.log("  [OPENAI] Generating embedding...");
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
          console.log("  [OPENAI] Embedding generated.");
        }
      }
    } catch (e: any) {
      console.error("OpenAI failed", e.message);
    }

    const jobData: any = {
      company: "Hera",
      title,
      location,
      url,
      description: description.substring(0, 5000),
      ats_source: "breezy",
      posted_at,
      embedding
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
      console.log(`  ✅ Saved job "${title}"`);
      totalAdded++;
    } else {
      console.error(`  ❌ Failed to save job "${title}":`, insertError.message);
    }
  }

  console.log(`Done! Processed ${totalProcessed} jobs, added ${totalAdded} jobs for Hera.`);
}

run();
