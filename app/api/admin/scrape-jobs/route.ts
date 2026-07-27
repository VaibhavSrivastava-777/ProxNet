import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { identifyScrapeStrategy } from "@/lib/agents/scrape-identifier";
import { validateScrapeStrategy } from "@/lib/agents/scrape-validator";
import { matchAndFilterJobs } from "@/lib/agents/embedding-matcher";
import { getScraper } from "@/lib/scrapers/registry";
import { isIndianOrIndianRemote } from "@/lib/scrapers/utils";

export const maxDuration = 300;

export async function GET(request: Request) {
  return handlePipeline(request, true);
}

export async function POST(request: Request) {
  let targetCompanies: string[] | undefined;
  try {
    const body = await request.json();
    if (Array.isArray(body.companies)) {
      targetCompanies = body.companies;
    }
  } catch (e) {}

  return handlePipeline(request, true, targetCompanies);
}

async function handlePipeline(request: Request, onlyProxNet: boolean = true, targetCompanies?: string[]) {
  const authHeader = request.headers.get("authorization");
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await getAdminSession();
  
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const startTime = Date.now();

  try {
    // 1. Identify ProxNet target companies
    let proxNetCompanies: string[] = [];
    const { data: users } = await supabase
      .from("users")
      .select("company, embedding")
      .not("company", "is", null);

    if (users && users.length > 0) {
      proxNetCompanies = Array.from(new Set(users.map((u: any) => {
        if (!u.company) return "";
        const clean = u.company.trim();
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      }).filter(Boolean)));
    }

    if (targetCompanies && targetCompanies.length > 0) {
      proxNetCompanies = targetCompanies;
    }

    if (proxNetCompanies.length === 0) {
      return NextResponse.json({ success: true, message: "No active ProxNet companies found." });
    }

    // Pick target user embedding for Agent 3 match calculation
    const sampleUserWithEmbedding = users?.find(u => Array.isArray(u.embedding) && u.embedding.length > 0);
    const targetUserEmbedding = sampleUserWithEmbedding?.embedding || null;

    const pipelineResults: Record<string, any> = {};
    let totalAddedCount = 0;

    for (const companyName of proxNetCompanies.slice(0, 5)) { // Process top target companies per run
      console.log(`\n--- Starting 3-Agent Pipeline for '${companyName}' ---`);

      // Agent 1: Identify strategy
      const agent1Output = await identifyScrapeStrategy({ companyName });
      console.log(`[Agent 1 Result] Strategy: ${agent1Output.recommendedStrategy} (Confidence: ${agent1Output.confidence})`);

      // Agent 2: Validate strategy with sample jobs
      const agent2Output = await validateScrapeStrategy(agent1Output);
      console.log(`[Agent 2 Result] Valid: ${agent2Output.isValid}, Sample jobs: ${agent2Output.sampleJobsCount}`);

      if (!agent2Output.isValid) {
        pipelineResults[companyName] = {
          agent1: agent1Output,
          agent2: agent2Output,
          agent3: null,
          status: "FAILED_VALIDATION"
        };
        continue;
      }

      // Execute full extraction using validated strategy
      const scraper = getScraper(companyName, { provider: agent1Output.recommendedStrategy, board_token_or_url: "" });
      if (!scraper) continue;

      const rawScrapedJobs = await scraper.scrape(15);

      // Filter location & remote requirements
      const locationFilteredJobs = (rawScrapedJobs || []).filter(j => isIndianOrIndianRemote(j.location));

      // Agent 3: Embedding match & pull ONLY jobs matching > 60%
      const agent3Matches = await matchAndFilterJobs(locationFilteredJobs, targetUserEmbedding, 0.60);
      console.log(`[Agent 3 Result] Evaluated ${locationFilteredJobs.length} jobs. Retained ${agent3Matches.length} jobs with >60% match rate.`);

      let companySavedCount = 0;

      for (const item of agent3Matches) {
        const job = item.job;
        const cleanTitle = job.title.trim();
        const cleanLocation = job.location.trim();

        const { data: inserted, error: insertErr } = await supabase
          .from("scraped_jobs")
          .upsert({
            title: cleanTitle,
            company_name: companyName,
            location: cleanLocation,
            url: job.url,
            description: job.description,
            posted_at: job.posted_at || new Date().toISOString(),
            keywords: job.keywords || []
          }, { onConflict: "company_name,title,url" })
          .select()
          .single();

        if (!insertErr && inserted) {
          companySavedCount++;
          totalAddedCount++;
        }
      }

      pipelineResults[companyName] = {
        agent1: agent1Output,
        agent2: agent2Output,
        agent3: {
          totalEvaluated: locationFilteredJobs.length,
          retainedGreaterThan60: agent3Matches.length,
          savedToDatabase: companySavedCount
        },
        status: "SUCCESS"
      };
    }

    return NextResponse.json({
      success: true,
      totalAdded: totalAddedCount,
      durationMs: Date.now() - startTime,
      pipelineResults
    });

  } catch (error: any) {
    console.error("3-Agent Scrape jobs pipeline error:", error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
