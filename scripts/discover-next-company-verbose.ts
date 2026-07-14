import { companyMappings } from "../lib/anonymize";

// Well-known boards from ats-discovery.ts
const KNOWN_BOARDS: Record<string, { provider: string; board: string }> = {
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
  "zscaler": { provider: "greenhouse", board: "zscaler" },
  "tata": { provider: "custom", board: "https://www.tata.com/careers" },
  "infosys": { provider: "custom", board: "https://career.infosys.com/" },
  "wipro": { provider: "custom", board: "https://careers.wipro.com/" },
  "tcs": { provider: "custom", board: "https://ibegin.tcs.com/iBegin/" },
  "hcl": { provider: "custom", board: "https://www.hcltech.com/careers" },
  "tech mahindra": { provider: "custom", board: "https://careers.techmahindra.com/" },
  "l&t": { provider: "custom", board: "https://careers.larsentoubro.com/" },
  "cognizant": { provider: "custom", board: "https://careers.cognizant.com/" },
};

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

async function discoverAtsVerbose(companyName: string): Promise<{ provider: string; board: string } | null> {
  const normalizedKey = companyName.toLowerCase().trim();
  if (KNOWN_BOARDS[normalizedKey]) {
    console.log(`  [Static Check] Found in KNOWN_BOARDS: ${JSON.stringify(KNOWN_BOARDS[normalizedKey])}`);
    return KNOWN_BOARDS[normalizedKey];
  }

  const variants = generateBoardVariants(companyName);
  console.log(`  [Variants to probe] ${JSON.stringify(variants)}`);

  for (const guess of variants) {
    // 1. Lever
    const leverUrl = `https://api.lever.co/v0/postings/${guess}?mode=json`;
    try {
      console.log(`    Probing Lever: ${leverUrl}`);
      const res = await fetchWithTimeout(leverUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`    🎉 Found LEVER board: "${guess}"`);
          return { provider: "lever", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      Lever failed: ${e.message}`);
    }

    // 2. Greenhouse
    const ghUrl = `https://boards-api.greenhouse.io/v1/boards/${guess}/jobs?content=true`;
    try {
      console.log(`    Probing Greenhouse: ${ghUrl}`);
      const res = await fetchWithTimeout(ghUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.jobs && data.jobs.length > 0) {
          console.log(`    🎉 Found GREENHOUSE board: "${guess}"`);
          return { provider: "greenhouse", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      Greenhouse failed: ${e.message}`);
    }

    // 3. Ashby
    const ashbyUrl = `https://api.ashbyhq.com/posting-api/job-board/${guess}`;
    try {
      console.log(`    Probing Ashby: ${ashbyUrl}`);
      const res = await fetchWithTimeout(ashbyUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.jobs && data.jobs.length > 0) {
          console.log(`    🎉 Found ASHBY board: "${guess}"`);
          return { provider: "ashby", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      Ashby failed: ${e.message}`);
    }

    // 4. SmartRecruiters
    const srUrl = `https://api.smartrecruiters.com/v1/companies/${guess}/postings`;
    try {
      console.log(`    Probing SmartRecruiters: ${srUrl}`);
      const res = await fetchWithTimeout(srUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.content && data.content.length > 0) {
          console.log(`    🎉 Found SMARTRECRUITERS board: "${guess}"`);
          return { provider: "smartrecruiters", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      SmartRecruiters failed: ${e.message}`);
    }

    // 5. Workable
    const workableUrl = `https://www.workable.com/api/accounts/${guess}?details=true`;
    try {
      console.log(`    Probing Workable: ${workableUrl}`);
      const res = await fetchWithTimeout(workableUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
          console.log(`    🎉 Found WORKABLE board: "${guess}"`);
          return { provider: "workable", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      Workable failed: ${e.message}`);
    }

    // 6. Breezy
    const breezyUrl = `https://${guess}.breezy.hr/json`;
    try {
      console.log(`    Probing Breezy: ${breezyUrl}`);
      const res = await fetchWithTimeout(breezyUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`    🎉 Found BREEZY board: "${guess}"`);
          return { provider: "breezy", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      Breezy failed: ${e.message}`);
    }

    // 7. Recruitee
    const recruiteeUrl = `https://${guess}.recruitee.com/api/offers`;
    try {
      console.log(`    Probing Recruitee: ${recruiteeUrl}`);
      const res = await fetchWithTimeout(recruiteeUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.offers) && data.offers.length > 0) {
          console.log(`    🎉 Found RECRUITEE board: "${guess}"`);
          return { provider: "recruitee", board: guess };
        }
      }
    } catch (e: any) {
      console.log(`      Recruitee failed: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return null;
}

async function run() {
  const companies = [
    "Coverself",
    "Fitsol",
    "Farcast Biosciences",
    "Verint systems",
    "Diageo",
    "EY",
    "Accenture",
    "Optum",
    "Rakuten India"
  ];

  for (const c of companies) {
    console.log(`\n🔎 [Discovery] Probing ATS for "${c}"...`);
    const res = await discoverAtsVerbose(c);
    if (res) {
      console.log(`✅ MATCH FOUND: Company="${c}", Provider="${res.provider}", Board="${res.board}"`);
    } else {
      console.log(`❌ NO ATS FOUND: Company="${c}"`);
    }
  }
}

run();
