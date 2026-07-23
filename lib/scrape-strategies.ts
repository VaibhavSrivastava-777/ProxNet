import { createClient } from "@supabase/supabase-js";

// Helper to strip HTML and decode common entities
export const stripHtml = (html: string): string => {
  if (!html) return "";
  let text = html.replace(/<[^>]*>?/gm, " ");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&ndash;/g, "-");
  text = text.replace(/&mdash;/g, "-");
  return text.replace(/\s+/g, " ").trim();
};

export interface ScrapedJob {
  title: string;
  location: string;
  url: string;
  posted_at: string;
  description: string;
  source: string;
}

export type ScrapeStrategy = (
  boardTokenOrUrl: string,
  companyName: string
) => Promise<ScrapedJob[]>;

const fetchWithHeaders = (url: string, options: any = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...options.headers,
    },
  });
};

export const greenhouseStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Greenhouse returned ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j: any) => ({
    title: j.title,
    location: j.location?.name || "Remote",
    url: j.absolute_url,
    posted_at: j.updated_at || new Date().toISOString(),
    description: stripHtml(j.content || j.title),
    source: "greenhouse",
  }));
};

export const leverStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://api.lever.co/v0/postings/${boardToken}?mode=json`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Lever returned ${res.status}`);
  const data = await res.json();
  return (data || []).map((j: any) => ({
    title: j.text,
    location: j.categories?.location || "Remote",
    url: j.hostedUrl,
    posted_at: new Date(j.createdAt).toISOString(),
    description: stripHtml(j.descriptionPlain || j.text),
    source: "lever",
  }));
};

export const ashbyStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${boardToken}`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Ashby returned ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j: any) => ({
    title: j.title,
    location: j.location?.name || "Remote",
    url: j.jobUrl,
    posted_at: j.publishedAt || new Date().toISOString(),
    description: stripHtml(j.descriptionHtml || j.descriptionPlain || j.title),
    source: "ashby",
  }));
};

export const smartrecruitersStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://api.smartrecruiters.com/v1/companies/${boardToken}/postings`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`SmartRecruiters returned ${res.status}`);
  const data = await res.json();
  const list = data.content || [];
  const jobs: ScrapedJob[] = [];
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  for (const j of list) {
    const postedDate = j.releasedDate ? new Date(j.releasedDate) : null;
    if (!postedDate || isNaN(postedDate.getTime()) || postedDate >= twoWeeksAgo) {
      try {
        const detailUrl = `https://api.smartrecruiters.com/v1/companies/${boardToken}/postings/${j.id}`;
        const detailRes = await fetchWithHeaders(detailUrl, {
          signal: AbortSignal.timeout(10000),
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          jobs.push({
            title: j.name,
            location: j.location?.city || "Remote",
            url: `https://jobs.smartrecruiters.com/${boardToken}/${j.id}`,
            posted_at: j.releasedDate || new Date().toISOString(),
            description: stripHtml(
              detailData.jobAd?.sections?.jobDescription?.text || j.name
            ),
            source: "smartrecruiters",
          });
        }
      } catch (e) {}
    }
  }
  return jobs;
};

export const workableStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://www.workable.com/api/accounts/${boardToken}?details=true`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Workable returned ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j: any) => ({
    title: j.title,
    location: j.city || j.country || "Remote",
    url: j.url,
    posted_at: j.created_at || new Date().toISOString(),
    description: stripHtml(j.description || j.title),
    source: "workable",
  }));
};

export const breezyStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://${boardToken}.breezy.hr/json`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Breezy returned ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((j: any) => ({
    title: j.name,
    location: j.location?.name || j.location?.city || "Remote",
    url: j.url,
    posted_at: j.creation_date || new Date().toISOString(),
    description: stripHtml(j.description || j.name),
    source: "breezy",
  }));
};

