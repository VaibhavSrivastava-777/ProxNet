import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { discoverAts } from "../lib/ats-discovery";
import { STRATEGIES } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });

const TARGET_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

interface ScrapeReport {
  company: string;
  provider: string;
  boardUrl: string;
  rawPulled: number;
  savedCount: number;
  highMatchCount: number;
  topMatchTitle?: string;
  topMatchScore?: number;
  sampleListing?: string;
}

async function main() {
  console.log(`================================================================================`);
  console.log(`🌐 PROXNET ALL-COMPANY SCRAPER & MATCH ENGINE (UNFILTERED SAMPLE SCRAPERS)`);
  console.log(`================================================================================\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing Supabase credentials.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch user details and user target companies
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, resume_text, profile_digest, embedding")
    .eq("id", TARGET_USER_ID)
    .single();

  if (userError || !user) {
    console.error("Failed to fetch target user profile:", userError?.message);
    process.exit(1);
  }

  console.log(`👤 Target User: ${user.full_name} (${user.job_title} @ ${user.company})`);

  const userTargetCompanies: string[] = user.profile_digest?.target_companies || [];
  console.log(`🎯 User Specified Target Companies: ${userTargetCompanies.join(", ")}`);

  // 2. Fetch network companies from users table
  const { data: userRows } = await supabase.from("users").select("company").not("company", "is", null);
  const networkCompanies: string[] = Array.from(new Set(
    (userRows || []).map(u => u.company?.trim()).filter((c): c is string => Boolean(c) && c.length > 1)
  ));

  console.log(`👥 ProxNet Network Companies: ${networkCompanies.join(", ")}`);

  // 3. Core ProxNet ecosystem companies from KNOWN_BOARDS
  const coreEcosystemCompanies = [
    "Flipkart", "Swiggy", "Meesho", "Razorpay", "Zerodha", "PhonePe", "Cred",
    "Groww", "Zomato", "Ola", "Paytm", "Freshworks", "Postman", "BrowserStack",
    "Dell", "Google", "Microsoft", "Amazon", "Apple", "Uber", "Notion", "Figma", "Stripe"
  ];

  // Master deduplicated company list (case-insensitive deduplication, ignore non-company strings)
  const ignoreList = ["retired", "independent advisory practice", "none", "n/a", "null", "student", "self employed", "freelance"];
  const masterMap = new Map<string, string>();

  const addComp = (c: string) => {
    if (!c) return;
    const clean = c.trim();
    const lower = clean.toLowerCase();
    if (ignoreList.includes(lower) || lower.length < 2) return;
    if (!masterMap.has(lower)) {
      masterMap.set(lower, clean);
    }
  };

  userTargetCompanies.forEach(addComp);
  networkCompanies.forEach(addComp);
  coreEcosystemCompanies.forEach(addComp);

  const allCompanies = Array.from(masterMap.values());
  console.log(`\n📋 Master Company Evaluation List (${allCompanies.length} companies):`);
  console.log(`   ${allCompanies.join(", ")}\n`);

  const reports: ScrapeReport[] = [];

  // 4. Test Scraper & Pull Any Listings (Unfiltered) for Each Company
  for (let i = 0; i < allCompanies.length; i++) {
    const cleanName = allCompanies[i].trim();
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${allCompanies.length}] 🧪 Testing Scraper for "${cleanName}"...`);

    let provider = "custom";
    let boardTokenOrUrl = `https://careers.google.com/jobs/results/?q=${encodeURIComponent(cleanName)}`;

    const discovered = await discoverAts(cleanName);
    if (discovered) {
      provider = discovered.provider;
      boardTokenOrUrl = discovered.board;
      console.log(`  ✅ Discovered ATS Provider: ${provider} | Board: ${boardTokenOrUrl}`);
    } else {
      const { data: existingConfig } = await supabase
        .from("company_ats_config")
        .select("*")
        .ilike("company_name", cleanName)
        .single();

      if (existingConfig) {
        provider = existingConfig.provider;
        boardTokenOrUrl = existingConfig.board_token_or_url || boardTokenOrUrl;
        console.log(`  ℹ️ Existing ATS Config: ${provider} | Board: ${boardTokenOrUrl}`);
      } else {
        console.log(`  ⚠️ Fallback Custom Scraper: ${provider} | URL: ${boardTokenOrUrl}`);
      }
    }

    // Save/update ATS config
    await supabase.from("company_ats_config").upsert({
      company_name: cleanName,
      provider,
      board_token_or_url: boardTokenOrUrl,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: "company_name" });

    const strategy = STRATEGIES[provider] || STRATEGIES["custom"];
    let rawJobs: any[] = [];

    try {
      rawJobs = await strategy(boardTokenOrUrl, cleanName);
      console.log(`  🎉 Scraper pulled ${rawJobs.length} raw listings (UNFILTERED).`);
    } catch (e: any) {
      console.error(`  ❌ Scraper error for ${cleanName}:`, e.message);
    }

    let savedCount = 0;
    let sampleTitle = rawJobs[0]?.title;

    if (rawJobs.length > 0) {
      console.log(`  Sample: "${rawJobs[0].title}" (${rawJobs[0].location || "Remote"})`);
      // Save top postings (cap at 50 per company for bulk efficiency)
      const toProcess = rawJobs.slice(0, 50);

      // Generate embeddings in parallel
      const embeddings = openaiKey ? await Promise.all(toProcess.map(async j => {
        if (!j.title || j.title.length < 3) return null;
        try {
          const textToEmbed = `Company: ${cleanName}\nTitle: ${j.title}\nLocation: ${j.location}\nDescription: ${(j.description || j.title).slice(0, 1000)}`;
          const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
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
          if (oaiRes.ok) {
            const oaiData = await oaiRes.json();
            return oaiData.data[0].embedding;
          }
        } catch (e) {}
        return null;
      })) : [];

      for (let jIdx = 0; jIdx < toProcess.length; jIdx++) {
        const j = toProcess[jIdx];
        if (!j.title || j.title.length < 3) continue;

        const embedding = embeddings[jIdx] || null;

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
    }

    // Update config stats with total raw listings found
    await supabase.from("company_ats_config").upsert({
      company_name: cleanName,
      provider,
      board_token_or_url: boardTokenOrUrl,
      total_jobs_found: rawJobs.length,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: "company_name" });

    reports.push({
      company: cleanName,
      provider,
      boardUrl: boardTokenOrUrl,
      rawPulled: rawJobs.length,
      savedCount,
      highMatchCount: 0,
      sampleListing: sampleTitle
    });
  }

  // 5. Generate fresh user embedding if needed
  let userEmbedding = user.embedding;
  if (openaiKey && user.resume_text) {
    console.log(`\n🤖 Refreshing user embedding from latest resume...`);
    const profileText = `Title: ${user.job_title}\nCompany: ${user.company}\nAbout: ${user.about || ""}\nResume: ${(user.resume_text || "").slice(0, 3000)}`;
    try {
      const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: profileText,
          model: "text-embedding-3-small",
        }),
      });
      if (oaiRes.ok) {
        const oaiData = await oaiRes.json();
        userEmbedding = oaiData.data[0].embedding;
        await supabase.from("users").update({ embedding: userEmbedding }).eq("id", TARGET_USER_ID);
        console.log(`  ✅ User embedding refreshed.`);
      }
    } catch (e) {}
  }

  // 6. Execute match_scraped_jobs RPC
  console.log(`\n🎯 Calculating vector match scores for user ${user.full_name}...`);
  const { data: matchedRows } = await supabase.rpc("match_scraped_jobs", {
    query_embedding: userEmbedding,
    match_threshold: 0.3,
    match_count: 500
  });

  const matchesByCompany = new Map<string, Array<{ title: string; matchRate: number }>>();

  (matchedRows || []).forEach((row: any) => {
    const rawSim = row.similarity || 0;
    const matchRate = Math.min(99, Math.max(0, Math.round(((rawSim - 0.25) / 0.35) * 100)));
    if (matchRate < 60) return;

    const compName = row.company.toLowerCase().trim();
    if (!matchesByCompany.has(compName)) matchesByCompany.set(compName, []);
    matchesByCompany.get(compName)!.push({ title: row.title, matchRate });
  });

  // Attach match metrics to reports
  reports.forEach(r => {
    const compMatches = matchesByCompany.get(r.company.toLowerCase().trim()) || [];
    r.highMatchCount = compMatches.length;
    if (compMatches.length > 0) {
      compMatches.sort((a, b) => b.matchRate - a.matchRate);
      r.topMatchTitle = compMatches[0].title;
      r.topMatchScore = compMatches[0].matchRate;
    }
  });

  // 7. Output Final Master Report Table
  console.log(`\n================================================================================================================`);
  console.log(`📊 MASTER SCRAPER & MATCH REPORT FOR ALL PROXNET & TARGET COMPANIES`);
  console.log(`================================================================================================================`);
  console.log(`Company               Provider       Board / URL                              Raw Listings   Saved   ≥60% Matches  Top Matched Role`);
  console.log(`----------------------------------------------------------------------------------------------------------------`);

  reports.forEach(r => {
    const compPad = r.company.padEnd(20).slice(0, 20);
    const provPad = r.provider.padEnd(14).slice(0, 14);
    const urlPad = r.boardUrl.padEnd(40).slice(0, 40);
    const rawPad = String(r.rawPulled).padEnd(14);
    const savedPad = String(r.savedCount).padEnd(7);
    const matchPad = String(r.highMatchCount).padEnd(13);
    const topStr = r.topMatchScore ? `${r.topMatchScore}% — ${r.topMatchTitle}` : "—";

    console.log(`${compPad} ${provPad} ${urlPad} ${rawPad} ${savedPad} ${matchPad} ${topStr}`);
  });

  console.log(`----------------------------------------------------------------------------------------------------------------`);
  const totalRaw = reports.reduce((sum, r) => sum + r.rawPulled, 0);
  const totalSaved = reports.reduce((sum, r) => sum + r.savedCount, 0);
  const totalMatches = reports.reduce((sum, r) => sum + r.highMatchCount, 0);
  console.log(`TOTALS: ${reports.length} companies evaluated | ${totalRaw} raw listings pulled | ${totalSaved} saved into DB | ${totalMatches} matched ≥60%\n`);

  process.exit(0);
}

main();
