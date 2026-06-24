import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Helper to strip HTML and decode entities
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

  console.log("Fetching ATS configurations from database...");
  const { data: configs, error: configsError } = await supabase
    .from("company_ats_config")
    .select("*");

  if (configsError) {
    console.error("Failed to fetch configs:", configsError.message);
    process.exit(1);
  }

  console.log(`Found ${configs.length} ATS configurations to scrape.`);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  let totalProcessed = 0;
  let totalAdded = 0;

  for (const config of configs) {
    let jobs: any[] = [];
    console.log(`\nScraping jobs for ${config.company_name} (${config.provider})...`);

    try {
      if (config.provider === 'greenhouse') {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${config.board_token_or_url}/jobs?content=true`);
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
        const res = await fetch(`https://api.lever.co/v0/postings/${config.board_token_or_url}?mode=json`);
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
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${config.board_token_or_url}`);
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
      } else if (config.provider === 'workable') {
        const res = await fetch(`https://www.workable.com/api/accounts/${config.board_token_or_url}?details=true`);
        if (res.ok) {
          const data = await res.json();
          for (const j of data.jobs || []) {
            jobs.push({
              title: j.title,
              location: j.city || j.country || 'Remote',
              url: j.url,
              posted_at: j.created_at,
              description: stripHtml(j.description || ''),
              source: 'workable'
            });
          }
        }
      } else if (config.provider === 'breezy') {
        const res = await fetch(`https://${config.board_token_or_url}.breezy.hr/json`);
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
      } else if (config.provider === 'recruitee') {
        const res = await fetch(`https://${config.board_token_or_url}.recruitee.com/api/offers`);
        if (res.ok) {
          const data = await res.json();
          for (const j of data.offers || []) {
            jobs.push({
              title: j.title,
              location: j.location || 'Remote',
              url: j.careers_url,
              posted_at: j.published_at,
              description: stripHtml(j.description || ''),
              source: 'recruitee'
            });
          }
        }
      } else if (config.provider === 'smartrecruiters') {
        const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${config.board_token_or_url}/postings`);
        if (res.ok) {
          const data = await res.json();
          for (const j of data.content || []) {
            const postedDate = j.releasedDate ? new Date(j.releasedDate) : null;
            if (!postedDate || isNaN(postedDate.getTime()) || postedDate >= oneMonthAgo) {
              try {
                const detailRes = await fetch(`https://api.smartrecruiters.com/v1/companies/${config.board_token_or_url}/postings/${j.id}`);
                if (detailRes.ok) {
                  const detailData = await detailRes.json();
                  jobs.push({
                    title: j.name,
                    location: j.location?.city || 'Remote',
                    url: `https://jobs.smartrecruiters.com/${config.board_token_or_url}/${j.id}`,
                    posted_at: j.releasedDate,
                    description: stripHtml(detailData.jobAd?.sections?.jobDescription?.text || ''),
                    source: 'smartrecruiters'
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (e: any) {
      console.error(`Error fetching jobs for ${config.company_name}:`, e.message);
      continue;
    }

    console.log(`Found ${jobs.length} total postings. Processing & upserting...`);

    for (const job of jobs) {
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < oneMonthAgo) {
          continue;
        }
      }

      const loc = job.location ? job.location.toLowerCase() : "";
      const isIndia = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => loc.includes(k));
      if (!isIndia) {
        continue;
      }

      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
      const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided" && job.description !== "Full text of the job description";
      if (!hasTitle || !hasDesc) {
        continue;
      }

      totalProcessed++;

      let embedding = null;
      let keywords: string[] = [];
      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000); 
        
        // 1. Keywords
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
          try {
            const parsed = JSON.parse(kwData.choices[0].message.content);
            keywords = Array.isArray(parsed) ? parsed : Object.values(parsed)[0] as string[];
            if (!Array.isArray(keywords)) keywords = [];
          } catch(e) {}
        }

        // 2. Embedding
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
          }
        }
      } catch(e: any) {
        console.error(`OpenAI processing failed for "${job.title}":`, e.message);
      }

      const { error: insertError } = await supabase.from("scraped_jobs").upsert({
        company: config.company_name,
        title: job.title,
        location: job.location,
        url: job.url,
        description: job.description.substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at,
        embedding: embedding,
        keywords: keywords.slice(0, 5)
      }, { onConflict: "url" });
      
      if (!insertError) {
        totalAdded++;
      } else {
        console.error(`Failed to insert job "${job.title}":`, insertError.message);
      }
    }
  }

  console.log(`\n🎉 Finished! Processed: ${totalProcessed}, Successfully added/updated: ${totalAdded}`);
}

main();
