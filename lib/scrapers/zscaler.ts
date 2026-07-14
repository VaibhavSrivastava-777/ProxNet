import { CompanyScraper, ScrapedJob } from "./types";
import { stripHtml, fetchWithHeaders } from "./utils";

export const ZscalerScraper: CompanyScraper = {
  companyName: "Zscaler",
  scrape: async (limit?: number): Promise<ScrapedJob[]> => {
    const url = "https://boards-api.greenhouse.io/v1/boards/zscaler/jobs?content=true";
    const res = await fetchWithHeaders(url);
    if (!res.ok) {
      throw new Error(`Greenhouse API responded with status ${res.status}`);
    }
    const data = await res.json();
    let rawJobs = data.jobs || [];

    if (limit !== undefined) {
      rawJobs = rawJobs.slice(0, limit);
    }

    return rawJobs.map((j: any) => ({
      title: j.title,
      location: j.location?.name || "Remote",
      url: j.absolute_url,
      posted_at: j.updated_at || new Date().toISOString(),
      description: stripHtml(j.content || j.title),
      source: "greenhouse",
    }));
  },
};