export const recruiteeStrategy: ScrapeStrategy = async (boardToken) => {
  const url = `https://${boardToken}.recruitee.com/api/offers`;
  const res = await fetchWithHeaders(url, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Recruitee returned ${res.status}`);
  const data = await res.json();
  return (data.offers || []).map((j: any) => ({
    title: j.title,
    location: j.location || "Remote",
    url: j.careers_url,
    posted_at: j.published_at || new Date().toISOString(),
    description: stripHtml(j.description || j.title),
    source: "recruitee",
  }));
};

export const successfactorsSitemapStrategy: ScrapeStrategy = async (
  boardUrl,
  companyName
) => {
  // Target sitemap endpoint
  const targetUrl = boardUrl.endsWith(".xml")
    ? boardUrl
    : `${boardUrl.replace(/\/$/, "")}/sitemap-jobs.xml`;

  console.log(`  [SITEMAP] Fetching sitemap for ${companyName} from ${targetUrl}...`);
  const res = await fetchWithHeaders(targetUrl, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Failed to fetch sitemap from ${targetUrl}`);
  const xml = await res.text();

  const isSitemapIndex = xml.includes("<sitemapindex");
  const childSitemaps: string[] = [];

  if (isSitemapIndex) {
    const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
    for (const match of matches) {
      childSitemaps.push(match[1].trim());
    }
  }

  const allEntries: { url: string; lastmod: string | null }[] = [];

  if (childSitemaps.length > 0) {
    console.log(`  [SITEMAP] Sitemap index found. Reading first 5 child sitemaps...`);
    for (const childUrl of childSitemaps.slice(0, 5)) {
      try {
        const childRes = await fetchWithHeaders(childUrl, {
          signal: AbortSignal.timeout(60000),
        });
        if (childRes.ok) {
          const childXml = await childRes.text();
          const matches = [...childXml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
          for (const m of matches) {
            const block = m[1];
            const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
            const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
            if (locMatch) {
              allEntries.push({
                url: locMatch[1].trim(),
                lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
              });
            }
          }
        }
      } catch (err: any) {
        console.error(`  [SITEMAP ERROR] Failed to fetch child sitemap ${childUrl}:`, err.message);
      }
    }
  } else {
    const matches = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
    for (const m of matches) {
      const block = m[1];
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
      const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
      if (locMatch) {
        allEntries.push({
          url: locMatch[1].trim(),
          lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
        });
      }
    }
  }

  // SuccessFactors XML contains sitemap URLs.
  // Wait, does the sitemap contain full descriptions?
  // Wipro's sitemap-jobs.xml RSS feed contains `<item>` elements (with descriptions), or standard `<url>` elements.
  // Let's also check for `<item>` elements inside the xml in case it's formatted as RSS!
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const rssJobs: ScrapedJob[] = [];
  if (itemMatches.length > 0) {
    console.log(`  [SITEMAP] Parsed ${itemMatches.length} RSS items from XML feed...`);
    for (const match of itemMatches) {
      const block = match[1];
      const titleMatch = block.match(/<title>([^<]+)<\/title>/) || block.match(/<title><\!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
      const linkMatch = block.match(/<link>([^<]+)<\/link>/) || block.match(/<link><\!\[CDATA\[([\s\S]*?)\]\]><\/link>/);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/) || block.match(/<description><\!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
      const pubDateMatch = block.match(/<pubDate>([^<]+)<\/pubDate>/) || block.match(/<pubDate><\!\[CDATA\[([\s\S]*?)\]\]><\/pubDate>/);

      const title = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
      const url = linkMatch ? linkMatch[1].trim() : "";
      const description = descMatch ? stripHtml(descMatch[1]).trim() : "";
      const posted_at = pubDateMatch ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString();

      if (title && url) {
        // Simple location extraction from url or title
        let location = "Remote";
        const urlLower = url.toLowerCase();
        const locations = ["bangalore", "bengaluru", "mumbai", "hyderabad", "delhi", "pune", "remote", "chennai", "noida", "gurgaon"];
        for (const loc of locations) {
          if (urlLower.includes(loc)) {
            location = loc.charAt(0).toUpperCase() + loc.slice(1);
            break;
          }
        }
        rssJobs.push({
          title,
          location,
          url,
          posted_at,
          description: description || title,
          source: "successfactors_sitemap",
        });
      }
    }
    if (rssJobs.length > 0) {
      return rssJobs;
    }
  }

  // Fallback to url entries
  return allEntries.map((entry) => {
    // Extract location and title from the URL
    // e.g. /job/Pune-Team-leader-IND-411005/1331778955/
    const parts = entry.url.split("/");
    const jobPart = parts.find((p) => p.includes("-IND-") || p.includes("-USA-") || p.toLowerCase().includes("job"));
    let title = "Job Opportunity";
    let location = "India";

    if (jobPart) {
      const clean = jobPart.replace(/-\d+$/, "").split("-");
      if (clean.length > 1) {
        location = clean[0];
        title = clean.slice(1).join(" ");
      }
    }

    return {
      title,
      location,
      url: entry.url,
      posted_at: entry.lastmod ? new Date(entry.lastmod).toISOString() : new Date().toISOString(),
      description: `${title} position located at ${location}. Please view details on Wipro Careers site.`,
      source: "successfactors_sitemap",
    };
  });
};

export const customStrategy: ScrapeStrategy = async (boardUrl, companyName) => {
  if (boardUrl.includes("wipro.com")) {
    return successfactorsSitemapStrategy(boardUrl, companyName);
  }

  // Use Firecrawl Extraction API for robust JS-rendered scraping
  console.log(`  [CUSTOM] Extracting jobs via Firecrawl for URL: ${boardUrl}...`);
  
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    throw new Error("Missing FIRECRAWL_API_KEY for generic custom scraper");
  }

  const prompt = `Extract all job listings from this careers page. Make sure to capture the job title, location, description, and the direct URL to apply for the job.`;
  const schema = {
    type: "object",
    properties: {
      jobs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            location: { type: "string" },
            description: { type: "string" },
            url: { type: "string" }
          },
          required: ["title", "location", "url"]
        }
      }
    },
    required: ["jobs"]
  };

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${firecrawlKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: boardUrl,
      formats: ["extract"],
      extract: {
        prompt,
        schema
      }
    }),
    signal: AbortSignal.timeout(300000) // 5 mins
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firecrawl API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  if (!data.success || !data.data || !data.data.extract) {
    throw new Error("Firecrawl API failed to extract data");
  }

  const jobsList = data.data.extract.jobs || [];
  
  return jobsList.map((j: any) => ({
    title: j.title || "Job Opportunity",
    location: j.location || "Remote",
    url: j.url || boardUrl,
    posted_at: new Date().toISOString(),
    description: j.description || j.title || "",
    source: "firecrawl_extract"
  }));
};

