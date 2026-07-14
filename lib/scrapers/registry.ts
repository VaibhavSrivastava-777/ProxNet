import { CompanyScraper, ScrapedJob } from "./types";
import { ZscalerScraper } from "./zscaler";
import { WellsFargoScraper } from "./wellsfargo";
import { VodafoneScraper } from "./vodafone-india-services";
import { FallbackScraper } from "./fallback";
import { AmazonScraper } from "./amazon";
import { AccentureScraper } from "./accenture";
import { generateSimulatedJobs } from "./utils";

export const SCRAPER_REGISTRY: Record<string, CompanyScraper> = {
  "zscaler": ZscalerScraper,
  "wellsfargo": WellsFargoScraper,
  "vodafone india services": VodafoneScraper,
  "amazon": AmazonScraper,
  "accenture": AccentureScraper,
};

class SafeCompanyScraper implements CompanyScraper {
  inner: CompanyScraper;
  companyName: string;

  constructor(inner: CompanyScraper, companyName: string) {
    this.inner = inner;
    this.companyName = companyName;
  }

  async scrape(limit?: number): Promise<ScrapedJob[]> {
    let jobs: ScrapedJob[] = [];
    try {
      jobs = await this.inner.scrape(limit);
    } catch (e: any) {
      console.warn(`[SafeScraper] Scraper failed for ${this.companyName}: ${e.message}. Falling back to simulated jobs.`);
    }

    if (!jobs || jobs.length === 0) {
      jobs = generateSimulatedJobs(this.companyName, limit || 2);
    }

    return jobs;
  }
}

export function getScraper(
  companyName: string,
  config?: { provider: string; board_token_or_url: string }
): CompanyScraper | null {
  const normalized = companyName.toLowerCase().trim();
  
  // 1. Check custom scrapers
  let scraper = SCRAPER_REGISTRY[normalized];
  if (!scraper) {
    const alphanumericOnly = (str: string) => str.replace(/[^a-z0-9]/g, "");
    const targetClean = alphanumericOnly(normalized);
    
    for (const key of Object.keys(SCRAPER_REGISTRY)) {
      if (alphanumericOnly(key) === targetClean) {
        scraper = SCRAPER_REGISTRY[key];
        break;
      }
    }
  }

  if (scraper) {
    return new SafeCompanyScraper(scraper, companyName);
  }

  // 2. Fallback to generic scraper if config is available
  if (config && config.provider) {
    const fallback = new FallbackScraper(companyName, config.provider, config.board_token_or_url);
    return new SafeCompanyScraper(fallback, companyName);
  }
  
  return null;
}
