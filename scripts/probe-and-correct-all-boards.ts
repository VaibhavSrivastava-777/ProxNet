import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fast fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

interface ATSProbeResult {
  provider: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable";
  token: string;
  jobCount: number;
}

// Probe a single token across ATS providers
async function probeToken(token: string): Promise<ATSProbeResult | null> {
  const clean = token.trim();
  if (!clean || clean.length < 2) return null;

  // 1. Greenhouse
  try {
    const res = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${clean}/jobs`, {}, 2500);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        return { provider: "greenhouse", token: clean, jobCount: data.jobs.length };
      }
    }
  } catch (e) {}

  // 2. Lever
  try {
    const res = await fetchWithTimeout(`https://api.lever.co/v0/postings/${clean}?mode=json`, {}, 2500);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { provider: "lever", token: clean, jobCount: data.length };
      }
    }
  } catch (e) {}

  // 3. Ashby
  try {
    const res = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${clean}`, {}, 2500);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        return { provider: "ashby", token: clean, jobCount: data.jobs.length };
      }
    }
  } catch (e) {}

  // 4. SmartRecruiters
  try {
    const res = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${clean}/postings`, {}, 2500);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.content) && data.content.length > 0) {
        return { provider: "smartrecruiters", token: clean, jobCount: data.content.length };
      }
    }
  } catch (e) {}

  // 5. Workable
  try {
    const res = await fetchWithTimeout(`https://www.workable.com/api/accounts/${clean}?details=false`, {}, 2500);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        return { provider: "workable", token: clean, jobCount: data.jobs.length };
      }
    }
  } catch (e) {}

  return null;
}

// Generate sensible token variants for a company name
function generateVariants(companyName: string, existingToken: string): string[] {
  const set = new Set<string>();

  if (existingToken && !existingToken.startsWith("http")) {
    set.add(existingToken.toLowerCase().trim());
    set.add(existingToken.toLowerCase().replace(/[^a-z0-9]/g, ""));
  }

  const cleanName = companyName
    .replace(/\(.*?\)/g, "")
    .replace(/\b(ltd|limited|pvt|private|inc|corp|corporation|technologies|technology|solutions|services|group|india|software|consulting|global)\b/gi, "")
    .trim();

  const namesToProcess = [companyName, cleanName];
  for (const name of namesToProcess) {
    const alphanumeric = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (alphanumeric.length >= 2) {
      set.add(alphanumeric);
      set.add(`${alphanumeric}careers`);
      set.add(`${alphanumeric}jobs`);
      set.add(`${alphanumeric}tech`);
    }
    const hyphenated = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (hyphenated.length >= 2 && hyphenated !== alphanumeric) {
      set.add(hyphenated);
    }
  }

  return Array.from(set);
}

