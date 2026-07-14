import { CompanyScraper, ScrapedJob } from "./types";
import { stripHtml, isIndianOrIndianRemote } from "./utils";

export const VodafoneScraper: CompanyScraper = {
  companyName: "Vodafone India Services",
  scrape: async (limit?: number): Promise<ScrapedJob[]> => {
    const domain = "vodafone.com";
    const hostname = "https://jobs.vodafone.com";

    // 1. Fetch homepage to get cookies and CSRF token
    const initRes = await fetch(`${hostname}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!initRes.ok) {
      throw new Error(`Failed to initialize session with Vodafone Jobs portal: status ${initRes.status}`);
    }

    const initCookies = initRes.headers.getSetCookie();
    const html = await initRes.text();

    const csrfMatch = html.match(/name="_csrf" content="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    const cookieHeader = initCookies.map(c => c.split(';')[0]).join('; ');

    // 2. Fetch jobs list
    const searchUrl = `${hostname}/api/pcsx/search`;
    const params = new URLSearchParams({
      domain,
      location: 'India',
      location_distance: '100',
      start: '0',
      num: limit !== undefined ? String(limit) : '100'
    });

    const searchRes = await fetch(`${searchUrl}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': `${hostname}/careers`,
        'Cookie': cookieHeader,
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      }
    });

    if (!searchRes.ok) {
      throw new Error(`Vodafone search API failed with status ${searchRes.status}`);
    }

    const searchData = await searchRes.json() as any;
    const rawPositions = searchData?.data?.positions || [];

    const candidatePositions: any[] = [];
    
    if (limit !== undefined) {
      // Dry run: do not filter by time or location
      candidatePositions.push(...rawPositions.slice(0, limit));
    } else {
      // Real run: filter by last 1 week and location
      const oneWeekAgoSecs = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      
      for (const pos of rawPositions) {
        const postedTs = pos.postedTs || 0;
        if (postedTs && postedTs < oneWeekAgoSecs) {
          continue;
        }

        const locs = (pos.locations || []).join(", ");
        if (!isIndianOrIndianRemote(locs)) {
          continue;
        }

        candidatePositions.push(pos);
      }
    }

    const jobs: ScrapedJob[] = [];
    const detailsUrl = `${hostname}/api/pcsx/position_details`;

    for (const pos of candidatePositions) {
      try {
        const detailsParams = new URLSearchParams({
          domain,
          position_id: String(pos.id)
        });

        const detailsRes = await fetch(`${detailsUrl}?${detailsParams.toString()}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `${hostname}/careers`,
            'Cookie': cookieHeader,
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
          }
        });

        if (!detailsRes.ok) {
          console.warn(`Failed to fetch details for Vodafone position ${pos.id}: status ${detailsRes.status}`);
          continue;
        }

        const detailsData = await detailsRes.json() as any;
        const details = detailsData?.data;
        if (!details) continue;

        const descriptionHtml = details.jobDescription || "";
        const description = stripHtml(descriptionHtml);

        jobs.push({
          title: pos.name,
          location: (pos.locations || []).join(", ") || "India",
          url: pos.publicUrl || `${hostname}${pos.positionUrl}`,
          posted_at: pos.postedTs ? new Date(pos.postedTs * 1000).toISOString() : new Date().toISOString(),
          description,
          source: "eightfold",
        });

        // Add a small delay between requests
        await new Promise(r => setTimeout(r, 200));
      } catch (e: any) {
        console.warn(`Error fetching details for Vodafone position ${pos.id}:`, e.message);
      }
    }

    return jobs;
  }
};
