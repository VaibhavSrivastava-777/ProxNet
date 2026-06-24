import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyMappings } from "@/lib/anonymize";
import { discoverAts } from "@/lib/ats-discovery";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "proxnet_temp_seed_secret_998877") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const step = searchParams.get("step") || "all";
  const supabase = createAdminClient();
  const logs: string[] = [];

  try {
    // 1. Seed ATS Configs
    if (step === "all" || step === "seed") {
      logs.push("Starting ATS configuration seeding...");
      const { data: users, error: userError } = await supabase.from("users").select("company");
      if (userError) {
        throw new Error(`Failed to fetch users: ${userError.message}`);
      }

      const networkCompanies = new Set(
        users.map(u => u.company).filter(c => c && c.trim() !== "")
      );

      const staticCompanies = Object.keys(companyMappings);
      const allCompanies = new Set([...networkCompanies, ...staticCompanies]);
      logs.push(`Found ${allCompanies.size} unique companies in total.`);

      let successCount = 0;
      let skipCount = 0;

      for (const company of allCompanies) {
        const cleanCompany = typeof company === "string" ? company.trim() : "";
        if (!cleanCompany) continue;

        const formattedName = cleanCompany.charAt(0).toUpperCase() + cleanCompany.slice(1);
        const ats = await discoverAts(cleanCompany);
        
        if (ats) {
          const { error } = await supabase
            .from("company_ats_config")
            .upsert({
              company_name: formattedName,
              provider: ats.provider,
              board_token_or_url: ats.board
            }, { onConflict: "company_name" });

          if (!error) {
            successCount++;
            logs.push(`Seeded ${formattedName} as ${ats.provider} (${ats.board})`);
          } else {
            logs.push(`Failed to save ${formattedName}: ${error.message}`);
          }
        } else {
          skipCount++;
        }
      }
      logs.push(`ATS Seeding finished. Seeded: ${successCount}, Skipped: ${skipCount}`);
    }

    // 2. Scrape Jobs
    if (step === "all" || step === "scrape") {
      logs.push("Starting jobs scraping...");
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_KEY) {
        throw new Error("OPENAI_API_KEY is missing in env");
      }

      const { data: atsConfigs, error: atsError } = await supabase.from("company_ats_config").select("*");
      if (atsError) {
        throw new Error(`Failed to fetch ATS configs: ${atsError.message}`);
      }

      logs.push(`Found ${atsConfigs?.length || 0} ATS configurations to scrape.`);

      let totalProcessed = 0;
      let totalAdded = 0;
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      for (const config of atsConfigs || []) {
        let jobs: any[] = [];
        logs.push(`Scraping jobs for ${config.company_name} via ${config.provider}...`);

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
          logs.push(`Error fetching jobs for ${config.company_name}: ${e.message}`);
        }

        logs.push(`Found ${jobs.length} jobs for ${config.company_name}. Processing and indexing...`);

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

          // Generate Keywords and Embedding
          let embedding = null;
          let keywords: string[] = [];
          try {
            const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000); 
            
            // 1. Extract Keywords
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

            // 2. Generate Embedding
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
          } catch(e: any) {
            logs.push(`OpenAI failed for ${job.title}: ${e.message}`);
          }

          // Upsert
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
            logs.push(`Failed to insert job ${job.title}: ${insertError.message}`);
          }
        }
      }
      logs.push(`Jobs scraping finished. Processed: ${totalProcessed}, Successfully added/updated: ${totalAdded}`);
    }

    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      logs
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      logs
    }, { status: 500 });
  }
}
