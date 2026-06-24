// Well-known company → board token mappings
// This is the fastest way to populate jobs for ProxNet network companies
const KNOWN_BOARDS: Record<string, { provider: string; board: string }> = {
  // Major Indian Tech
  "flipkart": { provider: "greenhouse", board: "flipkart" },
  "swiggy": { provider: "greenhouse", board: "swiggy" },
  "meesho": { provider: "lever", board: "meesho" },
  "razorpay": { provider: "greenhouse", board: "razorpay" },
  "zerodha": { provider: "lever", board: "zerodha" },
  "phonepe": { provider: "greenhouse", board: "phonepe" },
  "cred": { provider: "lever", board: "cred" },
  "groww": { provider: "lever", board: "groww" },
  "zomato": { provider: "lever", board: "zomato" },
  "ola": { provider: "lever", board: "olacabs" },
  "ola cabs": { provider: "lever", board: "olacabs" },
  "paytm": { provider: "lever", board: "paytm" },
  "byju's": { provider: "lever", board: "byjus" },
  "byjus": { provider: "lever", board: "byjus" },
  "unacademy": { provider: "lever", board: "unacademy" },
  "dream11": { provider: "lever", board: "dream11" },
  "myntra": { provider: "greenhouse", board: "myntra" },
  "udaan": { provider: "lever", board: "udaan" },
  "nykaa": { provider: "greenhouse", board: "nykaa" },
  "freshworks": { provider: "greenhouse", board: "freshworks" },
  "zoho": { provider: "lever", board: "zoho" },
  "postman": { provider: "greenhouse", board: "postman" },
  "browserstack": { provider: "greenhouse", board: "browserstack" },
  "cleartrip": { provider: "greenhouse", board: "cleartrip" },
  "lenskart": { provider: "lever", board: "lenskart" },
  "policybazaar": { provider: "lever", board: "policybazaar" },
  "urban company": { provider: "lever", board: "urbancompany" },
  "urbancompany": { provider: "lever", board: "urbancompany" },
  "slice": { provider: "lever", board: "slice" },
  "jupiter": { provider: "lever", board: "jupiter" },
  "fi": { provider: "lever", board: "epifi" },
  "epifi": { provider: "lever", board: "epifi" },
  "jar": { provider: "lever", board: "jar" },
  "niyo": { provider: "lever", board: "niyo" },
  "smallcase": { provider: "lever", board: "smallcase" },
  "zepto": { provider: "lever", board: "zepto" },
  "blinkit": { provider: "lever", board: "blinkit" },
  "dunzo": { provider: "lever", board: "dunzo" },
  "delhivery": { provider: "lever", board: "delhivery" },
  "shiprocket": { provider: "lever", board: "shiprocket" },
  "chargebee": { provider: "greenhouse", board: "chargebee" },
  "hasura": { provider: "greenhouse", board: "hasura" },
  "soroco": { provider: "lever", board: "soroco" },
  "fractal": { provider: "greenhouse", board: "fractal" },
  "moengage": { provider: "lever", board: "moengage" },
  "clevertap": { provider: "lever", board: "clevertap" },

  // Major Global Tech
  "google": { provider: "custom", board: "https://careers.google.com/jobs/results/" },
  "microsoft": { provider: "custom", board: "https://careers.microsoft.com/us/en/search-results" },
  "amazon": { provider: "custom", board: "https://www.amazon.jobs/en/search" },
  "meta": { provider: "greenhouse", board: "meta" },
  "apple": { provider: "custom", board: "https://jobs.apple.com/en-in/search" },
  "netflix": { provider: "greenhouse", board: "netflix" },
  "uber": { provider: "greenhouse", board: "uber" },
  "airbnb": { provider: "greenhouse", board: "airbnb" },
  "stripe": { provider: "greenhouse", board: "stripe" },
  "spotify": { provider: "greenhouse", board: "spotify" },
  "notion": { provider: "greenhouse", board: "notionhq" },
  "figma": { provider: "greenhouse", board: "figma" },
  "vercel": { provider: "greenhouse", board: "vercel" },
  "datadog": { provider: "greenhouse", board: "datadog" },
  "twilio": { provider: "greenhouse", board: "twilio" },
  "cloudflare": { provider: "greenhouse", board: "cloudflare" },
  "gitlab": { provider: "greenhouse", board: "gitlab" },
  "atlassian": { provider: "greenhouse", board: "atlassian" },
  "salesforce": { provider: "greenhouse", board: "salesforce" },
  "oracle": { provider: "custom", board: "https://careers.oracle.com/jobs/" },
  "adobe": { provider: "greenhouse", board: "adobe" },
  "vmware": { provider: "greenhouse", board: "vmware" },
  "nutanix": { provider: "greenhouse", board: "nutanixinc" },
  "palantir": { provider: "greenhouse", board: "palantir" },
  "coinbase": { provider: "greenhouse", board: "coinbase" },
  "rippling": { provider: "greenhouse", board: "rippling" },
  "hashicorp": { provider: "greenhouse", board: "hashicorp" },
  "mongodb": { provider: "greenhouse", board: "mongodb" },
  "elastic": { provider: "greenhouse", board: "elastic" },
  "supabase": { provider: "ashby", board: "supabase" },
  "linear": { provider: "ashby", board: "linear" },

  // Indian Conglomerates
  "tata": { provider: "custom", board: "https://www.tata.com/careers" },
  "infosys": { provider: "custom", board: "https://career.infosys.com/" },
  "wipro": { provider: "custom", board: "https://careers.wipro.com/" },
  "tcs": { provider: "custom", board: "https://ibegin.tcs.com/iBegin/" },
  "hcl": { provider: "custom", board: "https://www.hcltech.com/careers" },
  "tech mahindra": { provider: "custom", board: "https://careers.techmahindra.com/" },
  "l&t": { provider: "custom", board: "https://careers.larsentoubro.com/" },
  "cognizant": { provider: "custom", board: "https://careers.cognizant.com/" },
};

