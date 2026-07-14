/**
 * Wipro Jobs Counter — via Sitemap XML
 * 
 * Wipro's careers portal (SAP SuccessFactors) publishes a sitemap for individual job pages.
 * We fetch sitemap-jobs.xml to get all job URLs + lastmod dates, then filter for
 * India locations in the last 1 month.
 * 
 * Run: node scripts/scrape-wipro-sitemap.mjs
 */

const INDIA_KEYWORDS = ["india","bangalore","bengaluru","mumbai","hyderabad","delhi","pune","remote","chennai","noida","gurugram","gurgaon"];
const TARGET_CITIES = { bangalore: "Bangalore", bengaluru: "Bangalore", mumbai: "Mumbai", hyderabad: "Hyderabad", "new delhi": "New Delhi", delhi: "New Delhi", pune: "Pune", remote: "Remote" };

const ONE_MONTH_AGO = new Date();
ONE_MONTH_AGO.setMonth(ONE_MONTH_AGO.getMonth() - 1);

function matchCity(url, loc) {
  const text = (url + " " + loc).toLowerCase();
  for (const [key, city] of Object.entries(TARGET_CITIES)) {
    if (text.includes(key)) return city;
  }
  return null;
}

function isIndia(url, loc) {
  const text = (url + " " + loc).toLowerCase();
  return INDIA_KEYWORDS.some(k => text.includes(k));
}

async function fetchWithTimeout(url, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
        "Accept": "application/xml, text/xml, */*",
      }
    });
    clearTimeout(timer);
    return res;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

