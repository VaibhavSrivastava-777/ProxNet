import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-session";
import { STRATEGIES } from "@/lib/scrape-strategies";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "@/lib/jobs/job-filters";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Authorization: Vercel Cron Secret or Admin Session
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const adminSession = await getAdminSession();

  if (!isCron && !adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  // 1. Aggregate target companies from active user preferences and user_target_companies
  const companySet = new Map<string, { company_name: string; ats_provider: string; ats_board_token: string; careers_url: string }>();

  // Source A: All users' profile_digest.target_companies
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, profile_digest")
    .eq("is_active", true)
    .eq("is_blocked", false);

  const allTargetNames = new Set<string>();
  for (const u of allUsers || []) {
    const targets: string[] = u.profile_digest?.target_companies || [];
    for (const t of targets) {
      if (t && t.trim()) allTargetNames.add(t.trim());
    }
  }

  // Source B: All user_target_companies rows (per-user tracked companies)
  const { data: userTargets } = await supabase
    .from("user_target_companies")
    .select("company_name, ats_provider, ats_board_token, careers_url")
    .in("scrape_status", ["pending", "success", "failed"]);

  for (const ut of userTargets || []) {
    const key = ut.company_name.toLowerCase().trim();
    if (ut.ats_provider && ut.ats_provider !== "none" && ut.ats_provider !== "no_ats") {
      companySet.set(key, {
        company_name: ut.company_name,
        ats_provider: ut.ats_provider,
        ats_board_token: ut.ats_board_token || "",
        careers_url: ut.careers_url || "",
      });
    }
  }

  // Fetch global configs to resolve user targets and fill backlog
  const { data: globalConfigs } = await supabase
    .from("company_ats_config")
    .select("*")
    .not("provider", "in", '("none","error","cron_status")');

  // Resolve user target names against global company_ats_config
  for (const name of allTargetNames) {
    const key = name.toLowerCase().trim();
    if (!companySet.has(key)) {
      const config = (globalConfigs || []).find(c => c.company_name.toLowerCase().trim() === key);
      if (config && config.provider && config.provider !== "none") {
        companySet.set(key, {
          company_name: name,
          ats_provider: config.provider,
          ats_board_token: config.board_token_or_url || "",
          careers_url: config.board_token_or_url || "",
        });
      }
    }
  }

  // If user targets are fewer than 10, backfill with oldest unscraped network boards
  if (companySet.size < 10 && globalConfigs && globalConfigs.length > 0) {
    const sorted = [...globalConfigs].sort((a, b) => {
      if (!a.last_scraped_at) return -1;
      if (!b.last_scraped_at) return 1;
      return new Date(a.last_scraped_at).getTime() - new Date(b.last_scraped_at).getTime();
    });
    for (const c of sorted) {
      if (companySet.size >= 10) break;
      const key = c.company_name.toLowerCase().trim();
      if (!companySet.has(key)) {
        companySet.set(key, {
          company_name: c.company_name,
          ats_provider: c.provider,
          ats_board_token: c.board_token_or_url || "",
          careers_url: c.board_token_or_url || "",
        });
      }
    }
  }

  const targets = Array.from(companySet.values()).slice(0, 10);

  if (targets.length === 0) {
    return NextResponse.json({ success: true, message: "No scrapeable target companies found." });
  }

  console.log(`[scrape-user-targets] Selected targeted batch of ${targets.length} companies to scrape.`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  let totalScraped = 0;
  let totalSaved = 0;
  const companySummaries: Array<{ company: string; provider: string; totalJobs: number; saved: number; status: string }> = [];

  // 2. Scrape each target company with execution timeout guard
  for (const target of targets) {
    if (Date.now() - startTime > 45000) {
      console.log(`[scrape-user-targets] Approaching 45s execution limit; gracefully concluding.`);
      break;
    }

    const strategy = STRATEGIES[target.ats_provider];
    if (!strategy) {
      companySummaries.push({
        company: target.company_name,
        provider: target.ats_provider,
        totalJobs: 0,
        saved: 0,
        status: `No strategy for ${target.ats_provider}`,
      });
      continue;
    }

    let jobs: any[] = [];
    try {
      jobs = await strategy(target.ats_board_token || target.careers_url || "", target.company_name);
    } catch (e: any) {
      await supabase.from("company_ats_config").update({
        scrape_notes: `Cron scrape failed: ${e.message}`,
        last_scraped_at: new Date().toISOString(),
      }).eq("company_name", target.company_name);

      companySummaries.push({
        company: target.company_name,
        provider: target.ats_provider,
        totalJobs: 0,
        saved: 0,
        status: `Failed: ${e.message}`,
      });
      continue;
    }

    totalScraped += jobs.length;

    // Filter jobs by India location, 30-day freshness, and senior level
    const eligibleJobs = jobs.filter(job => {
      const { eligible } = isJobEligible({
        title: job.title,
        location: job.location,
        description: job.description,
        posted_at: job.posted_at,
      });
      return eligible;
    });

    // Query existing recent (< 30 days) jobs for this company to prevent duplicate scraping and embedding
    const { data: existingRows } = await supabase
      .from("scraped_jobs")
      .select("url, title")
      .ilike("company", target.company_name)
      .gte("posted_at", cutoffIso);

    const existingUrls = new Set((existingRows || []).map(r => normalizeJobUrl(r.url)));
    const existingTitles = new Set((existingRows || []).map(r => normalizeJobTitle(r.title)));

    const seenBatchUrls = new Set<string>();
    const toProcess: typeof jobs = [];

    // Cap per run to 30 jobs for equitable round-robin
    for (const job of eligibleJobs) {
      const normUrl = normalizeJobUrl(job.url || "");
      const normTitle = normalizeJobTitle(job.title || "");
      if (normUrl && (existingUrls.has(normUrl) || seenBatchUrls.has(normUrl))) {
        continue;
      }
      if (normTitle && existingTitles.has(normTitle)) {
        continue;
      }
      if (normUrl) seenBatchUrls.add(normUrl);
      toProcess.push(job);
      if (toProcess.length >= 30) break;
    }

    let companySaved = 0;

    // Batch Embeddings: Generate in single API call
    const embeddingsMap = new Map<number, number[]>();
    if (openaiKey && toProcess.length > 0) {
      try {
        const textsToEmbed = toProcess.map((j) =>
          `Title: ${j.title}\nCompany: ${target.company_name}\nDescription: ${j.description || j.title}`.slice(0, 4000)
        );
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: textsToEmbed,
            model: "text-embedding-3-small",
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (embRes.ok) {
          const embData = await embRes.json();
          if (Array.isArray(embData.data)) {
            embData.data.forEach((item: any) => {
              embeddingsMap.set(item.index, item.embedding);
            });
          }
        }
      } catch (embErr: any) {
        console.warn(`[scrape-user-targets] Batch embedding notice for ${target.company_name}:`, embErr.message);
      }
    }

    const techKeywords = [
      "python", "react", "node", "typescript", "javascript", "golang", "java", "c++",
      "aws", "azure", "gcp", "docker", "kubernetes", "sql", "nosql", "graphql", "next.js",
      "tailwind", "ai", "ml", "product", "sales", "marketing", "leadership", "finance",
      "devops", "cloud", "security", "data engineering", "system design"
    ];

    const recordsToUpsert = toProcess.map((job, idx) => {
      const combinedText = `${job.title} ${job.description || ""}`.toLowerCase();
      const matchedKw: string[] = [];
      for (const kw of techKeywords) {
        if (combinedText.includes(kw)) matchedKw.push(kw);
        if (matchedKw.length >= 5) break;
      }

      return {
        company: target.company_name,
        title: job.title,
        location: job.location || "India",
        url: job.url,
        description: (job.description || "").substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
        embedding: embeddingsMap.get(idx) || null,
        keywords: matchedKw,
      };
    });

    if (recordsToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from("scraped_jobs").upsert(recordsToUpsert, {
        onConflict: "url",
      });
      if (!upsertErr) {
        companySaved = recordsToUpsert.length;
        totalSaved += companySaved;
      }
    }

    // Enforce Representation Cap: ensure company never exceeds 50 active jobs in database
    const { data: allCompJobs } = await supabase
      .from("scraped_jobs")
      .select("id, posted_at")
      .ilike("company", target.company_name)
      .order("posted_at", { ascending: false });

    if (allCompJobs && allCompJobs.length > 50) {
      const excessIds = allCompJobs.slice(50).map((r) => r.id);
      await supabase.from("scraped_jobs").delete().in("id", excessIds);
    }

    let scrapeNotes = `Cron: Scraped ${jobs.length} raw, ${eligibleJobs.length} India, saved ${companySaved}. Representation capped at 50 max.`;
    if (jobs.length > 0 && eligibleJobs.length === 0) {
      scrapeNotes = `Cron: 0 India listings found out of ${jobs.length} global postings (< 30d).`;
    } else if (eligibleJobs.length > 0 && companySaved === 0) {
      scrapeNotes = `Cron: All ${eligibleJobs.length} India listings are already up to date in ProxNet.`;
    }

    // Update company ATS config metadata
    await supabase.from("company_ats_config").update({
      last_scraped_at: new Date().toISOString(),
      total_jobs_found: eligibleJobs.length,
      scrape_notes: scrapeNotes,
    }).eq("company_name", target.company_name);

    companySummaries.push({
      company: target.company_name,
      provider: target.ats_provider,
      totalJobs: jobs.length,
      saved: companySaved,
      status: "success",
    });
  }

  return NextResponse.json({
    success: true,
    usersEvaluated: allUsers?.length || 0,
    companiesProcessed: companySummaries.length,
    totalScraped,
    totalSaved,
    companySummaries,
  });
}
