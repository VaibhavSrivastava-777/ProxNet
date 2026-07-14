export interface ScrapedJob {
  title: string;
  location: string;
  url: string;
  posted_at: string;
  description: string;
  source: string;
}

export interface CompanyScraper {
  companyName: string;
  // If limit is specified, only return that many jobs.
  // Useful for dryRun testing to check if the fetch and parse work properly.
  scrape: (limit?: number) => Promise<ScrapedJob[]>;
}