async function tryFetchJobsViaSearch() {
  // Try the internal SuccessFactors search API used by some SF customers
  // This uses the j2w REST search with a known variant
  const endpoints = [
    "https://careers.wipro.com/search/?q=&location=India&sortColumn=referencedate&sortDirection=desc&numItems=100&startIndex=0&format=json",
    "https://careers.wipro.com/json/search?q=&location=India&sortColumn=referencedate&sortDirection=desc&numItems=50",
    "https://careers.wipro.com/search?q=&location=India&format=json",
  ];

  for (const url of endpoints) {
    console.log(`\n[PROBE] ${url}`);
    try {
      const res = await fetchWithTimeout(url, 15000);
      const ct = res.headers.get("content-type") || "";
      const body = await res.text();
      console.log(`  Status: ${res.status}, CT: ${ct}, Length: ${body.length}`);
      if (ct.includes("json")) {
        console.log(`  Preview: ${body.substring(0, 300)}`);
        return body;
      }
    } catch(e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  return null;
}

async function fetchSitemap() {
  const sitemapUrls = [
    "https://careers.wipro.com/sitemap-jobs.xml",
    "https://careers.wipro.com/sitemap.xml",
    "https://careers.wipro.com/robots.txt",
  ];

  // First check robots.txt for sitemap location
  console.log("\n[STEP 1] Checking robots.txt for sitemap hints...");
  try {
    const res = await fetchWithTimeout("https://careers.wipro.com/robots.txt", 10000);
    const text = await res.text();
    console.log(`  robots.txt (${text.length} chars):\n${text.substring(0, 500)}`);
    const sitemapLine = text.match(/Sitemap:\s*(.+)/i);
    if (sitemapLine) {
      const discovered = sitemapLine[1].trim();
      console.log(`  → Found sitemap: ${discovered}`);
      if (!sitemapUrls.includes(discovered)) sitemapUrls.unshift(discovered);
    }
  } catch(e) {
    console.log(`  Error: ${e.message}`);
  }

  // Now try each sitemap
  for (const url of sitemapUrls) {
    console.log(`\n[SITEMAP] Fetching: ${url} (timeout: 120s)`);
    try {
      const res = await fetchWithTimeout(url, 120000);
      console.log(`  Status: ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      console.log(`  Content-Type: ${ct}`);
      const text = await res.text();
      console.log(`  Size: ${text.length} chars`);

      if (text.length < 500 || text.includes("<!DOCTYPE html")) {
        console.log("  → HTML response (not a sitemap), skipping");
        continue;
      }

      // Parse XML sitemap
      if (text.includes("<urlset") || text.includes("<sitemapindex") || text.includes("<url>")) {
        console.log("  → Looks like a sitemap! Parsing...");
        return { url, text };
      }
      console.log(`  Preview: ${text.substring(0, 200)}`);
    } catch(e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  return null;
}

function parseSitemap(xml) {
  const entries = [];
  
  // Check if it's a sitemap index (contains other sitemaps)
  const isSitemapIndex = xml.includes("<sitemapindex");
  
  if (isSitemapIndex) {
    const sitemapMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
    console.log(`  → Sitemap index with ${sitemapMatches.length} child sitemaps`);
    return { isSitemapIndex: true, childSitemaps: sitemapMatches.map(m => m[1].trim()) };
  }

  // Parse individual URLs
  const urlMatches = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  for (const match of urlMatches) {
    const urlBlock = match[1];
    const locMatch = urlBlock.match(/<loc>([^<]+)<\/loc>/);
    const lastmodMatch = urlBlock.match(/<lastmod>([^<]+)<\/lastmod>/);
    
    if (locMatch) {
      entries.push({
        url: locMatch[1].trim(),
        lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      });
    }
  }
  
  console.log(`  → Parsed ${entries.length} URL entries`);
  return { isSitemapIndex: false, entries };
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Wipro Jobs Counter (Sitemap Method)");
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  1-month cutoff: ${ONE_MONTH_AGO.toISOString()}`);
  console.log("=".repeat(60));

  // Step 1: Try JSON API endpoints first (faster)
  const jsonResult = await tryFetchJobsViaSearch();
  
  // Step 2: Try sitemap
  const sitemapResult = await fetchSitemap();
  
  if (!sitemapResult) {
    console.log("\n❌ Could not retrieve sitemap. Wipro's careers site is entirely JS-rendered.");
    console.log("   To get exact job counts, you would need Playwright/Puppeteer.");
    console.log("   Manual URL to check: https://careers.wipro.com/search/?q=&location=India&sortColumn=referencedate&sortDirection=desc");
    return;
  }

  let allEntries = [];
  const { url, text } = sitemapResult;
  const parsed = parseSitemap(text);
  
  if (parsed.isSitemapIndex) {
    // Need to fetch child sitemaps
    console.log("\n[STEP 3] Fetching child sitemaps...");
    for (const childUrl of (parsed.childSitemaps || []).slice(0, 5)) {
      console.log(`  Fetching: ${childUrl}`);
      try {
        const res = await fetchWithTimeout(childUrl, 60000);
        const childText = await res.text();
        if (childText.includes("<url>")) {
          const childParsed = parseSitemap(childText);
          if (!childParsed.isSitemapIndex) {
            allEntries.push(...(childParsed.entries || []));
          }
        }
      } catch(e) {
        console.log(`    Error: ${e.message}`);
      }
    }
  } else {
    allEntries = parsed.entries || [];
  }

  console.log(`\n[TOTAL] ${allEntries.length} total sitemap entries`);

  // Filter for job pages
  const jobEntries = allEntries.filter(e => 
    e.url.includes("/job/") || e.url.includes("/jobs/") || e.url.match(/\/\d{6,}/)
  );
  console.log(`[JOBS] ${jobEntries.length} entries look like job postings`);

  // Filter for India + last 1 month
  const cityCount = { Bangalore: 0, Mumbai: 0, Hyderabad: 0, "New Delhi": 0, Pune: 0, Remote: 0, "Other India": 0 };
  let withinMonth = 0, olderThanMonth = 0, noDate = 0;
  const qualifiedJobs = [];

  for (const entry of jobEntries) {
    if (!isIndia(entry.url, "")) continue;

    if (entry.lastmod) {
      const d = new Date(entry.lastmod);
      if (!isNaN(d.getTime()) && d < ONE_MONTH_AGO) { olderThanMonth++; continue; }
      withinMonth++;
    } else {
      noDate++;
    }

    qualifiedJobs.push(entry);
    const city = matchCity(entry.url, "");
    if (city) cityCount[city]++;
    else cityCount["Other India"]++;
  }

  // Sample output
  if (jobEntries.length > 0) {
    console.log("\n[SAMPLE JOB URLs from sitemap]:");
    jobEntries.slice(0, 5).forEach(e => console.log(`  ${e.url} | lastmod: ${e.lastmod || "none"}`));
  }

  console.log("\n" + "=".repeat(60));
  console.log("  WIPRO INDIA JOB POSTINGS — LAST 1 MONTH");
  console.log("=".repeat(60));
  console.log(`\nTotal sitemap entries:        ${allEntries.length}`);
  console.log(`Job-like entries:             ${jobEntries.length}`);
  console.log(`India-location jobs:          ${qualifiedJobs.length + olderThanMonth}`);
  console.log(`  → Within last 1 month:      ${qualifiedJobs.length}`);
  console.log(`  → Older than 1 month:       ${olderThanMonth}`);
  console.log(`  → No date info:             ${noDate}`);
  
  console.log("\n📍 Breakdown by City:");
  Object.entries(cityCount).filter(([,c]) => c > 0).forEach(([city, count]) => {
    console.log(`  ${city.padEnd(20)} ${count}`);
  });
  console.log(`${"─".repeat(35)}`);
  console.log(`  TOTAL                ${qualifiedJobs.length}`);
}

main().catch(console.error);