// Concurrency helper
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Well-known corporate career sites that were broken (e.g. google search URLs or bad URLs)
const KNOWN_CAREER_URL_FIXES: Record<string, { provider: string; url: string }> = {
  "Google": { provider: "custom", url: "https://careers.google.com/jobs/results/?location=India" },
  "Microsoft": { provider: "custom", url: "https://jobs.careers.microsoft.com/global/en/search?lc=India" },
  "Apple": { provider: "custom", url: "https://jobs.apple.com/en-in/search" },
  "Amazon": { provider: "amazon", url: "https://www.amazon.jobs/en/search?loc_query=India" },
  "Meta": { provider: "custom", url: "https://www.metacareers.com/jobs" },
  "Adobe": { provider: "custom", url: "https://careers.adobe.com/us/en/search-results" },
  "Salesforce": { provider: "custom", url: "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site" },
  "Atlassian": { provider: "custom", url: "https://www.atlassian.com/company/careers/all-jobs" },
  "Zoho Corporation": { provider: "custom", url: "https://www.zoho.com/careers/jobopenings.html" },
  "TCS": { provider: "custom", url: "https://ibegin.tcs.com/iBegin/" },
  "Tata Consultancy Services (TCS)": { provider: "custom", url: "https://ibegin.tcs.com/iBegin/" },
  "Infosys Ltd.": { provider: "custom", url: "https://career.infosys.com/" },
  "Wipro": { provider: "custom", url: "https://careers.wipro.com/" },
  "Cognizant Technology Solutions": { provider: "custom", url: "https://careers.cognizant.com/" },
  "HCL Technologies": { provider: "custom", url: "https://www.hcltech.com/careers" },
  "Tech Mahindra": { provider: "custom", url: "https://careers.techmahindra.com/" },
  "Accenture": { provider: "custom", url: "https://www.accenture.com/in-en/careers/jobsearch" },
  "Deloitte": { provider: "custom", url: "https://uscareers.deloitte.com/en/search-jobs" },
  "Ernst & Young (EY)": { provider: "custom", url: "https://careers.ey.com/search/?q=&locationsearch=India" },
  "PricewaterhouseCoopers (PwC)": { provider: "custom", url: "https://jobs.pwc.com/in/en" },
  "KPMG India": { provider: "custom", url: "https://kpmg.com/in/en/home/careers.html" },
  "McKinsey and company": { provider: "custom", url: "https://www.mckinsey.com/careers/search-jobs" },
  "Boston Consulting Group (BCG)": { provider: "custom", url: "https://www.bcg.com/careers" },
  "Bain & Company": { provider: "custom", url: "https://www.bain.com/careers/" },
  "Reliance Jio": { provider: "custom", url: "https://careers.jio.com/" },
  "Flipkart": { provider: "custom", url: "https://www.flipkartcareers.com/" },
  "Zomato": { provider: "custom", url: "https://www.zomato.com/careers" },
  "Swiggy": { provider: "smartrecruiters", url: "swiggy" },
  "Freshworks": { provider: "smartrecruiters", url: "freshworks" },
  "InMobi": { provider: "greenhouse", url: "inmobi" },
  "Meesho": { provider: "lever", url: "meesho" },
  "Canva": { provider: "smartrecruiters", url: "canva" },
  "Check Point Software Technologies": { provider: "smartrecruiters", url: "checkpointsoftwaretechnologies" },
  "Figma": { provider: "greenhouse", url: "figma" },
  "Vercel": { provider: "greenhouse", url: "vercel" },
  "Datadog": { provider: "greenhouse", url: "datadog" },
  "Cloudflare": { provider: "greenhouse", url: "cloudflare" },
  "Elastic": { provider: "greenhouse", url: "elastic" },
  "MongoDB": { provider: "greenhouse", url: "mongodb" },
  "GitLab": { provider: "greenhouse", url: "gitlab" },
  "Stripe": { provider: "greenhouse", url: "stripe" },
  "CRED": { provider: "lever", url: "cred" },
  "Paytm": { provider: "custom", url: "https://paytm.com/careers" },
  "PhonePe": { provider: "custom", url: "https://www.phonepe.com/careers/" },
  "Razorpay": { provider: "custom", url: "https://razorpay.com/jobs/" },
  "Zerodha": { provider: "custom", url: "https://zerodha.com/careers" },
  "Zepto": { provider: "custom", url: "https://www.zeptonow.com/careers" },
  "Urban Company": { provider: "custom", url: "https://www.urbancompany.com/careers" },
  "Lenskart": { provider: "custom", url: "https://hiring.lenskart.com/" },
  "Policybazaar": { provider: "custom", url: "https://www.policybazaar.com/careers/" },
  "Delhivery": { provider: "custom", url: "https://www.delhivery.com/careers/" },
  "Dunzo": { provider: "custom", url: "https://www.dunzo.com/careers" },
  "Rippling": { provider: "custom", url: "https://www.rippling.com/careers" },
  "10x Genomics": { provider: "custom", url: "https://www.10xgenomics.com/careers" },
  "Automattic": { provider: "custom", url: "https://automattic.com/work-with-us/" },
  "Chargebee": { provider: "custom", url: "https://www.chargebee.com/careers/" },
};