export const workdayStrategy: ScrapeStrategy = async (boardUrl, companyName) => {
  const cleanUrl = boardUrl.replace(/^https?:\/\//i, "");
  const parts = cleanUrl.split("/wday/cxs/");
  if (parts.length !== 2) {
    throw new Error(`Invalid Workday board URL format: "${boardUrl}". Expected format: "<hostname>/wday/cxs/<tenant>/<site>/jobs"`);
  }
  const hostname = parts[0];
  const listPath = `/wday/cxs/${parts[1]}`;
  const tenantAndSite = parts[1].split("/jobs")[0];
  const detailPrefix = `/wday/cxs/${tenantAndSite}`;

  // 1. Initialize session cookies by hitting the Workday portal home page
  let cookieHeader = "";
  try {
    const sitePath = tenantAndSite.includes("/") ? tenantAndSite.split("/")[1] : tenantAndSite;
    const homeUrl = `https://${hostname}/${sitePath}`;
    
    const initRes = await fetch(homeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(10000)
    });

    const rawCookies = (initRes.headers as any).getSetCookie 
      ? (initRes.headers as any).getSetCookie() 
      : (initRes.headers.get("set-cookie") || "").split(",");
      
    cookieHeader = rawCookies
      .map((c: string) => c.trim().split(";")[0])
      .filter((c: string) => c && !c.includes("Expires=") && !c.includes("Max-Age="))
      .join("; ");
  } catch (e: any) {
    console.warn(`[Workday Scraper] Warning: Failed to pre-fetch cookies for ${companyName}: ${e.message}`);
  }

  // 2. Fetch job listing POST request
  const listUrl = `https://${hostname}${listPath}`;

  const listRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...(cookieHeader ? { "Cookie": cookieHeader } : {})
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: ""
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!listRes.ok) {
    if (listRes.status === 422) {
      throw new Error(`Workday CXS jobs API returned status 422. This company's Workday portal is likely undergoing standard weekly maintenance (common on weekends), or requires additional browser security session details.`);
    }
    throw new Error(`Workday CXS jobs API returned status ${listRes.status}`);
  }

  const listData = await listRes.json() as any;
  const postings = listData.jobPostings || [];

  const scrapedJobs: ScrapedJob[] = [];

  for (const job of postings) {
    const detailUrl = `https://${hostname}${detailPrefix}${job.externalPath}`;
    try {
      const detailRes = await fetch(detailUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...(cookieHeader ? { "Cookie": cookieHeader } : {})
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!detailRes.ok) continue;

      const detailsData = await detailRes.json() as any;
      const details = detailsData.jobPostingInfo;
      if (!details) continue;

      const descriptionHtml = details.jobDescription || "";
      const description = stripHtml(descriptionHtml);
      const primaryLocation = details.location || "";
      const additionalLocations = Array.isArray(details.additionalLocations) ? details.additionalLocations : [];
      const allLocations = [primaryLocation, ...additionalLocations].join(", ");

      scrapedJobs.push({
        title: job.title,
        location: allLocations || job.locationsText || "Remote",
        url: `https://${hostname}${job.externalPath}`,
        posted_at: details.startDate || new Date().toISOString(),
        description,
        source: "workday"
      });
    } catch (e: any) {
      console.error(`Failed to fetch generic Workday details for job ${job.title}:`, e.message);
    }
  }

  return scrapedJobs;
};

export const noneStrategy: ScrapeStrategy = async () => {
  return [];
};

export const STRATEGIES: Record<string, ScrapeStrategy> = {
  greenhouse: greenhouseStrategy,
  lever: leverStrategy,
  ashby: ashbyStrategy,
  smartrecruiters: smartrecruitersStrategy,
  workable: workableStrategy,
  breezy: breezyStrategy,
  recruitee: recruiteeStrategy,
  successfactors_sitemap: successfactorsSitemapStrategy,
  workday: workdayStrategy,
  custom: customStrategy,
  none: noneStrategy,
};
