// Well-known company → board token mappings
// This is the fastest way to populate jobs for ProxNet network companies
const KNOWN_BOARDS: Record<string, { provider: string; board: string }> = {
  // Major Indian Tech & Unicorns
  "flipkart": { provider: "custom", board: "https://www.flipkartcareers.com/" },
  "swiggy": { provider: "custom", board: "https://careers.swiggy.com/" },
  "meesho": { provider: "lever", board: "meesho" },
  "razorpay": { provider: "custom", board: "https://razorpay.com/jobs/" },
  "zerodha": { provider: "custom", board: "https://zerodha.com/careers" },
  "phonepe": { provider: "custom", board: "https://www.phonepe.com/careers/" },
  "cred": { provider: "lever", board: "cred" },
  "groww": { provider: "custom", board: "https://groww.in/careers" },
  "zomato": { provider: "custom", board: "https://www.zomato.com/careers" },
  "ola": { provider: "custom", board: "https://www.olacabs.com/careers" },
  "ola cabs": { provider: "custom", board: "https://www.olacabs.com/careers" },
  "paytm": { provider: "lever", board: "paytm" },
  "byju's": { provider: "custom", board: "https://byjus.com/careers/" },
  "byjus": { provider: "custom", board: "https://byjus.com/careers/" },
  "unacademy": { provider: "lever", board: "unacademy" },
  "dream11": { provider: "lever", board: "dream11" },
  "myntra": { provider: "custom", board: "https://careers.myntra.com/" },
  "udaan": { provider: "lever", board: "udaan" },
  "nykaa": { provider: "custom", board: "https://www.nykaa.com/careers" },
  "freshworks": { provider: "custom", board: "https://www.freshworks.com/company/careers/" },
  "zoho": { provider: "lever", board: "zoho" },
  "postman": { provider: "custom", board: "https://www.postman.com/company/careers/" },
  "browserstack": { provider: "custom", board: "https://www.browserstack.com/careers" },
  "cleartrip": { provider: "custom", board: "https://careers.cleartrip.com/" },
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
  "blinkit": { provider: "custom", board: "https://blinkit.com/careers" },
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
  "google": { provider: "custom", board: "https://careers.google.com/jobs/results/?location=India" },
  "microsoft": { provider: "custom", board: "https://jobs.careers.microsoft.com/global/en/search?lc=India" },
  "amazon": { provider: "amazon", board: "https://www.amazon.jobs/en/search?loc_query=India" },
  "meta": { provider: "custom", board: "https://www.metacareers.com/jobs" },
  "apple": { provider: "custom", board: "https://jobs.apple.com/en-in/search" },
  "netflix": { provider: "custom", board: "https://jobs.netflix.com/search" },
  "uber": { provider: "custom", board: "https://www.uber.com/in/en/careers/list/" },
  "airbnb": { provider: "custom", board: "https://careers.airbnb.com/positions/" },
  "stripe": { provider: "greenhouse", board: "stripe" },
  "spotify": { provider: "custom", board: "https://www.lifeatspotify.com/jobs" },
  "notion": { provider: "custom", board: "https://www.notion.so/careers" },
  "figma": { provider: "greenhouse", board: "figma" },
  "vercel": { provider: "greenhouse", board: "vercel" },
  "datadog": { provider: "greenhouse", board: "datadog" },
  "twilio": { provider: "greenhouse", board: "twilio" },
  "cloudflare": { provider: "greenhouse", board: "cloudflare" },
  "gitlab": { provider: "greenhouse", board: "gitlab" },
  "atlassian": { provider: "greenhouse", board: "atlassian" },
  "salesforce": { provider: "greenhouse", board: "salesforce" },
  "oracle": { provider: "oracle", board: "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch/requisitions" },
  "adobe": { provider: "custom", board: "https://careers.adobe.com/us/en/search-results" },
  "vmware": { provider: "custom", board: "https://careers.vmware.com/main/jobs" },
  "nutanix": { provider: "greenhouse", board: "nutanixinc" },
  "palantir": { provider: "greenhouse", board: "palantir" },
  "coinbase": { provider: "greenhouse", board: "coinbase" },
  "rippling": { provider: "greenhouse", board: "rippling" },
  "hashicorp": { provider: "greenhouse", board: "hashicorp" },
  "mongodb": { provider: "greenhouse", board: "mongodb" },
  "elastic": { provider: "greenhouse", board: "elastic" },
  "supabase": { provider: "ashby", board: "supabase" },
  "linear": { provider: "ashby", board: "linear" },
  "zscaler": { provider: "greenhouse", board: "zscaler" },

  // Indian Conglomerates & IT Giants
  "tata": { provider: "custom", board: "https://www.tata.com/careers" },
  "tcs": { provider: "custom", board: "https://ibegin.tcs.com/iBegin/" },
  "tata consultancy services": { provider: "custom", board: "https://ibegin.tcs.com/iBegin/" },
  "tata consultancy services limited": { provider: "custom", board: "https://ibegin.tcs.com/iBegin/" },
  "infosys": { provider: "custom", board: "https://career.infosys.com/" },
  "infosys ltd": { provider: "custom", board: "https://career.infosys.com/" },
  "infosys ltd.": { provider: "custom", board: "https://career.infosys.com/" },
  "wipro": { provider: "custom", board: "https://careers.wipro.com/" },
  "hcl": { provider: "custom", board: "https://www.hcltech.com/careers" },
  "hcl tech": { provider: "custom", board: "https://www.hcltech.com/careers" },
  "hcl technologies": { provider: "custom", board: "https://www.hcltech.com/careers" },
  "tech mahindra": { provider: "custom", board: "https://careers.techmahindra.com/" },
  "l&t": { provider: "custom", board: "https://careers.larsentoubro.com/" },
  "cognizant": { provider: "custom", board: "https://careers.cognizant.com/" },
  "cognizant technology solutions": { provider: "custom", board: "https://careers.cognizant.com/" },
  "dell": { provider: "oracle", board: "https://iawmqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/careers/requisitions" },
  "dell technologies": { provider: "oracle", board: "https://iawmqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/careers/requisitions" },

  // Additional Indian Tech & Enterprise
  "accenture": { provider: "custom", board: "https://www.accenture.com/in-en/careers/jobsearch" },
  "capita": { provider: "custom", board: "https://www.capita.com/careers" },
  "ey": { provider: "custom", board: "https://careers.ey.com/search/?q=&locationsearch=India" },
  "mckinsey": { provider: "custom", board: "https://www.mckinsey.com/careers/search-jobs" },
  "mckinsey and company": { provider: "custom", board: "https://www.mckinsey.com/careers/search-jobs" },
  "optum": { provider: "custom", board: "https://www.optum.com/en/careers.html" },
  "persistent": { provider: "custom", board: "https://www.persistent.com/careers/" },
  "persistent systems": { provider: "custom", board: "https://www.persistent.com/careers/" },
  "rakuten": { provider: "custom", board: "https://rakuten.careers/" },
  "rakuten india": { provider: "custom", board: "https://rakuten.careers/" },
  "verint": { provider: "oracle", board: "https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions" },
  "verint systems": { provider: "oracle", board: "https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions" },
  "verint systems pvt ltd": { provider: "oracle", board: "https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions" },
  "vodafone": { provider: "custom", board: "https://careers.vodafone.com/" },
  "vodafone india": { provider: "custom", board: "https://careers.vodafone.com/" },
  "vodafone india services": { provider: "custom", board: "https://careers.vodafone.com/" },
  "wellsfargo": { provider: "custom", board: "https://www.wellsfargo.com/about/careers/" },
  "wells fargo": { provider: "custom", board: "https://www.wellsfargo.com/about/careers/" },
  "lenovo": { provider: "custom", board: "https://jobs.lenovo.com/" },
  "hdfc bank": { provider: "custom", board: "https://www.hdfcbank.com/personal/about-us/careers" },
  "hdfcbank": { provider: "custom", board: "https://www.hdfcbank.com/personal/about-us/careers" },
  "curefit": { provider: "custom", board: "https://cult.fit/careers" },
  "cure.fit": { provider: "custom", board: "https://cult.fit/careers" },
  "cultfit": { provider: "custom", board: "https://cult.fit/careers" },
  "cult.fit": { provider: "custom", board: "https://cult.fit/careers" },
  "jio": { provider: "custom", board: "https://careers.jio.com/" },
  "jio platforms": { provider: "custom", board: "https://careers.jio.com/" },
  "reliance jio": { provider: "custom", board: "https://careers.jio.com/" },
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Generate common board name variants for a company name.
 * e.g., "Urban Company" -> ["urbancompany", "urban-company", "urban_company", ...]
 */
function generateBoardVariants(companyName: string): string[] {
  const base = companyName.toLowerCase().trim();
  const stripped = base.replace(/[^a-z0-9]/g, "");
  const hyphenated = base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const variants = new Set([
    stripped,
    hyphenated,
    stripped + "careers",
    stripped + "jobs",
  ]);

  return Array.from(variants);
}

export async function discoverAts(companyName: string): Promise<{ provider: string; board: string } | null> {
  // 1. Check static known boards first (instant, no network)
  const normalizedKey = companyName.toLowerCase().trim();
  if (KNOWN_BOARDS[normalizedKey]) {
    return KNOWN_BOARDS[normalizedKey];
  }

  // 2. Generate variants and probe fast ATS APIs first (Lever, Greenhouse, Ashby, SmartRecruiters)
  const variants = generateBoardVariants(companyName);

  for (const guess of variants) {
    // Lever
    try {
      const leverRes = await fetchWithTimeout(`https://api.lever.co/v0/postings/${guess}?mode=json`, {}, 1500);
      if (leverRes.ok) {
        const data = await leverRes.json();
        if (Array.isArray(data) && data.length > 0) return { provider: "lever", board: guess };
      }
    } catch (e) {}

    // Greenhouse
    try {
      const ghRes = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`, {}, 1500);
      if (ghRes.ok) {
        const data = await ghRes.json();
        if (data && data.jobs && data.jobs.length > 0) return { provider: "greenhouse", board: guess };
      }
    } catch (e) {}

    // Ashby
    try {
      const ashbyRes = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${guess}`, {}, 1500);
      if (ashbyRes.ok) {
        const data = await ashbyRes.json();
        if (data && data.jobs && data.jobs.length > 0) return { provider: "ashby", board: guess };
      }
    } catch (e) {}

    // SmartRecruiters
    try {
      const srRes = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${guess}/postings`, {}, 1500);
      if (srRes.ok) {
        const data = await srRes.json();
        if (data && data.content && data.content.length > 0) return { provider: "smartrecruiters", board: guess };
      }
    } catch (e) {}
  }

  // 3. Workday Probing (only 2 main subdomains, 1s timeout per check)
  for (const guess of variants.slice(0, 2)) {
    const wdSubdomains = ["myworkdayjobs.com", "wd3.myworkdayjobs.com"];
    const siteVariants = [`${guess}careers`, `${guess}jobs`, guess, `careers`];

    for (const subdomain of wdSubdomains) {
      for (const site of siteVariants) {
        const checkUrl = `https://${guess}.${subdomain}/wday/cxs/${guess}/${site}/jobs`;
        try {
          const res = await fetchWithTimeout(checkUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" })
          }, 1000);

          if (res.status === 200) {
            return {
              provider: "workday",
              board: `${guess}.${subdomain}/wday/cxs/${guess}/${site}/jobs`
            };
          }
        } catch (e) {}
      }
    }
  }

  return null;
}

