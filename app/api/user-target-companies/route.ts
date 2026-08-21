import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverAts } from "@/lib/ats-discovery";
import { STRATEGIES } from "@/lib/scrape-strategies";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Get user profile and target companies
  const { data: userProfile } = await supabase
    .from("users")
    .select("embedding, job_title, company, about, resume_text, profile_digest")
    .eq("id", user.id)
    .single();

  const targetCompanyNames: string[] = userProfile?.profile_digest?.target_companies || [];

  if (targetCompanyNames.length === 0) {
    return NextResponse.json({
      targetCompanies: [],
      summary: { totalScraped: 0, totalMatches: 0 },
    });
  }

  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*")
    .in("company_name", targetCompanyNames);

  const configsMap = new Map(configs?.map(c => [c.company_name.toLowerCase().trim(), c]) || []);

  const targets = targetCompanyNames.map(name => {
    const config = configsMap.get(name.toLowerCase().trim());
    return {
      id: config?.id || name,
      company_name: name,
      careers_url: config?.board_token_or_url || "",
      ats_provider: config?.provider || "none",
      scrape_status: config?.provider && config.provider !== "none" ? "success" : "no_ats",
      total_jobs_found: config?.total_jobs_found || 0,
      last_scraped_at: config?.last_scraped_at || null,
      scrape_notes: config?.scrape_notes || null,
    };
  });

  let userEmbedding = userProfile?.embedding;

  // Generate embedding on-the-fly if missing
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!userEmbedding && OPENAI_KEY && userProfile) {
    const denseContext = userProfile.resume_text
      ? `Resume: ${userProfile.resume_text}`
      : `About: ${userProfile.about || "None"}`;
    const textToEmbed = `Company: ${userProfile.company || "None"}\nRole: ${userProfile.job_title || "None"}\n${denseContext}`.slice(0, 8000);

    try {
      const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: textToEmbed,
          model: "text-embedding-3-small",
        }),
      });

      if (oaiRes.ok) {
        const oaiData = await oaiRes.json();
        userEmbedding = oaiData.data[0]?.embedding;
        if (userEmbedding) {
          await supabase.from("users").update({ embedding: userEmbedding }).eq("id", user.id);
        }
      }
    } catch (e) {
      console.error("Failed to generate user embedding:", e);
    }
  }

  // 3. If no embedding, return targets without matches
  if (!userEmbedding) {
    const targetCompanies = targets.map(t => ({
      ...t,
      matches: [],
      match_count: 0,
    }));

    return NextResponse.json({
      targetCompanies,
      summary: {
        totalScraped: targets.reduce((sum, t) => sum + (t.total_jobs_found || 0), 0),
        totalMatches: 0,
      },
    });
  }

  // 4. Run match_scraped_jobs RPC
  const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
    query_embedding: userEmbedding,
    match_threshold: 0.3,
    match_count: 200,
  });

  if (matchError) {
    console.error("Match RPC error:", matchError);
    return NextResponse.json({ error: "Failed to match jobs" }, { status: 500 });
  }

  // 5. Filter matches to user's target companies only
  const targetCompanySet = new Set(targets.map(t => t.company_name.toLowerCase().trim()));

  const matchesByCompany: Record<string, Array<{
    job_id: string;
    title: string;
    match_rate: number;
    url: string;
    location: string;
    posted_at: string;
    keywords: string[];
  }>> = {};

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  for (const job of (matchedJobs || [])) {
    const matchRate = Math.min(99, Math.max(0, Math.round(((job.similarity - 0.25) / 0.35) * 100)));
    if (matchRate < 60) continue;

    // Skip old jobs
    if (job.posted_at) {
      const jobDate = new Date(job.posted_at);
      if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) continue;
    }

    const jobCompany = (job.company || "").toLowerCase().trim();
    if (!targetCompanySet.has(jobCompany)) continue;

    // Find the original-cased company name
    const originalName = targets.find(t => t.company_name.toLowerCase().trim() === jobCompany)?.company_name || job.company;

    if (!matchesByCompany[originalName]) {
      matchesByCompany[originalName] = [];
    }

    matchesByCompany[originalName].push({
      job_id: job.id,
      title: job.title,
      match_rate: matchRate,
      url: job.url || "",
      location: job.location || "Remote",
      posted_at: job.posted_at || "",
      keywords: job.keywords || [],
    });
  }

  // Sort matches by match rate descending
  for (const key of Object.keys(matchesByCompany)) {
    matchesByCompany[key].sort((a, b) => b.match_rate - a.match_rate);
  }

  // 6. Combine target companies with their matches
  const targetCompanies = targets.map(t => ({
    id: t.id,
    company_name: t.company_name,
    careers_url: t.careers_url,
    ats_provider: t.ats_provider,
    scrape_status: t.scrape_status,
    total_jobs_found: t.total_jobs_found || 0,
    last_scraped_at: t.last_scraped_at,
    scrape_notes: t.scrape_notes,
    matches: matchesByCompany[t.company_name] || [],
    match_count: (matchesByCompany[t.company_name] || []).length,
  }));

  // Sort by match_count descending
  targetCompanies.sort((a, b) => b.match_count - a.match_count);

  const totalMatches = targetCompanies.reduce((sum, t) => sum + t.match_count, 0);

  return NextResponse.json({
    targetCompanies,
    summary: {
      totalScraped: targets.reduce((sum, t) => sum + (t.total_jobs_found || 0), 0),
      totalMatches,
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { company_name, careers_url } = body;

  if (!company_name || typeof company_name !== "string" || !company_name.trim()) {
    return NextResponse.json({ error: "company_name is required" }, { status: 400 });
  }

  const cleanName = company_name.trim();
  const supabase = createAdminClient();

  // 1. Fetch user profile
  const { data: userProfile, error: profileError } = await supabase
    .from("users")
    .select("profile_digest, embedding, resume_text, about, company, job_title")
    .eq("id", user.id)
    .single();

  if (profileError || !userProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 500 });
  }

  const profileDigest = userProfile.profile_digest || {};
  const currentTargets: string[] = profileDigest.target_companies || [];

  // Check if company is already in target_companies (case-insensitive)
  const exists = currentTargets.some(c => c.toLowerCase().trim() === cleanName.toLowerCase());
  if (!exists) {
    currentTargets.push(cleanName);
    profileDigest.target_companies = currentTargets;

    await supabase
      .from("users")
      .update({ profile_digest: profileDigest })
      .eq("id", user.id);
  }

  // 2. Resolve ATS config for this company
  let provider = "custom";
  let boardTokenOrUrl = careers_url || `https://careers.google.com/jobs/results/?q=${encodeURIComponent(cleanName)}`;

  const discovered = await discoverAts(cleanName);
  if (discovered) {
    provider = discovered.provider;
    boardTokenOrUrl = discovered.board;
  } else {
    const { data: existingConfig } = await supabase
      .from("company_ats_config")
      .select("*")
      .ilike("company_name", cleanName)
      .single();

    if (existingConfig) {
      provider = existingConfig.provider;
      boardTokenOrUrl = existingConfig.board_token_or_url || boardTokenOrUrl;
    } else if (careers_url) {
      provider = "custom";
      boardTokenOrUrl = careers_url;
    }
  }

  // Save newly discovered config
  await supabase.from("company_ats_config").upsert({
    company_name: cleanName,
    provider,
    board_token_or_url: boardTokenOrUrl,
    last_scraped_at: new Date().toISOString(),
  }, { onConflict: "company_name" });

  // 3. Trigger immediate test scrape for this target company (unfiltered)
  let jobsScraped = 0;
  let savedCount = 0;
  let sampleListings: any[] = [];
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const strategy = STRATEGIES[provider] || STRATEGIES["custom"];
  if (strategy && boardTokenOrUrl) {
    try {
      console.log(`[TARGET COMPANY ADDED] Scraping sample listings for ${cleanName} (${provider}) without filters...`);
      const scrapedJobs = await strategy(boardTokenOrUrl, cleanName);
      jobsScraped = scrapedJobs.length;
      sampleListings = scrapedJobs.slice(0, 3).map(j => ({
        title: j.title,
        location: j.location || "Remote",
        url: j.url || boardTokenOrUrl
      }));

      // Store listings without location/experience filters
      for (const j of scrapedJobs) {
        if (!j.title || j.title.length < 3) continue;

        // Generate embedding if key available
        let embedding = null;
        if (OPENAI_KEY) {
          const textToEmbed = `Company: ${cleanName}\nTitle: ${j.title}\nLocation: ${j.location}\nDescription: ${(j.description || j.title).slice(0, 1000)}`;
          try {
            const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENAI_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                input: textToEmbed,
                model: "text-embedding-3-small",
              }),
            });
            if (oaiRes.ok) {
              const oaiData = await oaiRes.json();
              embedding = oaiData.data[0].embedding;
            }
          } catch (e) {
            console.error("Embedding generation error:", e);
          }
        }

        const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
          company: cleanName,
          title: j.title,
          location: j.location || "Remote",
          url: j.url || boardTokenOrUrl,
          posted_at: j.posted_at || new Date().toISOString(),
          description: j.description || j.title,
          source: j.source || provider,
          contact_id: user.id,
          contact_alias: user.job_title ? `${user.job_title} @ ${user.company || cleanName}` : "ProxNet Professional",
          embedding,
          created_at: new Date().toISOString(),
        }, { onConflict: "url" });

        if (!insertErr) savedCount++;
      }

      // Update config stats with total raw jobs found
      await supabase.from("company_ats_config").upsert({
        company_name: cleanName,
        provider,
        board_token_or_url: boardTokenOrUrl,
        total_jobs_found: jobsScraped,
        last_scraped_at: new Date().toISOString(),
      }, { onConflict: "company_name" });

    } catch (scrapeErr: any) {
      console.error(`Error scraping added company ${cleanName}:`, scrapeErr.message);
    }
  }

  return NextResponse.json({
    success: true,
    company_name: cleanName,
    ats_provider: provider,
    board_url: boardTokenOrUrl,
    raw_listings_found: jobsScraped,
    jobsScraped,
    jobsSaved: savedCount,
    sample_listings: sampleListings,
    targetCompanies: profileDigest.target_companies,
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let companyName = url.searchParams.get("company");

  if (!companyName) {
    try {
      const body = await request.json();
      companyName = body.company_name;
    } catch (e) {}
  }

  if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json({ error: "company query param or company_name body field is required" }, { status: 400 });
  }

  const targetName = companyName.trim().toLowerCase();
  const supabase = createAdminClient();

  const { data: userProfile, error: profileError } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  if (profileError || !userProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 500 });
  }

  const profileDigest = userProfile.profile_digest || {};
  const currentTargets: string[] = profileDigest.target_companies || [];

  const updatedTargets = currentTargets.filter(c => c.trim().toLowerCase() !== targetName);
  profileDigest.target_companies = updatedTargets;

  await supabase
    .from("users")
    .update({ profile_digest: profileDigest })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    company_name: companyName,
    targetCompanies: updatedTargets,
  });
}
