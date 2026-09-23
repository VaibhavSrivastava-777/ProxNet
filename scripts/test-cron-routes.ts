import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import assert from "assert";
import { GET as digestGet } from "../app/api/cron/daily-admin-digest/route";
import { GET as scraperGet } from "../app/api/cron/scrape-network-and-competitors/route";

async function run() {
  console.log("================================================================================");
  console.log("🧪 TEST SUITE: CRON ROUTE HANDLERS AUTH & EXECUTION");
  console.log("================================================================================\n");

  // 1. Test Daily Admin Digest Route without Auth (Must return 401)
  console.log("[Test 1] Testing unauthenticated call to daily-admin-digest...");
  const unauthReq = new Request("https://www.proxnet.in/api/cron/daily-admin-digest");
  const unauthRes = await digestGet(unauthReq);
  console.log(`   Unauthenticated response status: ${unauthRes.status}`);
  assert(unauthRes.status === 401, "Unauthenticated request must be rejected with 401");

  // 2. Test Daily Admin Digest Route with Vercel Cron header
  console.log("\n[Test 2] Testing authenticated call with x-vercel-cron header...");
  const authReq = new Request("https://www.proxnet.in/api/cron/daily-admin-digest", {
    headers: { "x-vercel-cron": "1" },
  });
  const authRes = await digestGet(authReq);
  console.log(`   Authenticated response status: ${authRes.status}`);
  assert(authRes.status === 200, "Authenticated request must return 200");
  const authData = await authRes.json();
  console.log(`   Digest output:`, {
    success: authData.success,
    recipient: authData.recipient,
    date: authData.date,
    metrics: authData.metrics,
  });
  assert(authData.success === true, "Digest execution must succeed");
  assert(authData.recipient === "ProxNet.Connect@Gmail.com", "Recipient must be ProxNet.Connect@Gmail.com");

  // 3. Test Scraper Route with limit=1 and company filter
  console.log("\n[Test 3] Testing scrape-network-and-competitors route with company filter...");
  const scrapeReq = new Request("https://www.proxnet.in/api/cron/scrape-network-and-competitors?limit=1&company=Meesho", {
    headers: { "x-vercel-cron": "1" },
  });
  const scrapeRes = await scraperGet(scrapeReq);
  console.log(`   Scraper response status: ${scrapeRes.status}`);
  assert(scrapeRes.status === 200, "Scraper route must return 200");
  const scrapeData = await scrapeRes.json();
  console.log(`   Scraper output:`, {
    success: scrapeData.success,
    totalScraped: scrapeData.totalScraped,
    totalSaved: scrapeData.totalSaved,
    processedCompanies: scrapeData.processedCompanies,
  });
  assert(scrapeData.success === true, "Scraper execution must succeed");

  console.log("\n================================================================================");
  console.log("🎉 ALL CRON ROUTE TESTS PASSED!");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
