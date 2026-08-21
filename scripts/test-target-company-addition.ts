import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { discoverAts } from "../lib/ats-discovery";
import { STRATEGIES } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });

async function testAddCompanyAndScrapeUnfiltered(companyName: string, customUrl?: string) {
  console.log(`\n======================================================`);
  console.log(`🧪 Testing Target Company Addition & Sample Scraper: "${companyName}"`);
  console.log(`======================================================`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const cleanName = companyName.trim();

  // 1. Resolve Scraper Strategy
  console.log(`🔍 Resolving scraper strategy for "${cleanName}"...`);
  let provider = "none";
  let boardTokenOrUrl = customUrl || "";

  const discovered = await discoverAts(cleanName);
  if (discovered) {
    provider = discovered.provider;
    boardTokenOrUrl = discovered.board;
    console.log(`  ✅ Discovered ATS Provider: ${provider} | Board/URL: ${boardTokenOrUrl}`);
  } else if (customUrl) {
    provider = "custom";
    boardTokenOrUrl = customUrl;
    console.log(`  ℹ️ Custom Careers URL provided: ${boardTokenOrUrl}`);
  } else {
    provider = "custom";
    boardTokenOrUrl = `https://careers.google.com/jobs/results/?q=${encodeURIComponent(cleanName)}`;
    console.log(`  ⚠️ Fallback Custom Scraper Defined: ${boardTokenOrUrl}`);
  }

  // Save config
  await supabase.from("company_ats_config").upsert({
    company_name: cleanName,
    provider,
    board_token_or_url: boardTokenOrUrl,
    last_scraped_at: new Date().toISOString(),
  }, { onConflict: "company_name" });

  // 2. Test Scraper (PULL ANY LISTING WITHOUT ANY FILTERS)
  const strategy = STRATEGIES[provider] || STRATEGIES["custom"];
  console.log(`⚡ Testing scraper strategy "${provider}" for ${cleanName} (Unfiltered)...`);

  let scrapedJobs: any[] = [];
  try {
    scrapedJobs = await strategy(boardTokenOrUrl, cleanName);
    console.log(`  🎉 Successfully pulled ${scrapedJobs.length} raw listings (UNFILTERED)!`);
  } catch (err: any) {
    console.error(`  ❌ Scraper test error:`, err.message);
  }

  if (scrapedJobs.length > 0) {
    console.log(`\n📋 Sample Listings Pulled (First 3):`);
    scrapedJobs.slice(0, 3).forEach((j, i) => {
      console.log(`  [${i + 1}] "${j.title}" | Loc: "${j.location || 'Unknown'}" | URL: ${j.url}`);
    });

    let savedCount = 0;
    for (const j of scrapedJobs) {
      if (!j.title || j.title.length < 3) continue;

      let embedding = null;
      if (openaiKey) {
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
            embedding = oaiData.data[0].embedding;
          }
        } catch (e) {}
      }

      const { error: insertErr } = await supabase.from("scraped_jobs").upsert({
        company: cleanName,
        title: j.title,
        location: j.location || "Remote",
        url: j.url || boardTokenOrUrl,
        posted_at: j.posted_at || new Date().toISOString(),
        description: j.description || j.title,
        source: j.source || provider,
        embedding,
        created_at: new Date().toISOString(),
      }, { onConflict: "url" });

      if (!insertErr) savedCount++;
    }

    console.log(`  ✅ Stored ${savedCount} listings into database for ${cleanName}.`);
  } else {
    console.log(`  ⚠️ Scraper test produced 0 listings for ${cleanName}.`);
  }
}

async function main() {
  const testCompanies = process.argv.slice(2);
  const targets = testCompanies.length > 0 ? testCompanies : ["Stripe", "Notion", "Figma"];

  for (const comp of targets) {
    await testAddCompanyAndScrapeUnfiltered(comp);
  }
  process.exit(0);
}

main();