async function fetchWithTimeout(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Generate common board name variants for a company name.
 * e.g., "Urban Company" -> ["urbancompany", "urban-company", "urban_company", "urbancompanycareers", ...]
 */
function generateBoardVariants(companyName: string): string[] {
  const base = companyName.toLowerCase().trim();
  const stripped = base.replace(/[^a-z0-9]/g, "");
  const hyphenated = base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const underscored = base.replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

  const variants = new Set([
    stripped,
    hyphenated,
    underscored,
    stripped + "careers",
    stripped + "jobs",
    stripped + "hq",
    stripped + "inc",
    stripped + "io",
    stripped + "tech",
    hyphenated + "-careers",
  ]);

  return Array.from(variants);
}

export async function discoverAts(companyName: string): Promise<{ provider: string; board: string } | null> {
  // 1. Check static known boards first (instant, no network)
  const normalizedKey = companyName.toLowerCase().trim();
  if (KNOWN_BOARDS[normalizedKey]) {
    return KNOWN_BOARDS[normalizedKey];
  }

  // 2. Generate variants and probe ATS APIs
  const variants = generateBoardVariants(companyName);

  for (const guess of variants) {
    // Lever
    try {
      const leverRes = await fetchWithTimeout(`https://api.lever.co/v0/postings/${guess}?mode=json`);
      if (leverRes.ok) {
        const data = await leverRes.json();
        if (Array.isArray(data) && data.length > 0) return { provider: "lever", board: guess };
      }
    } catch (e) {}

    // Greenhouse
    try {
      const ghRes = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`);
      if (ghRes.ok) {
        const data = await ghRes.json();
        if (data && data.jobs && data.jobs.length > 0) return { provider: "greenhouse", board: guess };
      }
    } catch (e) {}

    // Ashby
    try {
      const ashbyRes = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${guess}`);
      if (ashbyRes.ok) {
        const data = await ashbyRes.json();
        if (data && data.jobs && data.jobs.length > 0) return { provider: "ashby", board: guess };
      }
    } catch (e) {}

    // SmartRecruiters
    try {
      const srRes = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${guess}/postings`);
      if (srRes.ok) {
        const data = await srRes.json();
        if (data && data.content && data.content.length > 0) return { provider: "smartrecruiters", board: guess };
      }
    } catch (e) {}

    // Add a tiny delay between variants to be polite
    await new Promise(r => setTimeout(r, 100));
  }

  return null;
}
