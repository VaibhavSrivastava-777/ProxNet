import { SupabaseClient } from "@supabase/supabase-js";

export interface DiscoveredCompetitor {
  name: string;
  industry?: string;
  careers_url?: string;
  provider?: string;
  boardTokenOrUrl?: string;
  source: "claude" | "openai" | "canonical";
}

export interface CompetitorResult {
  companyName: string;
  competitors: DiscoveredCompetitor[];
}

// Canonical high-accuracy mapping kept as a reference and emergency fallback
export const CANONICAL_COMPETITORS: Record<string, string[]> = {
  // Food & Quick-Commerce
  "swiggy": ["Zomato", "Zepto", "Blinkit", "BigBasket"],
  "zomato": ["Swiggy", "Zepto", "Blinkit"],
  "zepto": ["Blinkit", "Swiggy", "Instamart", "BigBasket"],
  "blinkit": ["Zepto", "Swiggy", "BigBasket", "Dunzo"],

  // FinTech & Payments
  "razorpay": ["Cashfree Payments", "PayU", "PhonePe", "Paytm", "Pine Labs"],
  "phonepe": ["Google Pay", "Paytm", "BharatPe", "Cred"],
  "paytm": ["PhonePe", "Google Pay", "Mobikwik", "Freecharge"],
  "cred": ["Jupiter", "Fi", "Slice", "OneCard"],
  "zerodha": ["Groww", "Upstox", "Angel One", "ICICI Direct"],
  "groww": ["Zerodha", "Upstox", "Angel One", "Paytm Money"],
  "slice": ["Jupiter", "Fi", "Uni Cards", "OneCard"],
  "jupiter": ["Fi", "Slice", "Niyo", "Jupiter Money"],
  "fi": ["Jupiter", "Slice", "Niyo"],

  // IT Services & Tech Consulting
  "tcs": ["Infosys", "Wipro", "HCL Tech", "Cognizant", "Accenture", "Tech Mahindra"],
  "tata consultancy services": ["Infosys", "Wipro", "HCL Tech", "Cognizant", "Accenture"],
  "tata consultancy services limited": ["Infosys", "Wipro", "HCL Tech", "Cognizant", "Accenture"],
  "infosys": ["TCS", "Wipro", "HCL Tech", "Cognizant", "Accenture", "LTIMindtree"],
  "infosys ltd": ["TCS", "Wipro", "HCL Tech", "Cognizant", "Accenture"],
  "infosys ltd.": ["TCS", "Wipro", "HCL Tech", "Cognizant", "Accenture"],
  "wipro": ["TCS", "Infosys", "HCL Tech", "Cognizant", "Capgemini", "Tech Mahindra"],
  "hcl": ["TCS", "Infosys", "Wipro", "Cognizant", "LTIMindtree"],
  "hcl tech": ["TCS", "Infosys", "Wipro", "Cognizant", "LTIMindtree"],
  "hcl technologies": ["TCS", "Infosys", "Wipro", "Cognizant", "LTIMindtree"],
  "cognizant": ["TCS", "Infosys", "Wipro", "Accenture", "Capgemini"],
  "cognizant technology solutions": ["TCS", "Infosys", "Wipro", "Accenture", "Capgemini"],
  "accenture": ["TCS", "Infosys", "Cognizant", "Capgemini", "IBM", "Deloitte"],
  "persistent": ["LTIMindtree", "Coforge", "Mphasis", "Birlasoft"],
  "persistent systems": ["LTIMindtree", "Coforge", "Mphasis", "Birlasoft"],
  "tech mahindra": ["TCS", "Infosys", "Wipro", "HCL Tech", "LTIMindtree"],

  // Big Tech & Enterprise Software
  "dell": ["HP", "Lenovo", "Apple", "Cisco", "IBM", "Asus"],
  "dell technologies": ["HP", "Lenovo", "Apple", "Cisco", "IBM"],
  "lenovo": ["Dell", "HP", "Acer", "Asus", "Apple"],
  "google": ["Microsoft", "Apple", "Amazon", "Meta"],
  "microsoft": ["Google", "Amazon", "Apple", "Oracle", "Salesforce"],
  "amazon": ["Flipkart", "Walmart", "Microsoft", "Google"],
  "apple": ["Google", "Samsung", "Microsoft", "Dell"],
  "meta": ["Google", "ByteDance", "Snap", "Twitter/X"],
  "oracle": ["SAP", "Salesforce", "Microsoft", "IBM", "Workday"],
  "salesforce": ["HubSpot", "Microsoft", "Oracle", "SAP", "Zoho"],
  "zoho": ["Freshworks", "Salesforce", "HubSpot", "Zendesk"],
  "freshworks": ["Zoho", "Salesforce", "Zendesk", "HubSpot"],
  "adobe": ["Canva", "Figma", "Salesforce"],
  "figma": ["Canva", "Adobe", "InVision", "Sketch"],
  "notion": ["Coda", "Confluence", "Evernote", "Asana", "Monday.com"],
  "stripe": ["Adyen", "PayPal", "Checkout.com", "Razorpay"],
  "zscaler": ["Palo Alto Networks", "Cloudflare", "Fortinet", "Cisco"],

  // E-Commerce & Retail
  "flipkart": ["Amazon", "Meesho", "Myntra", "JioMart"],
  "meesho": ["Flipkart", "Amazon", "Shopsy"],
  "myntra": ["Ajio", "Nykaa", "Tata CLiQ", "Amazon Fashion"],
  "nykaa": ["Purplle", "Tira", "Sephora", "Myntra"],

  // Mobility & Ride Hailing
  "ola": ["Uber", "Rapido", "BluSmart"],
  "ola cabs": ["Uber", "Rapido", "BluSmart"],
  "uber": ["Ola", "Rapido", "Lyft", "BluSmart"],

  // Logistics
  "delhivery": ["Blue Dart", "Shadowfax", "Xpressbees", "Ecom Express", "Shiprocket"],
  "shiprocket": ["Delhivery", "Pickrr", "Shyplite"],

  // Consulting & Accounting
  "ey": ["PwC", "Deloitte", "KPMG", "McKinsey", "BCG", "Bain"],
  "mckinsey": ["BCG", "Bain", "Strategy&", "Oliver Wyman"],
  "mckinsey and company": ["BCG", "Bain", "Strategy&", "Oliver Wyman"],
  "capita": ["Serco", "Conduent", "Teleperformance", "WNS"],

  // Healthcare, Pharma & Bioscience
  "optum": ["Carelon", "UnitedHealth Group", "CVS Health", "Cognizant Healthcare"],
  "farcast biosciences": ["Biocon", "Syngene", "Serum Institute", "Dr. Reddy's Laboratories"],
  "coverself": ["Cotiviti", "Optum", "CitiusTech", "HealthEdge"],

  // Specialty & Niche
  "fitsol": ["Euler Motors", "BluSmart", "Delhivery", "Shadowfax"],
  "verint": ["NICE", "Genesys", "Five9", "Talkdesk"],
  "verint systems": ["NICE", "Genesys", "Five9", "Talkdesk"],
  "verint systems pvt ltd": ["NICE", "Genesys", "Five9", "Talkdesk"],
  "diageo": ["Pernod Ricard", "United Breweries", "Bacardi", "Carlsberg", "Radico Khaitan"],
  "rakuten": ["Amazon", "Yahoo", "Mercari", "Line"],
  "rakuten india": ["Amazon", "Flipkart", "Walmart Global Tech"],
  "vodafone": ["Airtel", "Jio", "BSNL"],
  "vodafone india": ["Airtel", "Jio"],
  "jio": ["Airtel", "Vodafone Idea", "BSNL"],
  "hdfc bank": ["ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "SBI"],
  "curefit": ["Gold's Gym", "Anytime Fitness", "Fittr", "HealthifyMe"],
};

export const IGNORE_STRINGS = new Set([
  "retired", "student", "freelance", "self-employed", "self employed",
  "n/a", "none", "independent", "seeking", "looking", "unemployed",
  "na", "null", "undefined", "independent advisory practice", "resident"
]);

/**
 * Clean and normalize company name for deduplication
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Checks if a company name represents a valid business enterprise
 */
export function isValidEnterprise(name: string | null | undefined): boolean {
  if (!name) return false;
  const clean = normalizeCompanyName(name);
  if (clean.length < 2) return false;
  for (const ignore of IGNORE_STRINGS) {
    if (clean === ignore || clean.includes(ignore)) return false;
  }
  return true;
}

/**
 * Extracts ATS provider and board token or URL from a career link
 */
export function extractAtsFromUrl(rawUrl: string, companyName: string): { provider: string; boardTokenOrUrl: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { provider: "custom", boardTokenOrUrl: "" };
  }
  const cleanUrl = rawUrl.trim();
  try {
    const u = new URL(cleanUrl);
    const host = u.hostname.toLowerCase();
    const pathname = u.pathname;

    // Greenhouse
    if (host.includes("greenhouse.io") || host.includes("gh.io")) {
      const searchToken = u.searchParams.get("for");
      if (searchToken) return { provider: "greenhouse", boardTokenOrUrl: searchToken.trim() };
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0) return { provider: "greenhouse", boardTokenOrUrl: parts[parts.length - 1].trim() };
    }

    // Lever
    if (host.includes("lever.co")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0) return { provider: "lever", boardTokenOrUrl: parts[0].trim() };
    }

    // Ashby
    if (host.includes("ashbyhq.com")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0) return { provider: "ashby", boardTokenOrUrl: parts[0].trim() };
    }

    // Workday
    if (host.includes("myworkdayjobs.com")) {
      return { provider: "workday", boardTokenOrUrl: cleanUrl };
    }

    // Oracle Cloud HCM
    if (host.includes("oraclecloud.com")) {
      return { provider: "oracle", boardTokenOrUrl: cleanUrl };
    }

    return { provider: "custom", boardTokenOrUrl: cleanUrl };
  } catch {
    return { provider: "custom", boardTokenOrUrl: cleanUrl };
  }
}

