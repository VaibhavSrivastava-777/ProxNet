/**
 * Wipro Jobs Scraper — SAP SuccessFactors (careers.wipro.com)
 * 
 * Wipro uses SAP SuccessFactors (hosted on hcm55.sapsf.eu).
 * The careers portal loads jobs via the internal j2w REST API.
 * 
 * Run: npx ts-node --project tsconfig.scripts.json scripts/scrape-wipro-jobs.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const INDIA_KEYWORDS = [
  "india", "bangalore", "bengaluru", "mumbai", "hyderabad",
  "new delhi", "delhi", "pune", "remote", "chennai", "noida",
  "gurugram", "gurgaon"
];

const TARGET_CITIES = ["bangalore", "bengaluru", "mumbai", "hyderabad", "new delhi", "delhi", "pune", "remote"];

const PAGE_SIZE = 50;
const BASE_URL = "https://careers.wipro.com";

// SAP SuccessFactors internal search API (called via XHR by the careers portal)
const SF_SEARCH_ENDPOINT = `${BASE_URL}/search/`;

interface WiproJob {
  title: string;
  location: string;
  url: string;
  posted_at: string | null;
  requisition_id: string;
}

function isIndiaLocation(loc: string): boolean {
  const l = loc.toLowerCase();
  return INDIA_KEYWORDS.some(k => l.includes(k));
}

function matchesTargetCity(loc: string): string | null {
  const l = loc.toLowerCase();
  if (l.includes("bangalore") || l.includes("bengaluru")) return "Bangalore";
  if (l.includes("mumbai")) return "Mumbai";
  if (l.includes("hyderabad")) return "Hyderabad";
  if (l.includes("new delhi") || l.includes("delhi")) return "New Delhi";
  if (l.includes("pune")) return "Pune";
  if (l.includes("remote")) return "Remote";
  return null;
}

function isWithinOneMonth(dateStr: string | null): boolean {
  if (!dateStr) return true; // If no date info, include it
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return true;
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return date >= oneMonthAgo;
}

async function fetchJobsPage(startIndex: number): Promise<{ jobs: WiproJob[], totalCount: number | null }> {
  // SuccessFactors j2w REST search endpoint 
  // The portal calls this as an AJAX request with Accept: application/json
  const params = new URLSearchParams({
    q: "",
    location: "India",
    sortColumn: "referencedate",
    sortDirection: "desc",
    numItems: String(PAGE_SIZE),
    startIndex: String(startIndex),
  });

  const url = `${BASE_URL}/search/?${params.toString()}`;
  
  console.log(`  [FETCH] GET ${url}`);
  
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://careers.wipro.com/search/",
    },
    signal: AbortSignal.timeout(30000),
  });

  console.log(`  [STATUS] ${res.status} ${res.statusText}`);

  if (!res.ok) {
    console.error(`  [ERROR] HTTP ${res.status}`);
    return { jobs: [], totalCount: null };
  }

  const contentType = res.headers.get("content-type") || "";
  console.log(`  [CONTENT-TYPE] ${contentType}`);

  if (contentType.includes("json")) {
    const data: any = await res.json();
    console.log(`  [JSON] Keys: ${Object.keys(data as object).join(", ")}`);
    
    // Parse SuccessFactors JSON job listing response
    const jobs: WiproJob[] = [];
    const items = data.jobs || data.results || data.data || data.jobPostings || [];
    const totalCount = data.totalCount || data.total || data.count || null;

    for (const j of items) {
      jobs.push({
        title: j.title || j.jobTitle || j.name || "Unknown",
        location: j.location || j.city || j.jobLocation || "Unknown",
        url: j.url || j.jobUrl || j.applyUrl || `${BASE_URL}/job/${j.id || j.jobId || ""}`,
        posted_at: j.postedDate || j.updatedDate || j.startDate || j.referenceDate || null,
        requisition_id: j.id || j.jobId || j.requisitionId || "",
      });
    }
    return { jobs, totalCount };
  }

  // HTML response — need to parse embedded JSON or job markup
  const html = await res.text();
  console.log(`  [HTML] Length: ${html.length} chars`);
  
  // Look for embedded JSON data in script tags (common SF pattern)
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s) ||
                    html.match(/var\s+searchData\s*=\s*({.+?});/s) ||
                    html.match(/jobSearchResults\s*=\s*({.+?});/s) ||
                    html.match(/"jobs"\s*:\s*(\[.+?\])/s);
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      console.log(`  [EMBEDDED JSON] Found`);
      const items = Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.results || []);
      const jobs: WiproJob[] = items.map((j: any) => ({
        title: j.title || j.jobTitle || "Unknown",
        location: j.location || j.city || "Unknown",
        url: j.url || `${BASE_URL}/job/${j.id || ""}`,
        posted_at: j.postedDate || j.updatedDate || null,
        requisition_id: j.id || "",
      }));
      return { jobs, totalCount: null };
    } catch(e) {
      console.log(`  [EMBEDDED JSON] Parse failed`);
    }
  }

  // Parse job listing HTML elements (SF uses specific data attributes)
  const jobCount = (html.match(/class="[^"]*jobTitle[^"]*"/g) || []).length;
  const totalMatch = html.match(/(\d[\d,]+)\s*(jobs?|positions?|result)/i);
  const totalFromHtml = totalMatch ? parseInt(totalMatch[1].replace(/,/g, "")) : null;

  console.log(`  [HTML PARSE] Job elements found: ${jobCount}, Total mentioned: ${totalFromHtml}`);

  // Extract job data from HTML using regex patterns for SF job cards
  const jobs: WiproJob[] = [];
  
  // Match data-job-id / data-requisition-id patterns used by SuccessFactors
  const jobIdMatches = [...html.matchAll(/data-job-id="([^"]+)"/g)];
  const titleMatches = [...html.matchAll(/class="[^"]*jobTitle[^"]*"[^>]*>([^<]+)</g)];
  const locationMatches = [...html.matchAll(/class="[^"]*jobLocation[^"]*"[^>]*>([^<]+)</g)];
  const dateMatches = [...html.matchAll(/class="[^"]*jobDate[^"]*"[^>]*>([^<]+)</g)];
  const urlMatches = [...html.matchAll(/href="(\/job\/[^"]+)"/g)];

  const count = Math.max(jobIdMatches.length, titleMatches.length);
  console.log(`  [HTML PARSE] IDs: ${jobIdMatches.length}, Titles: ${titleMatches.length}, Locations: ${locationMatches.length}`);

  for (let i = 0; i < count; i++) {
    jobs.push({
      title: titleMatches[i]?.[1]?.trim() || "Unknown",
      location: locationMatches[i]?.[1]?.trim() || "India",
      url: urlMatches[i] ? `${BASE_URL}${urlMatches[i][1]}` : `${BASE_URL}/search/`,
      posted_at: dateMatches[i]?.[1]?.trim() || null,
      requisition_id: jobIdMatches[i]?.[1] || "",
    });
  }

  return { jobs, totalCount: totalFromHtml };
}

// Try the SuccessFactors XML/RSS feeds as fallback
async function fetchViaSitemapOrFeed(): Promise<WiproJob[]> {
  const feedUrls = [
    "https://careers.wipro.com/feeds/jobs.rss",
    "https://careers.wipro.com/sitemap-jobs.xml",
    "https://careers.wipro.com/jobs.json",
    "https://careers.wipro.com/api/jobs",
  ];

  for (const feedUrl of feedUrls) {
    console.log(`\n[FEED PROBE] Trying: ${feedUrl}`);
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });
      console.log(`  Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Content-Type: ${res.headers.get("content-type")}`);
        console.log(`  Content length: ${text.length} chars`);
        if (text.length > 500 && !text.includes("<html")) {
          console.log(`  Preview: ${text.substring(0, 300)}`);
        }
      }
    } catch(e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }
  return [];
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Wipro India Jobs Scraper");
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Filter: Last 1 month | India locations`);
  console.log("=".repeat(60));

  const allJobs: WiproJob[] = [];
  let totalCountFromAPI: number | null = null;

  // Page 1
  console.log("\n[PAGE 1] Fetching first page...");
  const { jobs: page1, totalCount } = await fetchJobsPage(0);
  allJobs.push(...page1);
  totalCountFromAPI = totalCount;

  console.log(`\n[RESULT] Page 1: ${page1.length} jobs fetched`);
  if (totalCountFromAPI) {
    console.log(`[TOTAL API COUNT] ${totalCountFromAPI} total jobs on Wipro India board`);
  }

  // If we got jobs and there are more, paginate
  if (page1.length === PAGE_SIZE && totalCountFromAPI && totalCountFromAPI > PAGE_SIZE) {
    const totalPages = Math.ceil(totalCountFromAPI / PAGE_SIZE);
    console.log(`\n[PAGINATION] Total pages needed: ${totalPages}`);
    
    for (let page = 1; page < Math.min(totalPages, 20); page++) {
      const startIndex = page * PAGE_SIZE;
      console.log(`\n[PAGE ${page + 1}] startIndex=${startIndex}`);
      const { jobs } = await fetchJobsPage(startIndex);
      allJobs.push(...jobs);
      if (jobs.length < PAGE_SIZE) break;
    }
  }

  // If HTML scraping yielded nothing, try feeds
  if (allJobs.length === 0) {
    console.log("\n[FALLBACK] Primary scrape returned 0 jobs. Probing alternative feeds...");
    await fetchViaSitemapOrFeed();
  }

  console.log("\n" + "=".repeat(60));
  console.log("[ANALYSIS] Filtering by city and date...");

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const cityCount: Record<string, number> = {
    "Bangalore": 0,
    "Mumbai": 0,
    "Hyderabad": 0,
    "New Delhi": 0,
    "Pune": 0,
    "Remote": 0,
    "Other India": 0,
  };

  let withinMonth = 0;
  let olderThanMonth = 0;
  let noDate = 0;

  const qualifiedJobs: WiproJob[] = [];

  for (const job of allJobs) {
    if (!isIndiaLocation(job.location)) continue;

    const inTime = isWithinOneMonth(job.posted_at);
    if (job.posted_at && new Date(job.posted_at) < oneMonthAgo && !isNaN(new Date(job.posted_at).getTime())) {
      olderThanMonth++;
      continue;
    }
    if (!job.posted_at) noDate++;
    else withinMonth++;

    qualifiedJobs.push(job);

    const city = matchesTargetCity(job.location);
    if (city) {
      cityCount[city]++;
    } else if (isIndiaLocation(job.location)) {
      cityCount["Other India"]++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("  WIPRO INDIA JOB POSTINGS — LAST 1 MONTH");
  console.log("=".repeat(60));
  console.log(`\nTotal jobs scraped:           ${allJobs.length}`);
  console.log(`India-location jobs:          ${qualifiedJobs.length + olderThanMonth}`);
  console.log(`  → Within last 1 month:      ${qualifiedJobs.length}`);
  console.log(`  → Older than 1 month:       ${olderThanMonth}`);
  console.log(`  → No date available:        ${noDate}`);

  console.log("\n📍 Breakdown by City (last 1 month):");
  console.log("─".repeat(35));
  for (const [city, count] of Object.entries(cityCount)) {
    if (count > 0) {
      console.log(`  ${city.padEnd(20)} ${count} jobs`);
    }
  }

  const totalTargetCities = TARGET_CITIES.reduce((sum, c) => {
    const key = c.charAt(0).toUpperCase() + c.slice(1);
    return sum + (cityCount[key] || 0);
  }, 0);

  console.log("─".repeat(35));
  console.log(`  TOTAL (target cities)        ${qualifiedJobs.length} jobs`);
  console.log("\n");

  // Show sample jobs
  if (qualifiedJobs.length > 0) {
    console.log("📋 Sample Jobs (first 10):");
    console.log("─".repeat(60));
    qualifiedJobs.slice(0, 10).forEach((j, i) => {
      console.log(`${i + 1}. ${j.title}`);
      console.log(`   📍 ${j.location}`);
      console.log(`   📅 ${j.posted_at || "Date not available"}`);
      console.log(`   🔗 ${j.url}`);
      console.log("");
    });
  }

  if (allJobs.length === 0) {
    console.log("\n⚠️  NOTE: Wipro uses SAP SuccessFactors which renders jobs via JavaScript.");
    console.log("   The fetch-based scraper cannot execute JS. To get exact counts, options are:");
    console.log("   1. Use Playwright/Puppeteer to render the page with a headless browser");
    console.log("   2. Manually check: https://careers.wipro.com/search/?q=&location=India&sortColumn=referencedate&sortDirection=desc");
    console.log("   3. Add a 'successfactors' provider to the main scrape-jobs.ts with SAP OData API creds");
  }
}

main().catch(console.error);
