import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await getAdminSession();
  
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  
  // 1. Get ATS configs
  const { data: atsConfigs, error: atsError } = await supabase
    .from("company_ats_config")
    .select("*");
    
  if (atsError) {
    return NextResponse.json({ error: "Failed to fetch ATS configs" }, { status: 500 });
  }
  
  if (!atsConfigs || atsConfigs.length === 0) {
    return NextResponse.json({ success: true, totalAdded: 0, message: "No ATS configs found. Please add them in the database." });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is missing" }, { status: 500 });
  }

  let totalProcessed = 0;
  let totalAdded = 0;

  // 1 month ago for filtering
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Helper to strip HTML for Greenhouse
  const stripHtml = (html: string) => html ? html.replace(/<[^>]*>?/gm, ' ').trim() : '';

  // 2. Fetch jobs from each ATS
  for (const config of atsConfigs) {
    let jobs: any[] = [];
    
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
      } else if (config.provider === 'custom') {
        // Option B: AI scrapes the single custom job URL
        const res = await fetch(config.board_token_or_url);
        if (res.ok) {
          const html = await res.text();
          const plainText = stripHtml(html).substring(0, 15000); // Limit to ~3-4k tokens

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
              "Authorization": `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4o-mini", // Cost effective model
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" }
            })
          });

          if (oaiRes.ok) {
            const oaiData = await oaiRes.json();
            const extracted = JSON.parse(oaiData.choices[0].message.content);
            jobs.push({
              title: extracted.title || "Unknown Title",
              location: extracted.location || "Remote",
              url: config.board_token_or_url, // Save the single URL
              posted_at: new Date().toISOString(),
              description: extracted.description || "No description provided",
              source: 'custom_ai'
            });
          }
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ATS for ${config.company_name}`, e);
    }

    // 3. Process jobs and generate embeddings
    for (const job of jobs) {
      // Date filter
      const jobDate = job.posted_at ? new Date(job.posted_at) : new Date();
      if (jobDate < oneMonthAgo) {
        continue;
      }

      // Location filter (India only)
      const loc = job.location ? job.location.toLowerCase() : "";
      const isIndia = ["india", "bangalore", "bengaluru", "mumbai", "pune", "delhi", "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "remote"].some(k => loc.includes(k));
      if (!isIndia) {
        continue;
      }

      // Check BOTH title and description
      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
      const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided" && job.description !== "Full text of the job description";
      if (!hasTitle || !hasDesc) {
        continue; // Skip if we don't have BOTH title and description
      }

      totalProcessed++;

      // Generate Embedding
      let embedding = null;
      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000); 
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
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
        
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          if (oaiData.data && oaiData.data.length > 0) {
            embedding = oaiData.data[0].embedding;
          }
        }
      } catch(e) {
        console.error("OpenAI embedding failed", e);
      }

      // Upsert
      const { error: insertError } = await supabase.from("scraped_jobs").upsert({
        company: config.company_name,
        title: job.title,
        location: job.location,
        url: job.url,
        description: job.description.substring(0, 5000), // Keep description manageable
        ats_source: job.source,
        posted_at: job.posted_at,
        embedding: embedding
      }, { onConflict: "url" });
      
      if (!insertError) {
        totalAdded++;
      }
    }
  }

  return NextResponse.json({ success: true, totalAdded, totalProcessed });
}
