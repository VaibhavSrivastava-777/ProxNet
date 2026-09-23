import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { STRATEGIES } from "@/lib/scrape-strategies";
import { discoverAts } from "@/lib/ats-discovery";
import { isJobEligible, normalizeJobUrl, normalizeJobTitle } from "@/lib/jobs/job-filters";

export const maxDuration = 60;

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Fetch user profile & target companies
  const { data: userProfile } = await supabase
    .from("users")
    .select("profile_digest, embedding, resume_text, about, company, job_title")
    .eq("id", user.id)
    .single();

  const { data: userTargetRows } = await supabase
    .from("user_target_companies")
    .select("*")
    .eq("user_id", user.id);

  const targetCompanyNames: string[] = (userTargetRows && userTargetRows.length > 0)
    ? userTargetRows.map(r => r.company_name)
    : (userProfile?.profile_digest?.target_companies || []);

  if (targetCompanyNames.length === 0) {
    return NextResponse.json({ error: "No target companies found in user profile" }, { status: 400 });
  }

  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*")
    .in("company_name", targetCompanyNames);

  const targetsMap = new Map(configs?.map(c => [c.company_name.toLowerCase().trim(), c]) || []);
  const utcMap = new Map(userTargetRows?.map(r => [r.company_name.toLowerCase().trim(), r]) || []);

  const targets = (await Promise.all(targetCompanyNames.map(async (name) => {
    const key = name.toLowerCase().trim();
    const utcRow = utcMap.get(key);
    const config = targetsMap.get(key);
    const discovered = (!utcRow?.ats_board_token && !config?.board_token_or_url) ? await discoverAts(name) : null;

    const provider = utcRow?.ats_provider && utcRow.ats_provider !== "none"
      ? utcRow.ats_provider
      : (discovered?.provider || config?.provider || "none");

    const token = utcRow?.ats_board_token || utcRow?.careers_url || discovered?.board || config?.board_token_or_url || "";

    return {
      company_name: name,
      ats_provider: provider,
      ats_board_token: token,
      careers_url: token,
    };
  }))).filter(t => t.ats_provider !== "none" && t.ats_board_token && !t.ats_board_token.includes("careers.google.com"));

  let totalScraped = 0;
  let totalSaved = 0;

  // 2. Scrape target companies concurrently (up to 4 at a time to prevent serverless timeout)
  const scrapeTarget = async (target: typeof targets[0]) => {
    const strategy = STRATEGIES[target.ats_provider] || STRATEGIES["custom"];
    if (!strategy) return { scraped: 0, saved: 0 };

    let jobs: any[] = [];
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Scrape timeout after 40s")), 40000)
      );
      jobs = await Promise.race([
        strategy(target.ats_board_token || target.careers_url || "", target.company_name),
        timeoutPromise
      ]);
    } catch (e: any) {
      console.error(`Scrape failed for ${target.company_name}:`, e.message);
      await supabase
        .from("user_target_companies")
        .update({
          scrape_status: "failed",
          scrape_notes: `Failed: ${e.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .ilike("company_name", target.company_name);
      return { scraped: 0, saved: 0 };
    }

    // Filter jobs: 30-day freshness, India location, not junior
    const eligibleJobs = jobs.filter(job => {
      const { eligible } = isJobEligible({
        title: job.title,
        location: job.location,
        description: job.description,
        posted_at: job.posted_at,
      });
      return eligible;
    });

    // Query existing recent (< 30 days) jobs to prevent duplicate OpenAI calls and DB inserts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: existingRows } = await supabase
      .from("scraped_jobs")
      .select("url, title")
      .ilike("company", target.company_name)
      .gte("posted_at", thirtyDaysAgo.toISOString());

    const existingUrls = new Set((existingRows || []).map(r => normalizeJobUrl(r.url)));
    const existingTitles = new Set((existingRows || []).map(r => normalizeJobTitle(r.title)));

    const seenBatchUrls = new Set<string>();
    const toProcess: typeof jobs = [];
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
      if (toProcess.length >= 25) break;
    }

    let companySaved = 0;

    for (const job of toProcess) {
      let embedding = null;
      if (openaiKey) {
        try {
          const textToEmbed = `Title: ${job.title}\nCompany: ${target.company_name}\nDescription: ${job.description || job.title}`.slice(0, 8000);
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
            signal: AbortSignal.timeout(10000),
          });

          if (embRes.ok) {
            const embData = await embRes.json();
            embedding = embData.data?.[0]?.embedding || null;
          }
        } catch (e) {}
      }

      const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
        company: target.company_name,
        title: job.title,
        location: job.location || "India",
        url: job.url || target.careers_url,
        posted_at: job.posted_at || new Date().toISOString(),
        description: job.description || job.title,
        source: job.source || target.ats_provider,
        contact_id: user.id,
        contact_alias: user.job_title ? `${user.job_title} @ ${user.company || target.company_name}` : "ProxNet Professional",
        embedding,
        created_at: new Date().toISOString(),
      }, { onConflict: "url" });

      if (!insertErr) {
        companySaved++;
      }
    }

    let scrapeNotes = `Scraped ${jobs.length} raw jobs (${eligibleJobs.length} India, ${companySaved} saved)`;
    if (jobs.length > 0 && eligibleJobs.length === 0) {
      scrapeNotes = `0 India listings found out of ${jobs.length} global postings (< 30d)`;
    } else if (eligibleJobs.length > 0 && companySaved === 0) {
      scrapeNotes = `All ${eligibleJobs.length} active India listings are already saved in ProxNet`;
    }

    await supabase.from("company_ats_config").upsert({
      company_name: target.company_name,
      provider: target.ats_provider,
      board_token_or_url: target.ats_board_token,
      total_jobs_found: eligibleJobs.length,
      last_scraped_at: new Date().toISOString(),
      scrape_notes: scrapeNotes,
    }, { onConflict: "company_name" });

    await supabase
      .from("user_target_companies")
      .update({
        last_scraped_at: new Date().toISOString(),
        total_jobs_found: eligibleJobs.length,
        scrape_status: (companySaved > 0 || (jobs.length > 0 && eligibleJobs.length === 0)) ? "success" : "failed",
        scrape_notes: scrapeNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .ilike("company_name", target.company_name);

    return { scraped: jobs.length, saved: companySaved };
  };

  const results = await Promise.all(targets.map(scrapeTarget));
  for (const r of results) {
    totalScraped += r.scraped;
    totalSaved += r.saved;
  }

  // 3. Always re-evaluate user embedding from latest resume
  if (openaiKey && userProfile) {
    const denseContext = userProfile.resume_text ? `Resume: ${userProfile.resume_text}` : `About: ${userProfile.about || "None"}`;
    const textToEmbed = `Company: ${userProfile.company || "None"}\nRole: ${userProfile.job_title || "None"}\n${denseContext}`.slice(0, 8000);

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
    });

    if (embRes.ok) {
      const embData = await embRes.json();
      const userEmbedding = embData.data[0]?.embedding;
      if (userEmbedding) {
        await supabase.from("users").update({ embedding: userEmbedding }).eq("id", user.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    totalScraped,
    totalSaved,
    totalCompanies: targets.length,
  });
}
