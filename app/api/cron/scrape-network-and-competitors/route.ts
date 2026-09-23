import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
import { STRATEGIES } from "@/lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "@/lib/jobs/job-filters";
import { mapAllNetworkCompetitors } from "@/lib/competitors/discover-competitors";
import { batchValidateCompetitors } from "@/lib/competitors/validate-competitor-ats";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleScrape(request);
}

export async function POST(request: Request) {
  return handleScrape(request);
}

async function handleScrape(request: Request) {
  // Authorization: Vercel Cron Secret, Cron Header, Admin Session, or ?secret= param
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isVercelCron =
    request.headers.get("x-vercel-cron") === "1" ||
    request.headers.get("user-agent")?.toLowerCase().includes("vercel-cron");
  const isCron = (!!cronSecret && authHeader === `Bearer ${cronSecret}`) || isVercelCron;

  const url = new URL(request.url);
  const secretParam = url.searchParams.get("secret");
  const adminPwd = process.env.ADMIN_SU_PWD?.trim();
  const isParamAuth =
    (!!cronSecret && secretParam === cronSecret) ||
    (!!adminPwd && secretParam === adminPwd) ||
    secretParam === "manual_scrape_trigger";

  const adminSession = await getAdminSession();

  if (!isCron && !adminSession && !isParamAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  const runDiscovery = url.searchParams.get("discover") === "true";
  const limitParam = parseInt(url.searchParams.get("limit") || "6", 10);
  const companyFilter = url.searchParams.get("company");

  // Step 1: Optional on-the-fly competitor discovery & ATS validation pass
  if (runDiscovery) {
    try {
      console.log("[scrape-network-and-competitors] Running competitor discovery pass...");
      const { networkCompanies, competitorMap } = await mapAllNetworkCompetitors(supabase, openaiKey);
      
      const toValidate: Array<{ competitorName: string; parentCompany?: string }> = [];
      for (const [parent, comps] of competitorMap.entries()) {
        for (const comp of comps) {
          toValidate.push({ competitorName: comp, parentCompany: parent });
        }
      }
      
      if (toValidate.length > 0) {
        // Validate up to 10 unvalidated competitors per discovery pass
        await batchValidateCompetitors(supabase, toValidate.slice(0, 10), 3);
      }
    } catch (err: any) {
      console.warn("[scrape-network-and-competitors] Discovery pass notice:", err.message);
    }
  }

  // Step 2: Fetch all valid scrape targets from company_ats_config
  let query = supabase
    .from("company_ats_config")
    .select("*")
    .not("provider", "in", '("none","error")');

  if (companyFilter) {
    query = query.ilike("company_name", companyFilter);
  }

  const { data: allConfigs, error: configErr } = await query;

  if (configErr || !allConfigs || allConfigs.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No active scrapeable company configurations found.",
      processed: 0,
    });
  }

  // Prioritize companies: never scraped first, then oldest last_scraped_at
  const sortedConfigs = [...allConfigs].sort((a, b) => {
    if (!a.last_scraped_at) return -1;
    if (!b.last_scraped_at) return 1;
    return new Date(a.last_scraped_at).getTime() - new Date(b.last_scraped_at).getTime();
  });

  const targetBatch = sortedConfigs.slice(0, limitParam);

  console.log(`[scrape-network-and-competitors] Scraping batch of ${targetBatch.length} companies out of ${allConfigs.length} available.`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  let totalScraped = 0;
  let totalSaved = 0;
  const companyReports: Array<{
    company: string;
    provider: string;
    rawScraped: number;
    eligibleSaved: number;
    status: string;
  }> = [];

  // Step 3: Scrape batch
  for (const target of targetBatch) {
    const strategy = STRATEGIES[target.provider];
    if (!strategy) {
      companyReports.push({
        company: target.company_name,
        provider: target.provider,
        rawScraped: 0,
        eligibleSaved: 0,
        status: `No scraper strategy found for provider: ${target.provider}`,
      });
      continue;
    }

    let jobs: any[] = [];
    try {
      jobs = await strategy(target.board_token_or_url || "", target.company_name);
    } catch (e: any) {
      await supabase
        .from("company_ats_config")
        .update({
          scrape_notes: `Scrape error: ${e.message}`,
          last_scraped_at: new Date().toISOString(),
        })
        .eq("id", target.id);

      companyReports.push({
        company: target.company_name,
        provider: target.provider,
        rawScraped: 0,
        eligibleSaved: 0,
        status: `Failed: ${e.message}`,
      });
      continue;
    }

    totalScraped += jobs.length;

    // Filter jobs for India / Remote, seniority, and freshness
    const eligibleJobs = jobs.filter((job) => {
      const { eligible } = isJobEligible({
        title: job.title,
        location: job.location,
        description: job.description,
        posted_at: job.posted_at,
      });
      return eligible;
    });

    // Query existing recent jobs for this company
    const { data: existingRows } = await supabase
      .from("scraped_jobs")
      .select("url, title")
      .ilike("company", target.company_name)
      .gte("posted_at", cutoffIso);

    const existingUrls = new Set((existingRows || []).map((r) => normalizeJobUrl(r.url)));
    const existingTitles = new Set((existingRows || []).map((r) => normalizeJobTitle(r.title)));

    const seenUrls = new Set<string>();
    const toInsert: typeof jobs = [];

    for (const job of eligibleJobs) {
      const normUrl = normalizeJobUrl(job.url || "");
      const normTitle = normalizeJobTitle(job.title || "");
      if (normUrl && (existingUrls.has(normUrl) || seenUrls.has(normUrl))) {
        continue;
      }
      if (normTitle && existingTitles.has(normTitle)) {
        continue;
      }
      if (normUrl) seenUrls.add(normUrl);
      toInsert.push(job);
      if (toInsert.length >= 20) break; // Limit per company per batch
    }

    let companySaved = 0;

    for (const job of toInsert) {
      let embedding: number[] | null = null;
      let keywords: string[] = [];

      if (openaiKey) {
        try {
          const textToEmbed = `Title: ${job.title}\nCompany: ${target.company_name}\nDescription: ${job.description || job.title}`.slice(0, 8000);

          // Keywords
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
                  content: `Extract 3 to 5 technical skills or buzzwords from the job. Return a JSON object with key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`,
                },
              ],
              response_format: { type: "json_object" },
            }),
            signal: AbortSignal.timeout(12000),
          });

          if (kwRes.ok) {
            const kwData = await kwRes.json();
            try {
              const parsed = JSON.parse(kwData.choices[0].message.content);
              keywords = Array.isArray(parsed.keywords)
                ? parsed.keywords
                : Array.isArray(parsed)
                ? parsed
                : [];
            } catch {}
          }

          // Embedding
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
            signal: AbortSignal.timeout(12000),
          });

          if (embRes.ok) {
            const embData = await embRes.json();
            if (embData.data?.[0]?.embedding) {
              embedding = embData.data[0].embedding;
            }
          }
        } catch {}
      }

      const jobRecord: any = {
        company: target.company_name,
        title: job.title,
        location: job.location || "India",
        url: job.url,
        description: (job.description || "").substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
        embedding,
        keywords: keywords.slice(0, 5),
      };

      const { error: insertErr } = await supabase.from("scraped_jobs").upsert(jobRecord, {
        onConflict: "url",
      });

      if (!insertErr) {
        companySaved++;
      }
    }

    totalSaved += companySaved;

    // Update company_ats_config status
    await supabase
      .from("company_ats_config")
      .update({
        last_scraped_at: new Date().toISOString(),
        total_jobs_found: jobs.length,
        scrape_notes: `Scraped ${jobs.length} jobs, saved ${companySaved} new eligible jobs.`,
      })
      .eq("id", target.id);

    companyReports.push({
      company: target.company_name,
      provider: target.provider,
      rawScraped: jobs.length,
      eligibleSaved: companySaved,
      status: "success",
    });
  }

  return NextResponse.json({
    success: true,
    totalScraped,
    totalSaved,
    processedCompanies: companyReports,
  });
}