async function main() {
  console.log("======================================================");
  console.log("🔍 PROBING & CORRECTING ALL ATS BOARDS");
  console.log("======================================================");

  const { data: boards, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status")
    .order("company_name", { ascending: true });

  if (error || !boards) {
    console.error("Failed to load configs:", error);
    return;
  }

  console.log(`Loaded ${boards.length} canonical ATS board configurations.`);

  let updatedCount = 0;
  const updates: {
    company: string;
    oldProvider: string;
    oldToken: string;
    newProvider: string;
    newToken: string;
    reason: string;
  }[] = [];

  // Run probing across all boards with concurrency = 15
  await mapConcurrent(boards, 15, async (b, idx) => {
    const company = b.company_name;
    const oldProvider = b.provider;
    const oldToken = b.board_token_or_url || "";

    // 1. Check known explicit fixes first
    if (KNOWN_CAREER_URL_FIXES[company]) {
      const fix = KNOWN_CAREER_URL_FIXES[company];
      if (oldProvider !== fix.provider || oldToken !== fix.url) {
        updates.push({
          company,
          oldProvider,
          oldToken,
          newProvider: fix.provider,
          newToken: fix.url,
          reason: `Verified known career destination: ${fix.provider} -> ${fix.url}`,
        });
        return;
      }
    }

    // 2. Fix Google Search URLs
    if (oldToken.includes("google.com/search")) {
      const matchQuery = oldToken.match(/q=([^&]+)/);
      const queryName = matchQuery ? decodeURIComponent(matchQuery[1]).replace(/careers|jobs|\+/gi, " ").trim() : company;
      updates.push({
        company,
        oldProvider,
        oldToken,
        newProvider: "custom",
        newToken: `https://www.${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`,
        reason: `Replaced invalid Google search query URL with clean corporate domain careers path`,
      });
      return;
    }

    // 3. For boards with 0 jobs or provider = "none", probe live ATS APIs
    if (!b.total_jobs_found || b.total_jobs_found === 0 || oldProvider === "none") {
      const variants = generateVariants(company, oldToken);
      let probeHit: ATSProbeResult | null = null;

      for (const token of variants) {
        probeHit = await probeToken(token);
        if (probeHit) break;
      }

      if (probeHit) {
        if (oldProvider !== probeHit.provider || oldToken !== probeHit.token) {
          updates.push({
            company,
            oldProvider,
            oldToken,
            newProvider: probeHit.provider,
            newToken: probeHit.token,
            reason: `Discovered live ${probeHit.provider.toUpperCase()} board (${probeHit.jobCount} live requisitions)`,
          });
          return;
        }
      }
    }
  });

  console.log(`\nFound ${updates.length} configurations to correct.`);

  for (const u of updates) {
    console.log(`\n🔧 Correcting: ${u.company}`);
    console.log(`   Old: [${u.oldProvider}] "${u.oldToken}"`);
    console.log(`   New: [${u.newProvider}] "${u.newToken}"`);
    console.log(`   Reason: ${u.reason}`);

    const { error: updateError } = await supabase
      .from("company_ats_config")
      .update({
        provider: u.newProvider,
        board_token_or_url: u.newToken,
        scrape_notes: `Corrected via deep ATS audit: ${u.reason}`,
      })
      .eq("company_name", u.company);

    if (updateError) {
      console.error(`   ❌ Failed to update ${u.company}:`, updateError.message);
    } else {
      updatedCount++;
    }
  }

  console.log("\n======================================================");
  console.log(`✅ ATS CONFIG CORRECTION COMPLETE: ${updatedCount} boards updated.`);
  console.log("======================================================");
}

main();
