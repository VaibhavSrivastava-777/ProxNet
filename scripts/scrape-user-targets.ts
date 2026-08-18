import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { STRATEGIES, stripHtml } from "../lib/scrape-strategies";
import { discoverAts } from "../lib/ats-discovery";

dotenv.config({ path: ".env.local" });

const TARGET_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

function isJuniorJob(title: string, description: string): boolean {
  const t = title.toLowerCase();
  const d = description.toLowerCase();

  const seniorKeywords = ["senior", "sr.", "sr ", "lead", "principal", "staff", "director", "manager", "architect", "head", "vp", "chief"];
  if (seniorKeywords.some(kw => t.includes(kw))) return false;

  const juniorTitles = ["junior", "jr.", "jr ", "intern", "trainee", "fresher", "entry-level", "entry level"];
  if (juniorTitles.some(kw => t.includes(kw))) return true;

  const expRegexes = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?/gi,
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi,
    /min(?:imum)?\s*(\d+)\s*years?/gi,
  ];

  for (const regex of expRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(d)) !== null) {
      const val1 = parseInt(match[1], 10);
      const val2 = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(val1)) {
        if (val2 !== null) {
          if (val2 < 3) return true;
        } else {
          if (val1 < 3) return true;
        }
      }
    }
  }

  return false;
}

