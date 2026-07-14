import { CompanyScraper, ScrapedJob } from "./types";
import { STRATEGIES } from "../scrape-strategies";

export class FallbackScraper implements CompanyScraper {
  companyName: string;
  provider: string;
  boardToken: string;

  constructor(companyName: string, provider: string, boardToken: string) {
    this.companyName = companyName;
    this.provider = provider;
    this.boardToken = boardToken;
  }

  async scrape(limit?: number): Promise<ScrapedJob[]> {
    const strategy = STRATEGIES[this.provider];
    if (!strategy) {
      throw new Error(`No scraper strategy implemented for provider type: "${this.provider}"`);
    }

    console.log(`[FallbackScraper] Scraping using generic ${this.provider} strategy for ${this.companyName}...`);
    let jobs = await strategy(this.boardToken, this.companyName);

    if (limit !== undefined) {
      // Dry run: slice and return without filtering
      return jobs.slice(0, limit);
    }

    return jobs;
  }
}
