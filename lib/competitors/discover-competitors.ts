import { SupabaseClient } from "@supabase/supabase-js";

export interface CompetitorResult {
  companyName: string;
  competitors: Array<{
    name: string;
    industry?: string;
    source: "canonical" | "openai";
  }>;
}

// Canonical high-accuracy mapping for common Indian & Global companies in ProxNet
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
 * Discovers competitors for a single company using canonical rules first,
 * falling back to OpenAI structured completions.
 */
export async function discoverCompetitorsForCompany(
  companyName: string,
  openaiKey?: string
): Promise<CompetitorResult> {
  const normalizedKey = normalizeCompanyName(companyName);

  // 1. Check canonical dictionary
  if (CANONICAL_COMPETITORS[normalizedKey]) {
    const comps = CANONICAL_COMPETITORS[normalizedKey].map((c) => ({
      name: c,
      source: "canonical" as const,
    }));
    return { companyName, competitors: comps };
  }

  // Check partial match in canonical dictionary
  for (const [key, comps] of Object.entries(CANONICAL_COMPETITORS)) {
    if (normalizedKey.includes(key) || key.includes(normalizedKey)) {
      return {
        companyName,
        competitors: comps.map((c) => ({ name: c, source: "canonical" as const })),
      };
    }
  }

  // 2. Fallback to OpenAI gpt-4o-mini
  const keyToUse = openaiKey || process.env.OPENAI_API_KEY;
  if (!keyToUse) {
    return { companyName, competitors: [] };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyToUse}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an industry market intelligence expert. Given a company name, identify 3 to 5 direct competitors that operate in similar sectors, especially those with tech/corporate offices in India or globally. Return a JSON object with a 'competitors' array of objects with 'name' and 'industry' properties.",
          },
          {
            role: "user",
            content: `Identify top 3 to 5 direct competitors for company: "${companyName}".`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[OpenAI Competitor Discovery] HTTP ${response.status} for ${companyName}`);
      return { companyName, competitors: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { companyName, competitors: [] };

    const parsed = JSON.parse(content);
    const rawList = Array.isArray(parsed.competitors) ? parsed.competitors : [];

    const competitors = rawList
      .map((item: any) => ({
        name: typeof item === "string" ? item.trim() : (item.name || "").trim(),
        industry: typeof item === "object" ? item.industry : undefined,
        source: "openai" as const,
      }))
      .filter((c: any) => c.name && isValidEnterprise(c.name) && normalizeCompanyName(c.name) !== normalizedKey);

    return { companyName, competitors };
  } catch (err: any) {
    console.warn(`[OpenAI Competitor Discovery] Failed for ${companyName}:`, err.message);
    return { companyName, competitors: [] };
  }
}

/**
 * Master function to map competitors for all network companies and return a deduplicated list
 */
export async function mapAllNetworkCompetitors(
  supabase: SupabaseClient,
  openaiKey?: string
): Promise<{
  networkCompanies: string[];
  competitorMap: Map<string, string[]>;
  allCompetitors: string[];
}> {
  const networkCompanies = await getNetworkCompanies(supabase);
  const competitorMap = new Map<string, string[]>();
  const allCompetitorSet = new Map<string, string>();

  for (const company of networkCompanies) {
    const res = await discoverCompetitorsForCompany(company, openaiKey);
    const compNames = res.competitors.map((c) => c.name);
    competitorMap.set(company, compNames);

    for (const c of res.competitors) {
      const key = normalizeCompanyName(c.name);
      if (!allCompetitorSet.has(key)) {
        allCompetitorSet.set(key, c.name);
      }
    }
  }

  return {
    networkCompanies,
    competitorMap,
    allCompetitors: Array.from(allCompetitorSet.values()),
  };
}
