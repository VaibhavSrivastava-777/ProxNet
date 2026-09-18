import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverAts, detectAtsFromUrl } from "@/lib/ats-discovery";
import { STRATEGIES } from "@/lib/scrape-strategies";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Fetch user targets directly from user_target_companies table
  let { data: userTargetRows } = await supabase
    .from("user_target_companies")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // Fetch user profile for profile_digest fallback and embedding
  const { data: userProfile } = await supabase
    .from("users")
    .select("embedding, job_title, company, about, resume_text, profile_digest")
    .eq("id", user.id)
    .single();

  const legacyTargetNames: string[] = userProfile?.profile_digest?.target_companies || [];

  // Auto-backfill if legacy target_companies exist but aren't in user_target_companies
  const existingNamesSet = new Set((userTargetRows || []).map(r => r.company_name.toLowerCase().trim()));
  const missingFromUtc = legacyTargetNames.filter(name => !existingNamesSet.has(name.toLowerCase().trim()));

  if (missingFromUtc.length > 0) {
    for (const name of missingFromUtc) {
      const discovered = await discoverAts(name);
      await supabase.from("user_target_companies").upsert({
        user_id: user.id,
        company_name: name,
        careers_url: discovered?.board || null,
        ats_provider: discovered?.provider || "none",
        ats_board_token: discovered?.board || null,
        is_auto_discovered: Boolean(discovered),
        scrape_status: discovered ? "pending" : "no_ats",
        scrape_notes: discovered ? "Auto-synced from profile" : "No ATS detected",
        total_jobs_found: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,company_name" });
    }

    const { data: refetched } = await supabase
      .from("user_target_companies")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    userTargetRows = refetched;
  }

  if (!userTargetRows || userTargetRows.length === 0) {
    return NextResponse.json({
      targetCompanies: [],
      summary: { totalScraped: 0, totalMatches: 0 },
    });
  }

  const targets = userTargetRows.map(row => ({
    id: row.id,
    company_name: row.company_name,
    careers_url: row.careers_url || row.ats_board_token || "",
    ats_provider: row.ats_provider || "none",
    scrape_status: row.scrape_status || "pending",
    total_jobs_found: row.total_jobs_found || 0,
    last_scraped_at: row.last_scraped_at || null,
    scrape_notes: row.scrape_notes || null,
  }));

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

  // Priority 1: Check if user provided an explicit careers URL that matches a known ATS pattern
  if (careers_url) {
    const urlDetected = detectAtsFromUrl(careers_url);
    if (urlDetected) {
      provider = urlDetected.provider;
      boardTokenOrUrl = urlDetected.board;
    }
  }

  // Priority 2: If not detected from URL, probe known boards or database
  if (provider === "custom") {
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
  }

  // Save config state (company_ats_config schema: id, company_name, provider, board_token_or_url, scrape_notes, total_jobs_found, last_scraped_at)
  await supabase.from("company_ats_config").upsert({
    company_name: cleanName,
    provider,
    board_token_or_url: boardTokenOrUrl,
    scrape_notes: "status: scraping in progress",
    last_scraped_at: new Date().toISOString(),
  }, { onConflict: "company_name" });

  // 3. Execute Real-Time Scraping with a safety timeout wrapper (12 seconds)
  let scrapeResult: { scraped: number; saved: number; error?: string } = { scraped: 0, saved: 0 };
  try {
    const scrapePromise = scrapeTargetCompany(
      cleanName,
      provider,
      boardTokenOrUrl,
      user.id,
      userProfile.job_title,
      userProfile.company
    );
    const timeoutPromise = new Promise<{ scraped: number; saved: number; error: string }>((resolve) =>
      setTimeout(() => resolve({ scraped: 0, saved: 0, error: "timeout" }), 12000)
    );
    scrapeResult = await Promise.race([scrapePromise, timeoutPromise]);
  } catch (err: any) {
    console.error("Real-time scrape execution error:", err);
    scrapeResult = { scraped: 0, saved: 0, error: err.message };
  }

  // 4. Save into user_target_companies table
  const scrapeStatus = scrapeResult.scraped > 0 
    ? "success" 
    : (provider !== "none" && provider !== "no_ats" ? "pending" : "no_ats");

  const scrapeNotes = scrapeResult.error
    ? `Failed: ${scrapeResult.error}`
    : (scrapeResult.scraped > 0
        ? `Real-time: Scraped ${scrapeResult.scraped} jobs, ${scrapeResult.saved} saved`
        : (careers_url ? "Careers URL recorded" : "No active listings discovered"));

  const careersUrlValue = careers_url?.trim() || (boardTokenOrUrl.startsWith("http") ? boardTokenOrUrl : null);

  const { error: utcErr } = await supabase
    .from("user_target_companies")
    .upsert({
      user_id: user.id,
      company_name: cleanName,
      careers_url: careersUrlValue,
      ats_provider: provider,
      ats_board_token: boardTokenOrUrl || null,
      is_auto_discovered: !careers_url && provider !== "custom" && provider !== "none",
      scrape_status: scrapeStatus,
      scrape_notes: scrapeNotes,
      total_jobs_found: scrapeResult.scraped || 0,
      last_scraped_at: scrapeResult.scraped > 0 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,company_name" });

  if (utcErr) {
    console.error("Failed to upsert user_target_companies:", utcErr);
  } else {
    console.log(`[USER_TARGET_COMPANIES] Successfully upserted target company ${cleanName} for user ${user.id}`);
  }

  return NextResponse.json({
    success: true,
    company_name: cleanName,
    ats_provider: provider,
    board_url: boardTokenOrUrl,
    jobs_scraped: scrapeResult.scraped,
    jobs_saved: scrapeResult.saved,
    scrape_error: scrapeResult.error || null,
    message: scrapeResult.scraped > 0
      ? `Real-time scrape complete: Found ${scrapeResult.scraped} active openings (${scrapeResult.saved} saved) for ${cleanName}!`
      : `Target company ${cleanName} recorded (${provider}). ${scrapeResult.error ? `Scraper returned: ${scrapeResult.error}` : "0 jobs found on portal."}`,
    targetCompanies: profileDigest.target_companies,
  });
}

async function scrapeTargetCompany(
  cleanName: string,
  provider: string,
  boardTokenOrUrl: string,
  userId: string,
  userJobTitle?: string,
  userCompany?: string
): Promise<{ scraped: number; saved: number; error?: string }> {
  const supabase = createAdminClient();
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const strategy = STRATEGIES[provider] || STRATEGIES["custom"];
  if (!strategy || !boardTokenOrUrl) {
    return { scraped: 0, saved: 0, error: "No valid scraping strategy or URL" };
  }

  try {
    console.log(`[REALTIME SCRAPE START] ${cleanName} (${provider}) token/url: ${boardTokenOrUrl}`);
    const scrapedJobs = await strategy(boardTokenOrUrl, cleanName);
    console.log(`[REALTIME SCRAPE RAW] ${cleanName}: ${scrapedJobs?.length || 0} listings discovered.`);

    if (!scrapedJobs || scrapedJobs.length === 0) {
      await supabase.from("company_ats_config").upsert({
        company_name: cleanName,
        provider,
        board_token_or_url: boardTokenOrUrl,
        total_jobs_found: 0,
        scrape_notes: "status: 0 listings returned by portal",
        last_scraped_at: new Date().toISOString(),
      }, { onConflict: "company_name" });
      return { scraped: 0, saved: 0 };
    }

    // Limit to top 35 active listings for real-time responsiveness
    const toProcess = scrapedJobs.filter(j => j.title && j.title.trim().length >= 3).slice(0, 35);
    let savedCount = 0;

    // Batch generate embeddings via OpenAI in a single call if available
    let embeddings: (number[] | null)[] = [];
    if (OPENAI_KEY && toProcess.length > 0) {
      try {
        const textsToEmbed = toProcess.map(j =>
          `Company: ${cleanName}\nTitle: ${j.title}\nLocation: ${j.location || "Remote"}\nDescription: ${(j.description || j.title).slice(0, 1000)}`
        );
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: textsToEmbed,
            model: "text-embedding-3-small",
          }),
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          embeddings = (oaiData.data || []).map((item: any) => item.embedding || null);
        }
      } catch (embErr) {
        console.error("Batch embedding error for target company:", embErr);
      }
    }

    for (let i = 0; i < toProcess.length; i++) {
      const j = toProcess[i];
      const embedding = embeddings[i] || null;

      const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
        company: cleanName,
        title: j.title,
        location: j.location || "Remote",
        url: j.url || boardTokenOrUrl,
        posted_at: j.posted_at || new Date().toISOString(),
        description: j.description || j.title,
        ats_source: j.source || provider,
        embedding,
        created_at: new Date().toISOString(),
      }, { onConflict: "url" });

      if (insertErr) {
        console.error("scraped_jobs insert error:", insertErr.message);
      } else {
        savedCount++;
      }
    }

    await supabase.from("company_ats_config").upsert({
      company_name: cleanName,
      provider,
      board_token_or_url: boardTokenOrUrl,
      total_jobs_found: scrapedJobs.length,
      scrape_notes: `status: success (${scrapedJobs.length} raw, ${savedCount} saved)`,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: "company_name" });

    console.log(`[REALTIME SCRAPE COMPLETE] ${cleanName}: ${scrapedJobs.length} pulled, ${savedCount} stored.`);
    return { scraped: scrapedJobs.length, saved: savedCount };
  } catch (scrapeErr: any) {
    console.error(`[REALTIME SCRAPE ERROR] ${cleanName}:`, scrapeErr.message);
    await supabase.from("company_ats_config").upsert({
      company_name: cleanName,
      provider,
      board_token_or_url: boardTokenOrUrl,
      scrape_notes: `status: failed - ${scrapeErr.message}`,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: "company_name" });
    return { scraped: 0, saved: 0, error: scrapeErr.message };
  }
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

  // Delete from user_target_companies table
  const { error: delErr } = await supabase
    .from("user_target_companies")
    .delete()
    .eq("user_id", user.id)
    .ilike("company_name", companyName.trim());

  if (delErr) {
    console.warn("Error deleting from user_target_companies:", delErr);
  }

  return NextResponse.json({
    success: true,
    company_name: companyName,
    targetCompanies: updatedTargets,
  });
}
