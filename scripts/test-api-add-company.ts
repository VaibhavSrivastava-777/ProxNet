import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { discoverAts } from "../lib/ats-discovery";
import { STRATEGIES } from "../lib/scrape-strategies";

dotenv.config({ path: ".env.local" });

const TARGET_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

async function testApiAddCompany(companyName: string) {
  console.log(`\n======================================================`);
  console.log(`🚀 Simulating Adding Target Company: "${companyName}"`);
  console.log(`======================================================`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const cleanName = companyName.trim();

  // 1. Discover ATS Strategy
  let provider = "custom";
  let boardTokenOrUrl = `https://careers.google.com/jobs/results/?q=${encodeURIComponent(cleanName)}`;

  const discovered = await discoverAts(cleanName);
  if (discovered) {
    provider = discovered.provider;
    boardTokenOrUrl = discovered.board;
  }

  console.log(`📌 Scraper defined: Provider="${provider}", Board="${boardTokenOrUrl}"`);

  // 2. Test Scraper (Unfiltered)
  const strategy = STRATEGIES[provider] || STRATEGIES["custom"];
  const scrapedJobs = await strategy(boardTokenOrUrl, cleanName);

  console.log(`📊 Test Scrape Result (UNFILTERED):`);
  console.log(`   - Raw Listings Pulled: ${scrapedJobs.length}`);

  if (scrapedJobs.length > 0) {
    console.log(`   - Sample Listings (First 3):`);
    scrapedJobs.slice(0, 3).forEach((j, i) => {
      console.log(`     [${i + 1}] "${j.title}" (${j.location || "Remote"}) -> ${j.url}`);
    });
  }

  // 3. Save config
  await supabase.from("company_ats_config").upsert({
    company_name: cleanName,
    provider,
    board_token_or_url: boardTokenOrUrl,
    total_jobs_found: scrapedJobs.length,
    last_scraped_at: new Date().toISOString(),
  }, { onConflict: "company_name" });

  console.log(`✅ Scraper definition and test listing pull complete for ${cleanName}.`);
}

async function main() {
  await testApiAddCompany("Apple");
  process.exit(0);
}

main();
