import { CompanyScraper, ScrapedJob } from "./types";
import { FallbackScraper } from "./fallback";
import {
  workdayStrategy,
  greenhouseStrategy,
  leverStrategy,
  eightfoldStrategy,
  smartrecruitersStrategy,
  icimsStrategy,
  customStrategy,
  noneStrategy,
  successfactorsStrategy,
  successfactorsSitemapStrategy,
  oracleStrategy,
  phenomStrategy,
  ibmStrategy
} from "../scrape-strategies";

export type ScraperType = 
  | "workday" 
  | "greenhouse" 
  | "lever" 
  | "eightfold" 
  | "smartrecruiters"
  | "icims"
  | "myworkdayjobs"
  | "custom"
  | "none"
  | "successfactors"
  | "successfactors_sitemap"
  | "oracle"
  | "phenom"
  | "ibm";

export const scraperMap: Record<ScraperType, any> = {
  workday: workdayStrategy,
  myworkdayjobs: workdayStrategy,
  greenhouse: greenhouseStrategy,
  lever: leverStrategy,
  eightfold: eightfoldStrategy,
  smartrecruiters: smartrecruitersStrategy,
  icims: icimsStrategy,
  custom: customStrategy,
  none: noneStrategy,
  successfactors: successfactorsStrategy,
  successfactors_sitemap: successfactorsSitemapStrategy,
  oracle: oracleStrategy,
  phenom: phenomStrategy,
  ibm: ibmStrategy
};

export const SCRAPER_REGISTRY: Record<string, CompanyScraper> = {
  // Custom DOM scrapers have been deprecated in favor of robust generic strategies (e.g. Firecrawl/SerpApi)
  // Standard ATS integrations are handled by the FallbackScraper dynamically
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
      console.log(`[SafeScraper] No jobs found for ${this.companyName}.`);
    }

    return jobs || [];
  }
}

export function getScraper(
  companyName: string,
  config?: { provider: string; board_token_or_url: string }
): CompanyScraper | null {
  const normalized = companyName.toLowerCase().trim();
  
  // 1. Check legacy custom scrapers (now mostly empty)
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
