import { ScraperType } from "../scrapers/registry";

export interface CompanyIdentifyInput {
  companyName: string;
  boardUrl?: string | null;
  provider?: string | null;
}

export interface Agent1Result {
  companyName: string;
  recommendedStrategy: ScraperType;
  confidence: number;
  reason: string;
}

/**
 * Agent 1: Scrape Strategy Identifier
 * Identifies the optimal ATS strategy or fallback method for a given company.
 */
export async function identifyScrapeStrategy(input: CompanyIdentifyInput): Promise<Agent1Result> {
  const name = input.companyName.toLowerCase().trim();
  const url = (input.boardUrl || "").toLowerCase().trim();
  const provider = (input.provider || "").toLowerCase().trim();

  // 1. Direct provider match
  if (provider === "greenhouse" || url.includes("greenhouse.io")) {
    return { companyName: input.companyName, recommendedStrategy: "greenhouse", confidence: 0.95, reason: "Greenhouse provider/URL detected" };
  }
  if (provider === "lever" || url.includes("lever.co")) {
    return { companyName: input.companyName, recommendedStrategy: "lever", confidence: 0.95, reason: "Lever provider/URL detected" };
  }
  if (provider === "ashby" || url.includes("ashbyhq.com")) {
    return { companyName: input.companyName, recommendedStrategy: "custom", confidence: 0.9, reason: "Ashby provider/URL detected (uses generic API/custom fallback)" };
  }
  if (provider === "smartrecruiters" || url.includes("smartrecruiters.com")) {
    return { companyName: input.companyName, recommendedStrategy: "smartrecruiters", confidence: 0.95, reason: "SmartRecruiters provider/URL detected" };
  }
  if (provider === "workday" || url.includes("myworkdayjobs.com") || url.includes("workday")) {
    return { companyName: input.companyName, recommendedStrategy: "workday", confidence: 0.9, reason: "Workday provider/URL detected" };
  }
  if (provider === "oracle" || url.includes("oraclecloud.com") || url.includes("taleo")) {
    return { companyName: input.companyName, recommendedStrategy: "oracle", confidence: 0.85, reason: "Oracle/Taleo provider detected" };
  }
  if (provider === "phenom" || url.includes("phenompeople.com")) {
    return { companyName: input.companyName, recommendedStrategy: "phenom", confidence: 0.85, reason: "Phenom provider detected" };
  }
  if (provider === "ibm" || url.includes("brassring.com")) {
    return { companyName: input.companyName, recommendedStrategy: "ibm", confidence: 0.85, reason: "IBM BrassRing provider detected" };
  }

  // 2. Known major companies heuristic lookup
  if (name.includes("google") || name.includes("alphabet")) {
    return { companyName: input.companyName, recommendedStrategy: "custom", confidence: 0.9, reason: "Google custom career board strategy" };
  }
  if (name.includes("amazon")) {
    return { companyName: input.companyName, recommendedStrategy: "custom", confidence: 0.9, reason: "Amazon jobs custom API strategy" };
  }
  if (name.includes("microsoft")) {
    return { companyName: input.companyName, recommendedStrategy: "custom", confidence: 0.9, reason: "Microsoft custom career API strategy" };
  }

  // 3. Fallback to generic Custom/Search strategy
  return {
    companyName: input.companyName,
    recommendedStrategy: "custom",
    confidence: 0.7,
    reason: "Fallback to robust generic custom strategy"
  };
}
