import { CompanyScraper, ScrapedJob } from "./types";
import { stripHtml, postRequest, getRequest, isIndianOrIndianRemote } from "./utils";

export const AccentureScraper: CompanyScraper = {
  companyName: "Accenture",
  scrape: async (limit?: number): Promise<ScrapedJob[]> => {
    const hostname = "accenture.wd103.myworkdayjobs.com";
    const listPath = "/wday/cxs/accenture/AccentureCareers/jobs";

    // If dry run, just fetch the first page with the limit N directly
    if (limit !== undefined) {
      const res = await postRequest(hostname, listPath, {
        appliedFacets: {},
        limit: limit,
        offset: 0,
        searchText: ""
      });

      const postings = res.jobPostings || [];
      const jobs: ScrapedJob[] = [];

      for (const job of postings.slice(0, limit)) {
        const detailPath = `/wday/cxs/accenture/AccentureCareers${job.externalPath}`;
        try {
          const detailRes = await getRequest(hostname, detailPath);
          const details = detailRes.jobPostingInfo;
          if (details) {
            const descriptionHtml = details.jobDescription || "";
            const description = stripHtml(descriptionHtml);
            const primaryLocation = details.location || "";
            const additionalLocations = Array.isArray(details.additionalLocations) ? details.additionalLocations : [];
            const allLocations = [primaryLocation, ...additionalLocations].join(", ");

            jobs.push({
              title: job.title,
              location: allLocations || job.locationsText || "Remote",
              url: `https://${hostname}${job.externalPath}`,
              posted_at: details.startDate || new Date().toISOString(),
              description,
              source: "workday",
            });
          }
        } catch (e: any) {
          console.error(`Failed to fetch details for Accenture job ${job.title}:`, e.message);
        }
      }

      return jobs;
    }

    // Real run: paging and date + location filters
    let offset = 0;
    const pageSize = 20;
    let keepPaging = true;
    const candidateJobs: any[] = [];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    while (keepPaging) {
      try {
        const res = await postRequest(hostname, listPath, {
          appliedFacets: {},
          limit: pageSize,
          offset,
          searchText: ""
        });

        const postings = res.jobPostings || [];
        if (postings.length === 0) {
          break;
        }

        for (const job of postings) {
          const postedOn = job.postedOn || "";
          const locText = job.locationsText || "";

          // Stop paging if we hit jobs older than 1 week
          const tooOld = postedOn.includes("2 Weeks") || 
                          postedOn.includes("3 Weeks") || 
                          postedOn.includes("30+") || 
                          postedOn.includes("Month");

          if (tooOld) {
            keepPaging = false;
            break;
          }

          // Pre-filter locations
          const hasDigits = /\d/.test(locText);
          const isPossibleIndiaJob = hasDigits || isIndianOrIndianRemote(locText);

          if (isPossibleIndiaJob) {
            candidateJobs.push(job);
          }
        }

        if (!keepPaging) break;
        offset += pageSize;

        // Safety limit to avoid infinite loops
        if (offset >= 400) {
          break;
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e: any) {
        console.error("Accenture list fetch failed:", e.message);
        break;
      }
    }

    const jobs: ScrapedJob[] = [];

    for (const job of candidateJobs) {
      const detailPath = `/wday/cxs/accenture/AccentureCareers${job.externalPath}`;
      try {
        const detailRes = await getRequest(hostname, detailPath);
        const details = detailRes.jobPostingInfo;
        if (!details) continue;

        const startDate = details.startDate;
        const descriptionHtml = details.jobDescription || "";
        const description = stripHtml(descriptionHtml);
        const primaryLocation = details.location || "";
        const additionalLocations = Array.isArray(details.additionalLocations) ? details.additionalLocations : [];
        const allLocations = [primaryLocation, ...additionalLocations].join(", ");

        // Strict 1 week filter
        if (startDate) {
          const jobDate = new Date(startDate);
          if (!isNaN(jobDate.getTime()) && jobDate < oneWeekAgo) {
            continue;
          }
        }

        // Strict location filter
        if (!isIndianOrIndianRemote(allLocations)) {
          continue;
        }

        jobs.push({
          title: job.title,
          location: allLocations || job.locationsText || "India",
          url: `https://${hostname}${job.externalPath}`,
          posted_at: startDate || new Date().toISOString(),
          description,
          source: "workday",
        });
      } catch (e: any) {
        console.error(`Failed to fetch details for Accenture job ${job.title}:`, e.message);
      }
    }

    return jobs;
  },
};
