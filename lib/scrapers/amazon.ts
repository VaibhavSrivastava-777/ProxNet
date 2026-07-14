import { CompanyScraper, ScrapedJob } from "./types";
import { stripHtml, fetchWithHeaders, isIndianOrIndianRemote } from "./utils";

export const AmazonScraper: CompanyScraper = {
  companyName: "Amazon",
  scrape: async (limit?: number): Promise<ScrapedJob[]> => {
    const url = "https://www.amazon.jobs/en/search.json";
    const params = new URLSearchParams({
      loc_query: "India",
      sort: "recent",
      offset: "0",
      result_limit: limit !== undefined ? String(limit) : "50",
    });

    const res = await fetchWithHeaders(`${url}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Amazon Jobs API returned status ${res.status}`);
    }

    const data = await res.json() as any;
    const rawJobs = data?.jobs || [];

    const candidateJobs: any[] = [];

    if (limit !== undefined) {
      // Dry run: return first N jobs without date/location filters
      candidateJobs.push(...rawJobs.slice(0, limit));
    } else {
      // Real run: filter by last 1 week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      for (const job of rawJobs) {
        const postedDateStr = job.posted_date || "";
        if (postedDateStr) {
          const jobDate = new Date(postedDateStr);
          if (!isNaN(jobDate.getTime()) && jobDate < oneWeekAgo) {
            continue;
          }
        }

        // Verify India / Remote location (safety fallback)
        if (!isIndianOrIndianRemote(job.location)) {
          continue;
        }

        candidateJobs.push(job);
      }
    }

    return candidateJobs.map((j: any) => {
      let postedAt = new Date().toISOString();
      if (j.posted_date) {
        const parsedDate = new Date(j.posted_date);
        if (!isNaN(parsedDate.getTime())) {
          postedAt = parsedDate.toISOString();
        }
      }

      return {
        title: j.title,
        location: j.location || "India",
        url: `https://www.amazon.jobs${j.job_path}`,
        posted_at: postedAt,
        description: stripHtml(j.description || j.description_short || j.title),
        source: "custom",
      };
    });
  },
};
