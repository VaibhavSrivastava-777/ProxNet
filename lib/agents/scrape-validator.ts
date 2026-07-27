import { getScraper } from "../scrapers/registry";
import { ScrapedJob } from "../scrapers/types";
import { Agent1Result } from "./scrape-identifier";

export interface Agent2ValidationResult {
  isValid: boolean;
  companyName: string;
  strategyUsed: string;
  sampleJobsCount: number;
  sampleJobs: ScrapedJob[];
  error?: string;
  notes: string;
}

/**
 * Agent 2: Scrape Validator
 * Validates whether the identified scraping strategy actually works by attempting to scrape 3-4 jobs at random.
 */
export async function validateScrapeStrategy(
  agent1Output: Agent1Result,
  config?: any
): Promise<Agent2ValidationResult> {
  const { companyName, recommendedStrategy } = agent1Output;
  console.log(`[Agent 2] Validating scrape strategy '${recommendedStrategy}' for ${companyName}...`);

  try {
    const scraper = getScraper(companyName, config || { provider: recommendedStrategy, board_token_or_url: "" });
    if (!scraper) {
      return {
        isValid: false,
        companyName,
        strategyUsed: recommendedStrategy,
        sampleJobsCount: 0,
        sampleJobs: [],
        error: `No registered scraper found for strategy ${recommendedStrategy}`,
        notes: "Validation failed: Scraper lookup null"
      };
    }

    // Attempt dry run extraction (limit 3-4 jobs max)
    const rawJobs = await scraper.scrape(4);
    const sampleJobs = (rawJobs || []).slice(0, 4);

    // Validate structural integrity of returned sample jobs
    const validJobs = sampleJobs.filter(j => {
      const hasTitle = j.title && j.title.trim().length > 2;
      const hasUrl = j.url && j.url.startsWith("http");
      return hasTitle && hasUrl;
    });

    const isValid = validJobs.length > 0;

    return {
      isValid,
      companyName,
      strategyUsed: recommendedStrategy,
      sampleJobsCount: validJobs.length,
      sampleJobs: validJobs,
      notes: isValid 
        ? `Successfully validated strategy '${recommendedStrategy}' with ${validJobs.length} sample jobs.`
        : `Validation failed: Extraction returned 0 valid jobs.`
    };
  } catch (err: any) {
    console.error(`[Agent 2 Error] Validation exception for ${companyName}:`, err.message);
    return {
      isValid: false,
      companyName,
      strategyUsed: recommendedStrategy,
      sampleJobsCount: 0,
      sampleJobs: [],
      error: err.message,
      notes: `Validation exception: ${err.message}`
    };
  }
}