function isIndianOrRemote(location: string): boolean {
  if (!location) return true; // Accept omitted locations from India-scoped boards
  const loc = location.toLowerCase().trim();

  if (loc.includes("remote") || loc.includes("anywhere") || loc.includes("multiple locations") || loc.includes("various")) {
    return true;
  }

  const indianKeywords = [
    "india", "bangalore", "bengaluru", "mumbai", "pune", "delhi",
    "gurugram", "gurgaon", "noida", "hyderabad", "chennai", "kolkata",
    "kochi", "trivandrum", "thiruvananthapuram", "coimbatore", "chandigarh",
    "ahmedabad", "indore", "jaipur", "mysore", "mohali", "lucknow", "nagpur",
    "bhubaneswar", "visakhapatnam", "vadodara", "surat", "gandhinagar", "bhopal",
    "patna", "ludhiana", "thane", "navi mumbai",
    "maharashtra", "karnataka", "tamil nadu", "telangana", "andhra pradesh",
    "gujarat", "haryana", "uttar pradesh", "west bengal", "kerala", "punjab",
    "rajasthan", "madhya pradesh", "odisha",
  ];

  return indianKeywords.some(k => loc.includes(k)) || loc === "in" || loc === "ind" || loc.includes("pan india");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!url || !key) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!openaiKey) {
    console.error("Error: Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Fetch user profile + embedding
  console.log(`\n🔍 Fetching profile for user ${TARGET_USER_ID}...`);
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, resume_text, embedding, profile_digest")
    .eq("id", TARGET_USER_ID)
    .single();

  if (userError || !user) {
    console.error("Failed to fetch user:", userError?.message);
    process.exit(1);
  }

  console.log(`  ${user.full_name} | ${user.job_title} @ ${user.company}`);

  // 2. Fetch user's target companies from profile_digest & company_ats_config
  console.log(`\n📋 Fetching target companies from user profile_digest...`);
  const targetCompanyNames: string[] = user.profile_digest?.target_companies || [];

  if (targetCompanyNames.length === 0) {
    console.error("No target companies found in user profile_digest. Run seed-user-targets.ts first.");
    process.exit(1);
  }

  console.log(`  Found ${targetCompanyNames.length} target companies: ${targetCompanyNames.join(", ")}`);

  const { data: configs, error: configsError } = await supabase
    .from("company_ats_config")
    .select("*")
    .in("company_name", targetCompanyNames);

  if (configsError || !configs) {
    console.error("Failed to fetch ATS configs:", configsError?.message);
    process.exit(1);
  }

  const targetsMap = new Map(configs.map(c => [c.company_name.toLowerCase().trim(), c]));

  const targets = (await Promise.all(targetCompanyNames.map(async (name) => {
    const discovered = await discoverAts(name);
    const config = targetsMap.get(name.toLowerCase().trim());
    const provider = discovered?.provider || config?.provider || "none";
    const token = discovered?.board || config?.board_token_or_url || "";
    return {
      company_name: name,
      ats_provider: provider,
      ats_board_token: token,
      careers_url: token,
    };
  }))).filter(t => t.ats_provider !== "none");

  console.log(`  Scrapeable targets with ATS configs: ${targets.length}`);

  // 3. Scrape each target company
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const companyResults: Array<{
    company: string;
    provider: string;
    careersUrl: string;
    totalFromAts: number;
    savedCount: number;
    skipped: { date: number; location: number; experience: number; content: number };
    error?: string;
  }> = [];

  for (const target of targets) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`🔧 Scraping ${target.company_name} (${target.ats_provider})...`);

    const strategy = STRATEGIES[target.ats_provider];
    if (!strategy) {
      console.error(`  ⚠️ No strategy for provider: ${target.ats_provider}`);
      await supabase.from("company_ats_config").update({
        scrape_notes: `No strategy for provider: ${target.ats_provider}`,
        last_scraped_at: new Date().toISOString(),
      }).eq("company_name", target.company_name);

      companyResults.push({
        company: target.company_name,
        provider: target.ats_provider,
        careersUrl: target.careers_url || "",
        totalFromAts: 0,
        savedCount: 0,
        skipped: { date: 0, location: 0, experience: 0, content: 0 },
        error: "No strategy",
      });
      continue;
    }

    let jobs: any[] = [];
    try {
      jobs = await strategy(target.ats_board_token || target.careers_url || "", target.company_name);
    } catch (e: any) {
      console.error(`  ❌ Scrape failed: ${e.message}`);
      await supabase.from("company_ats_config").update({
        scrape_notes: `Scrape failed: ${e.message}`,
        last_scraped_at: new Date().toISOString(),
      }).eq("company_name", target.company_name);

      companyResults.push({
        company: target.company_name,
        provider: target.ats_provider,
        careersUrl: target.careers_url || "",
        totalFromAts: 0,
        savedCount: 0,
        skipped: { date: 0, location: 0, experience: 0, content: 0 },
        error: e.message,
      });
      continue;
    }

    console.log(`  Found ${jobs.length} total postings from ATS. Filtering & processing...`);
    if (jobs.length > 50) {
      console.log(`  (Capping processing to first 50 postings for speed...)`);
      jobs = jobs.slice(0, 50);
    }

    let savedCount = 0;
    const skipped = { date: 0, location: 0, experience: 0, content: 0 };

    for (const job of jobs) {
      // Date filter
      if (job.posted_at) {
        const jobDate = new Date(job.posted_at);
        if (!isNaN(jobDate.getTime()) && jobDate < twoWeeksAgo) {
          skipped.date++;
          continue;
        }
      }

      // Location filter (India only)
      if (!isIndianOrRemote(job.location || "")) {
        skipped.location++;
        continue;
      }

      // Content filter
      const hasTitle = job.title && job.title.trim() !== "" && job.title !== "Unknown Title" && job.title !== "Job Title";
      const hasDesc = job.description && job.description.trim() !== "" && job.description !== "No description provided";
      if (!hasTitle || !hasDesc) {
        skipped.content++;
        continue;
      }

      // Experience filter (no junior)
      if (isJuniorJob(job.title, job.description)) {
        skipped.experience++;
        continue;
      }

      // Generate keywords + embedding
      let embedding = null;
      let keywords: string[] = [];

      try {
        const textToEmbed = `Title: ${job.title}\nCompany: ${target.company_name}\nDescription: ${job.description}`.slice(0, 8000);

        // Keywords
        const kwPrompt = `Extract 3 to 5 technical skills or buzzwords from the job. Return a JSON object with key 'keywords' containing an array of strings.\n\nJob:\n${textToEmbed}`;
        const kwRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: kwPrompt }],
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (kwRes.ok) {
          const kwData = await kwRes.json();
          try {
            const parsed = JSON.parse(kwData.choices[0].message.content);
            keywords = Array.isArray(parsed) ? parsed : (Object.values(parsed)[0] as string[]);
            if (!Array.isArray(keywords)) keywords = [];
          } catch (e) {}
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
          signal: AbortSignal.timeout(15000),
        });

        if (embRes.ok) {
          const embData = await embRes.json();
          if (embData.data && embData.data.length > 0) {
            embedding = embData.data[0].embedding;
          }
        }
      } catch (e: any) {
        console.warn(`  ⚠️ AI processing failed for "${job.title}": ${e.message}`);
      }

      // Upsert into scraped_jobs
      const jobData: any = {
        company: target.company_name,
        title: job.title,
        location: job.location,
        url: job.url,
        description: (job.description || "").substring(0, 5000),
        ats_source: job.source,
        posted_at: job.posted_at,
        embedding,
      };

      let { error: insertError } = await supabase.from("scraped_jobs").upsert({
        ...jobData,
        keywords: keywords.slice(0, 5),
      }, { onConflict: "url" });

      if (insertError) {
        const errMsg = insertError.message || "";
        if (errMsg.includes("keywords") || errMsg.includes("column")) {
          const { error: retryError } = await supabase.from("scraped_jobs").upsert(jobData, { onConflict: "url" });
          insertError = retryError;
        }
      }

      if (!insertError) {
        savedCount++;
        process.stdout.write(`  ✅ ${job.title} (${job.location})\n`);
      } else {
        console.warn(`  ❌ DB error for "${job.title}": ${insertError.message}`);
      }
    }

    // Update company ATS config metadata
    await supabase.from("company_ats_config").update({
      last_scraped_at: new Date().toISOString(),
      total_jobs_found: jobs.length,
      scrape_notes: `Scraped ${jobs.length} total. Saved ${savedCount}. Skipped: ${skipped.date} date, ${skipped.location} loc, ${skipped.experience} exp, ${skipped.content} content.`,
    }).eq("company_name", target.company_name);

    companyResults.push({
      company: target.company_name,
      provider: target.ats_provider,
      careersUrl: target.careers_url || "",
      totalFromAts: jobs.length,
      savedCount,
      skipped,
    });

    console.log(`  Summary: ${jobs.length} from ATS → ${savedCount} saved (${skipped.date} date, ${skipped.location} loc, ${skipped.experience} exp, ${skipped.content} content)`);
  }

  // 4. Always generate fresh user embedding from latest resume + profile
  console.log(`\n🤖 Generating fresh user embedding from updated profile/resume...`);
  const denseContext = user.resume_text ? `Resume: ${user.resume_text}` : `About: ${user.about || "None"}`;
  const textToEmbed = `Company: ${user.company || "None"}\nRole: ${user.job_title || "None"}\n${denseContext}`.slice(0, 8000);

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

  let userEmbedding = null;
  if (oaiRes.ok) {
    const oaiData = await oaiRes.json();
    userEmbedding = oaiData.data[0].embedding;
    await supabase.from("users").update({ embedding: userEmbedding }).eq("id", TARGET_USER_ID);
    console.log(`  ✅ Fresh user embedding generated and saved for updated resume.`);
  } else {
    console.error(`  ❌ Failed to generate user embedding.`);
    process.exit(1);
  }

  // 5. Match jobs against user profile
  console.log(`\n🎯 Running match_scraped_jobs RPC (threshold ≥ 0.3)...`);
  const { data: matchedJobs, error: matchError } = await supabase.rpc("match_scraped_jobs", {
    query_embedding: userEmbedding,
    match_threshold: 0.3,
    match_count: 200,
  });

  if (matchError) {
    console.error("Match RPC failed:", matchError.message);
    process.exit(1);
  }

  // Filter matched jobs to only the user's target companies
  const targetCompanySet = new Set(targets.map(t => t.company_name.toLowerCase().trim()));
  const targetMatches = (matchedJobs || []).filter((job: any) => {
    const jobCompany = (job.company || "").toLowerCase().trim();
    return targetCompanySet.has(jobCompany);
  });

  // Group matches by company
  const matchesByCompany: Record<string, Array<{ id: string; title: string; matchRate: number; location: string; url: string }>> = {};
  for (const job of targetMatches) {
    const matchRate = Math.min(99, Math.max(0, Math.round(((job.similarity - 0.25) / 0.35) * 100)));
    if (matchRate < 60) continue;

    const companyKey = (job.company || "").trim();
    if (!matchesByCompany[companyKey]) {
      matchesByCompany[companyKey] = [];
    }
    matchesByCompany[companyKey].push({
      id: job.id,
      title: job.title,
      matchRate,
      location: job.location || "Remote",
      url: job.url || "",
    });
  }

  // Sort matches within each company by match rate descending
  for (const key of Object.keys(matchesByCompany)) {
    matchesByCompany[key].sort((a, b) => b.matchRate - a.matchRate);
  }

  // 6. Print results table
  const totalScraped = companyResults.reduce((sum, r) => sum + r.savedCount, 0);
  const totalMatches = Object.values(matchesByCompany).reduce((sum, jobs) => sum + jobs.length, 0);

  console.log(`\n${"═".repeat(110)}`);
  console.log("JOB MATCH RESULTS FOR USER TARGET COMPANIES");
  console.log(`${"═".repeat(110)}`);
  console.log(
    "Company".padEnd(22) +
    "Provider".padEnd(15) +
    "Careers URL".padEnd(40) +
    "Scraped".padEnd(10) +
    "≥60% Match".padEnd(12) +
    "Top Match"
  );
  console.log("─".repeat(110));

  for (const r of companyResults) {
    const matches = matchesByCompany[r.company] || [];
    const topMatch = matches.length > 0
      ? `${matches[0].matchRate}% — ${matches[0].title.substring(0, 25)}`
      : "—";

    const urlDisplay = r.careersUrl
      ? r.careersUrl.length > 38
        ? r.careersUrl.substring(0, 35) + "..."
        : r.careersUrl
      : "—";

    console.log(
      r.company.padEnd(22) +
      r.provider.padEnd(15) +
      urlDisplay.padEnd(40) +
      String(r.savedCount).padEnd(10) +
      String(matches.length).padEnd(12) +
      topMatch
    );
  }

  console.log("─".repeat(110));
  console.log(`\n📊 Summary: Out of ${totalScraped} jobs scraped from ${companyResults.length} companies, ${totalMatches} have ≥60% match rate for user ${TARGET_USER_ID}.`);

  // Print detailed matches
  if (totalMatches > 0) {
    console.log(`\n${"═".repeat(80)}`);
    console.log("DETAILED MATCHES (≥60%)");
    console.log(`${"═".repeat(80)}`);

    for (const [company, jobs] of Object.entries(matchesByCompany)) {
      console.log(`\n  📂 ${company} (${jobs.length} matches):`);
      for (const job of jobs) {
        console.log(`     ${job.matchRate}% — ${job.title} (${job.location})`);
        if (job.url) console.log(`          ${job.url}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
