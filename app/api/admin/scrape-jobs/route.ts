import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScraper } from "@/lib/scrapers/registry";
import { isIndianOrIndianRemote } from "@/lib/scrapers/utils";

export const maxDuration = 300; // Allow up to 5 minutes on Vercel

function isJuniorJob(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const d = description.toLowerCase();

  const seniorKeywords = ["senior", "sr.", "sr ", "lead", "principal", "staff", "director", "manager", "architect", "head", "vp", "chief"];
  const isExplicitlySenior = seniorKeywords.some(kw => t.includes(kw));
  if (isExplicitlySenior) {
    return false;
  }

  const juniorTitles = ["junior", "jr.", "jr ", "intern", "trainee", "fresher", "entry-level", "entry level"];
  if (juniorTitles.some(kw => t.includes(kw))) {
    return true;
  }

  const expRegexes = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?/gi,
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi,
    /min(?:imum)?\s*(\d+)\s*years?/gi
  ];

  for (const regex of expRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(d)) !== null) {
      const val1 = parseInt(match[1], 10);
      const val2 = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(val1)) {
        if (val2 !== null) {
          if (val2 < 3) {
            return true;
          }
        } else {
          if (val1 < 3) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export async function GET(request: Request) {
  return handleRequest(request, true);
}

export async function POST(request: Request) {
  let onlyProxNet = false;
  let companies: string[] | undefined;

  try {
    const body = await request.json();
    onlyProxNet = !!body.onlyProxNet;
    if (Array.isArray(body.companies)) {
      companies = body.companies;
    }
  } catch (e) {}

  return handleRequest(request, onlyProxNet, companies);
}

async function handleRequest(request: Request, onlyProxNet: boolean, targetCompanies?: string[]) {
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await getAdminSession();
  
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const startTime = Date.now();

  try {
    let query = supabase
      .from("company_ats_config")
      .select("*")
      .neq("provider", "cron_status")
      .order("last_scraped_at", { ascending: true, nullsFirst: true });

    if (onlyProxNet) {
      const { data: users } = await supabase.from("users").select("company");
      if (users && users.length > 0) {
        const proxNetCompanies = Array.from(new Set(users.map((u: any) => {
          if (!u.company) return "";
          const clean = u.company.trim();
          return clean.charAt(0).toUpperCase() + clean.slice(1);
        }).filter(Boolean)));
        
        if (proxNetCompanies.length > 0) {
          query = query.in("company_name", proxNetCompanies);
        }
      }
    } else if (targetCompanies && targetCompanies.length > 0) {
      query = query.in("company_name", targetCompanies);
    }

    // Process in round-robin fashion (1 company per run) unless explicit targets were given
    if (!targetCompanies || targetCompanies.length === 0) {
      query = query.limit(1);
    }

    const { data: atsConfigs, error: atsError } = await query;
      
    if (atsError) {
      throw new Error(`Failed to fetch ATS configs: ${atsError.message}`);
    }
    
    if (!atsConfigs || atsConfigs.length === 0) {
      return NextResponse.json({ success: true, totalAdded: 0, message: "No ATS configs found to scrape." });
    }

    // Purge jobs posted more than a month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    try {
      await supabase
        .from("scraped_jobs")
        .delete()
        .lt("posted_at", oneMonthAgo.toISOString());
    } catch (e: any) {
      console.warn("Purge failed:", e.message);
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    let totalProcessed = 0;
    let totalAdded = 0;
    const stats: Record<string, { provider: string; totalFound: number; totalProcessed: number; totalAdded: number; error?: string }> = {};

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const config of atsConfigs) {
      let jobs: any[] = [];
      console.log(`- Running for ${config.company_name} Org`);

      const scraper = getScraper(config.company_name, config);
      if (!scraper) {
        console.warn(`No scraping strategy found for company: ${config.company_name}`);
        await supabase
          .from("company_ats_config")
          .update({
            last_scraped_at: new Date().toISOString(),
            scrape_notes: `Failed: No scraping strategy registered for '${config.company_name}'.`
          })
          .eq("company_name", config.company_name);
        stats[config.company_name] = {
          provider: config.provider,
          totalFound: 0,
          totalProcessed: 0,
          totalAdded: 0,
          error: `No scraping strategy registered for '${config.company_name}'.`
        };
        continue;
      }

      try {
        jobs = await scraper.scrape();
      } catch (err: any) {
        console.error(`Failed to fetch jobs for ${config.company_name}:`, err.message);
        await supabase
          .from("company_ats_config")
          .update({
            last_scraped_at: new Date().toISOString(),
            scrape_notes: `Failed to scrape: ${err.message}`
          })
          .eq("company_name", config.company_name);
        stats[config.company_name] = {
          provider: config.provider,
          totalFound: 0,
          totalProcessed: 0,
          totalAdded: 0,
          error: err.message
        };
        continue;
      }

      let companyProcessed = 0;
      let companyAdded = 0;
      let companySkippedDate = 0;
      let companySkippedLocation = 0;
      let companySkippedExperience = 0;
      let companySkippedContent = 0;

      let jobsInLastWeek = 0;
      for (const job of jobs) {
        if (job.posted_at) {
          const jobDate = new Date(job.posted_at);
          if (!isNaN(jobDate.getTime()) && jobDate >= oneWeekAgo) {
            jobsInLastWeek++;
          }
        }
      }
      console.log(`- ${jobsInLastWeek} Jobs posts in last 1 week`);

      for (const job of jobs) {
        // 1. Date cut-off check
        if (job.posted_at) {
          const jobDate = new Date(job.posted_at);
          if (!isNaN(jobDate.getTime()) && jobDate < oneWeekAgo) {
            companySkippedDate++;
            continue;
          }
        }

        // 2. India Location check
        if (!isIndianOrIndianRemote(job.location)) {
          console.log(`- Skipped location check for job: "${job.title}", location: "${job.location}"`);
          companySkippedLocation++;
          continue;
        }

        // 3. Title/description completeness
        const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
        const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided" && job.description !== "Full text of the job description";
        if (!hasTitle || !hasDesc) {
          companySkippedContent++;
          continue;
        }

        // 4. Experience check (no junior roles)
        if (isJuniorJob(job.title, job.description)) {
          companySkippedExperience++;
          continue;
        }

        companyProcessed++;
        totalProcessed++;

        // 5. Generate Keywords & Embedding
        let embedding = null;
        let keywords: string[] = [];
        try {
          const textToEmbed = `Title: ${job.title}\nCompany: ${config.company_name}\nDescription: ${job.description}`.slice(0, 8000);

          // Keywords extraction
          const kwPrompt = `Extract 3 to 5 technical skills or buzzwords from the job. Return a JSON object with key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`;
          const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: kwPrompt }],
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

          // Embedding generation
          const embRes = await fetch("https://api.openai.com/v1/embeddings", {
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

          if (embRes.ok) {
            const embData = await embRes.json();
            if (embData.data && embData.data.length > 0) {
              embedding = embData.data[0].embedding;
            }
          }
        } catch(e: any) {
          console.error(`AI processing error for ${job.title}:`, e.message);
        }

        const jobData = {
          company: config.company_name,
          title: job.title,
          location: job.location,
          url: job.url,
          description: job.description.substring(0, 5000),
          ats_source: job.source,
          posted_at: job.posted_at,
          embedding
        };

        let { error: insertError } = await supabase.from("scraped_jobs").upsert({
          ...jobData,
          keywords: keywords.slice(0, 5)
        }, { onConflict: "url" });

        if (insertError) {
          // Retry without keywords column
          const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
          insertError = retryError;
        }

        if (!insertError) {
          companyAdded++;
          totalAdded++;
          if (companyAdded % 3 === 0) {
            console.log(`- Extracted ${companyAdded} jobs -> ${companyAdded + 3} jobs ....`);
          }
        }
      }
      console.log(`- Extracted all ${companyAdded} jobs in ${config.company_name}`);

      // Update config metadata
      await supabase
        .from("company_ats_config")
        .update({
          last_scraped_at: new Date().toISOString(),
          total_jobs_found: jobs.length,
          scrape_notes: `Scraped ${jobs.length} total. Saved ${companyAdded}. Skipped: ${companySkippedDate} date, ${companySkippedLocation} loc, ${companySkippedExperience} exp, ${companySkippedContent} empty.`
        })
        .eq("company_name", config.company_name);

      stats[config.company_name] = {
        provider: config.provider,
        totalFound: jobs.length,
        totalProcessed: companyProcessed,
        totalAdded: companyAdded
      };
    }

    // Record cron status if running via authorization
    if (isCron) {
      await supabase.from("company_ats_config").upsert({
        company_name: "cron_status",
        provider: "cron_status",
        board_token_or_url: "cron_status",
        scrape_notes: `Cron finished successfully. Processed: ${totalProcessed}. Added/Updated: ${totalAdded} in ${Math.round((Date.now() - startTime) / 1000)}s.`,
        last_scraped_at: new Date().toISOString(),
        total_jobs_found: totalProcessed
      }, { onConflict: "company_name" });
    }

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalAdded,
      stats,
      durationSeconds: Math.round((Date.now() - startTime) / 1000)
    });

  } catch (err: any) {
    console.error("Job scrape API failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