/**
 * Discovers competitors and their career portal links using Claude (Anthropic Messages API)
 */
async function discoverCompetitorsViaClaude(
  companyName: string,
  apiKey: string
): Promise<DiscoveredCompetitor[]> {
  const modelName = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";
  const prompt = `You are an industry market intelligence expert. For the company "${companyName}", identify 3 to 5 direct competitors and their official career portal or job board URLs (e.g. direct Greenhouse board, Lever board, Workday jobs URL, Ashby board, or official company careers page).
Respond ONLY with a valid JSON object matching this schema:
{
  "company": "${companyName}",
  "competitors": [
    {
      "name": "Competitor Name",
      "industry": "Industry or Domain",
      "careers_url": "https://..."
    }
  ]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) return [];

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]);
  const rawList = Array.isArray(parsed.competitors) ? parsed.competitors : [];

  return rawList
    .map((item: any) => {
      const name = typeof item === "string" ? item.trim() : (item.name || "").trim();
      const careersUrl = typeof item === "object" ? item.careers_url : undefined;
      const ats = extractAtsFromUrl(careersUrl || "", name);
      return {
        name,
        industry: typeof item === "object" ? item.industry : undefined,
        careers_url: careersUrl,
        provider: ats.provider,
        boardTokenOrUrl: ats.boardTokenOrUrl,
        source: "claude" as const,
      };
    })
    .filter((c: any) => c.name && isValidEnterprise(c.name) && normalizeCompanyName(c.name) !== normalizeCompanyName(companyName));
}

/**
 * Discovers competitors and their career portal links using OpenAI (gpt-4o-mini structured JSON)
 */
async function discoverCompetitorsViaOpenAI(
  companyName: string,
  apiKey: string
): Promise<DiscoveredCompetitor[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an industry market intelligence expert. Given a company name, identify 3 to 5 direct competitors and their official career portal or job board links (e.g. Greenhouse, Lever, Workday, Ashby, or company careers page). Return a JSON object with a 'competitors' array of objects with 'name', 'industry', and 'careers_url' properties.",
        },
        {
          role: "user",
          content: `Identify top 3 to 5 direct competitors and official career portal URLs for company: "${companyName}".`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  const rawList = Array.isArray(parsed.competitors) ? parsed.competitors : [];

  return rawList
    .map((item: any) => {
      const name = typeof item === "string" ? item.trim() : (item.name || "").trim();
      const careersUrl = typeof item === "object" ? item.careers_url : undefined;
      const ats = extractAtsFromUrl(careersUrl || "", name);
      return {
        name,
        industry: typeof item === "object" ? item.industry : undefined,
        careers_url: careersUrl,
        provider: ats.provider,
        boardTokenOrUrl: ats.boardTokenOrUrl,
        source: "openai" as const,
      };
    })
    .filter((c: any) => c.name && isValidEnterprise(c.name) && normalizeCompanyName(c.name) !== normalizeCompanyName(companyName));
}

/**
 * Fetch all distinct valid network companies where active ProxNet members work
 */
export async function getNetworkCompanies(supabase: SupabaseClient): Promise<string[]> {
  const { data: users, error } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .eq("is_blocked", false)
    .not("company", "is", null);

  if (error || !users) {
    console.error("[getNetworkCompanies] Error querying users:", error);
    return [];
  }

  const seen = new Map<string, string>();
  for (const u of users) {
    const raw = u.company?.trim();
    if (raw && isValidEnterprise(raw)) {
      const key = normalizeCompanyName(raw);
      if (!seen.has(key)) {
        seen.set(key, raw);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Discovers competitors for a single company dynamically using GenAI (Claude with OpenAI fallback).
 */
export async function discoverCompetitorsForCompany(
  companyName: string,
  openaiKey?: string
): Promise<CompetitorResult> {
  const normName = companyName.trim();
  const claudeKey = process.env.ANTHROPIC_API_KEY?.trim();

  // 1. Dynamic GenAI: Try Claude first if key is configured
  if (claudeKey) {
    try {
      const claudeComps = await discoverCompetitorsViaClaude(normName, claudeKey);
      if (claudeComps.length > 0) {
        return { companyName: normName, competitors: claudeComps };
      }
    } catch (err: any) {
      console.warn(`[Competitor Discovery - Claude] Falling back to OpenAI for ${normName}:`, err.message);
    }
  }

  // 2. Dynamic GenAI: Fallback to OpenAI gpt-4o-mini
  const keyToUse = openaiKey || process.env.OPENAI_API_KEY?.trim();
  if (keyToUse) {
    try {
      const openAiComps = await discoverCompetitorsViaOpenAI(normName, keyToUse);
      if (openAiComps.length > 0) {
        return { companyName: normName, competitors: openAiComps };
      }
    } catch (err: any) {
      console.warn(`[Competitor Discovery - OpenAI] Failed for ${normName}:`, err.message);
    }
  }

  // 3. Graceful fallback to canonical map if LLM is unavailable
  const normKey = normalizeCompanyName(normName);
  const fallbackList = CANONICAL_COMPETITORS[normKey] || [];
  const competitors: DiscoveredCompetitor[] = fallbackList.map((c) => ({
    name: c,
    source: "canonical" as const,
  }));

  return { companyName: normName, competitors };
}

/**
 * Master function to map competitors for network companies dynamically in a loop,
 * persist competitor relationships to `company_competitors`, and seed `company_ats_config`.
 */
export async function mapAllNetworkCompetitors(
  supabase: SupabaseClient,
  openaiKey?: string,
  limit?: number
): Promise<{
  networkCompanies: string[];
  competitorMap: Map<string, string[]>;
  allCompetitors: string[];
  recordsInserted: number;
}> {
  let networkCompanies = await getNetworkCompanies(supabase);
  if (typeof limit === "number" && limit > 0) {
    networkCompanies = networkCompanies.slice(0, limit);
  }

  const competitorMap = new Map<string, string[]>();
  const allCompetitorSet = new Map<string, string>();

  const recordsToInsert: Array<{
    company_name: string;
    competitor_name: string;
    industry?: string | null;
    discovery_source: string;
    is_active: boolean;
    updated_at: string;
  }> = [];

  const atsConfigsToUpsert: Array<{
    company_name: string;
    provider: string;
    board_token_or_url: string;
    scrape_notes: string;
  }> = [];

  for (const company of networkCompanies) {
    console.log(`[mapAllNetworkCompetitors] Discovering competitors dynamically for: "${company}"...`);
    const res = await discoverCompetitorsForCompany(company, openaiKey);
    const compNames = res.competitors.map((c) => c.name);
    competitorMap.set(company, compNames);

    for (const c of res.competitors) {
      recordsToInsert.push({
        company_name: company,
        competitor_name: c.name,
        industry: c.industry || null,
        discovery_source: c.source,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      const key = normalizeCompanyName(c.name);
      if (!allCompetitorSet.has(key)) {
        allCompetitorSet.set(key, c.name);
      }

      // If career portal URL or ATS provider was discovered, prepare ATS config
      if (c.boardTokenOrUrl && c.provider) {
        atsConfigsToUpsert.push({
          company_name: c.name,
          provider: c.provider,
          board_token_or_url: c.boardTokenOrUrl,
          scrape_notes: `Discovered as competitor of ${company} via GenAI (${c.source}) | Career portal: ${c.careers_url || c.boardTokenOrUrl}`,
        });
      }
    }
  }

  // Persist all discovered competitor relationships directly into company_competitors table
  if (recordsToInsert.length > 0) {
    try {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
        const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
        const { error: upsertErr } = await supabase
          .from("company_competitors")
          .upsert(chunk, { onConflict: "company_name,competitor_name" });
        if (upsertErr) {
          console.warn("[mapAllNetworkCompetitors] Warning saving to company_competitors:", upsertErr.message);
        }
      }
      console.log(`[mapAllNetworkCompetitors] Successfully persisted ${recordsToInsert.length} competitor relationships into company_competitors.`);
    } catch (dbErr: any) {
      console.warn("[mapAllNetworkCompetitors] Database error saving company_competitors:", dbErr.message);
    }
  }

  // Upsert into company_ats_config for newly discovered competitor career portals if not already configured
  for (const ats of atsConfigsToUpsert) {
    try {
      const { data: existing } = await supabase
        .from("company_ats_config")
        .select("id, provider, board_token_or_url")
        .ilike("company_name", ats.company_name)
        .maybeSingle();

      if (!existing) {
        await supabase.from("company_ats_config").insert({
          company_name: ats.company_name,
          provider: ats.provider,
          board_token_or_url: ats.board_token_or_url,
          scrape_notes: ats.scrape_notes,
          total_jobs_found: 0,
        });
      } else if (existing.provider === "none" || !existing.board_token_or_url) {
        await supabase
          .from("company_ats_config")
          .update({
            provider: ats.provider,
            board_token_or_url: ats.board_token_or_url,
            scrape_notes: ats.scrape_notes,
          })
          .eq("id", existing.id);
      }
    } catch (atsErr: any) {
      console.warn(`[mapAllNetworkCompetitors] Could not save ATS config for ${ats.company_name}:`, atsErr.message);
    }
  }

  return {
    networkCompanies,
    competitorMap,
    allCompetitors: Array.from(allCompetitorSet.values()),
    recordsInserted: recordsToInsert.length,
  };
}