/**
 * Detect ATS provider and board identifier directly from a user-supplied career URL.
 * Supports Greenhouse, Lever, Ashby, SmartRecruiters, Workday, and Amazon.
 */
export function detectAtsFromUrl(url: string | null | undefined): { provider: string; board: string } | null {
  if (!url) return null;
  const clean = url.trim();

  // Greenhouse (boards.greenhouse.io/<board>, job-boards.greenhouse.io/<board>, or greenhouse.io/embed/job_board?for=<board>)
  const ghMatch = clean.match(/(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#]+)/i) ||
                  clean.match(/greenhouse\.io\/(?:embed\/job_board\?for=)([^/?#&]+)/i);
  if (ghMatch) return { provider: "greenhouse", board: ghMatch[1] };

  // Lever (jobs.lever.co/<board>)
  const leverMatch = clean.match(/jobs\.lever\.co\/([^/?#]+)/i);
  if (leverMatch) return { provider: "lever", board: leverMatch[1] };

  // Ashby (jobs.ashbyhq.com/<board>)
  const ashbyMatch = clean.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
  if (ashbyMatch) return { provider: "ashby", board: ashbyMatch[1] };

  // SmartRecruiters (careers.smartrecruiters.com/<board> or jobs.smartrecruiters.com/<board>)
  const srMatch = clean.match(/(?:careers|jobs)\.smartrecruiters\.com\/([^/?#]+)/i);
  if (srMatch) return { provider: "smartrecruiters", board: srMatch[1] };

  // Workday (e.g. *.myworkdayjobs.com)
  if (clean.includes("myworkdayjobs.com")) {
    return { provider: "workday", board: clean };
  }

  // Amazon
  if (clean.includes("amazon.jobs")) {
    return { provider: "amazon", board: clean };
  }

  return null;
}


