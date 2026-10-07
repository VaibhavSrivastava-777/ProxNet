import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { generateBoardVariants } from "../lib/ats-discovery";

dotenv.config({ path: ".env.local" });

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...options.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Check standard ATS endpoints
async function probeATS(token: string): Promise<{ provider: string; board: string; jobCount: number } | null> {
  // 1. Greenhouse
  try {
    const res = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=false`, {}, 2000);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        return { provider: "greenhouse", board: token, jobCount: data.jobs.length };
      }
    }
  } catch (e) {}

  // 2. Lever
  try {
    const res = await fetchWithTimeout(`https://api.lever.co/v0/postings/${token}?mode=json`, {}, 2000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { provider: "lever", board: token, jobCount: data.length };
      }
    }
  } catch (e) {}

  // 3. Ashby
  try {
    const res = await fetchWithTimeout(`https://api.ashbyhq.com/posting-api/job-board/${token}`, {}, 2000);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        return { provider: "ashby", board: token, jobCount: data.jobs.length };
      }
    }
  } catch (e) {}

  // 4. SmartRecruiters
  try {
    const res = await fetchWithTimeout(`https://api.smartrecruiters.com/v1/companies/${token}/postings`, {}, 2000);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.content) && data.content.length > 0) {
        return { provider: "smartrecruiters", board: token, jobCount: data.content.length };
      }
    }
  } catch (e) {}

  // 5. Workable
  try {
    const res = await fetchWithTimeout(`https://www.workable.com/api/accounts/${token}?details=false`, {}, 2000);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        return { provider: "workable", board: token, jobCount: data.jobs.length };
      }
    }
  } catch (e) {}

  return null;
}

// Also follow redirects on career URLs to see if they redirect to Greenhouse, Lever, etc.
async function probeCareerUrl(careerUrl: string): Promise<{ provider: string; board: string; jobCount: number } | null> {
  if (!careerUrl || !careerUrl.startsWith("http") || careerUrl.includes("google.com/search")) {
    return null;
  }
  try {
    const res = await fetchWithTimeout(careerUrl, { redirect: "follow" }, 3500);
    const finalUrl = res.url || "";
    
    // Check final URL
    // Greenhouse
    const ghMatch = finalUrl.match(/(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#]+)/i);
    if (ghMatch) {
      const token = ghMatch[1];
      const verified = await probeATS(token);
      if (verified) return verified;
      return { provider: "greenhouse", board: token, jobCount: 0 };
    }
    // Lever
    const leverMatch = finalUrl.match(/jobs\.lever\.co\/([^/?#]+)/i);
    if (leverMatch) {
      const token = leverMatch[1];
      const verified = await probeATS(token);
      if (verified) return verified;
      return { provider: "lever", board: token, jobCount: 0 };
    }
    // Ashby
    const ashbyMatch = finalUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
    if (ashbyMatch) {
      const token = ashbyMatch[1];
      const verified = await probeATS(token);
      if (verified) return verified;
      return { provider: "ashby", board: token, jobCount: 0 };
    }
    // SmartRecruiters
    const srMatch = finalUrl.match(/(?:careers|jobs)\.smartrecruiters\.com\/([^/?#]+)/i);
    if (srMatch) {
      const token = srMatch[1];
      const verified = await probeATS(token);
      if (verified) return verified;
      return { provider: "smartrecruiters", board: token, jobCount: 0 };
    }
    // Workday
    if (finalUrl.includes("myworkdayjobs.com")) {
      return { provider: "workday", board: finalUrl, jobCount: 0 };
    }

    // Also inspect page text for embedded greenhouse/lever/ashby links or iframes
    if (res.ok) {
      const html = await res.text();
      const iframeGh = html.match(/boards\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-zA-Z0-9_-]+)/i);
      if (iframeGh) {
        const verified = await probeATS(iframeGh[1]);
        if (verified) return verified;
      }
      const iframeLever = html.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/i);
      if (iframeLever) {
        const verified = await probeATS(iframeLever[1]);
        if (verified) return verified;
      }
      const iframeAshby = html.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/i);
      if (iframeAshby) {
        const verified = await probeATS(iframeAshby[1]);
        if (verified) return verified;
      }
    }
  } catch (e) {}

  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  const supabase = createClient(url, key);

  const { data: boards } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status")
    .order("company_name", { ascending: true });

  if (!boards) return;

  const zeroJobs = boards.filter((b) => !b.total_jobs_found || b.total_jobs_found === 0);
  console.log(`Analyzing all ${zeroJobs.length} zero-job boards...`);

  const results: {
    company: string;
    oldProvider: string;
    oldToken: string;
    newProvider?: string;
    newToken?: string;
    jobsFound?: number;
    issueReason: string;
  }[] = [];

  for (let i = 0; i < zeroJobs.length; i++) {
    const b = zeroJobs[i];
    const company = b.company_name;
    const oldProvider = b.provider;
    const oldToken = b.board_token_or_url || "";

    // Generate token variants to probe
    const variants = new Set<string>();
    if (!oldToken.startsWith("http")) {
      variants.add(oldToken.toLowerCase());
      variants.add(oldToken.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
    const cleanCompany = company
      .replace(/\(.*\)/g, "")
      .replace(/pvt\.?|ltd\.?|limited|inc\.?|corp\.?|corporation|technologies|solutions/gi, "")
      .trim();

    for (const v of [cleanCompany, company]) {
      const vClean = v.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (vClean) {
        variants.add(vClean);
        variants.add(`${vClean}careers`);
        variants.add(`${vClean}jobs`);
        variants.add(`${vClean}-tech`);
      }
      const vHyphen = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (vHyphen) {
        variants.add(vHyphen);
      }
    }

    let found: { provider: string; board: string; jobCount: number } | null = null;

    // 1. Probe direct ATS with variants
    for (const token of variants) {
      found = await probeATS(token);
      if (found) break;
    }

    // 2. If not found and had a URL, probe URL redirects/embeds
    if (!found && oldToken.startsWith("http")) {
      found = await probeCareerUrl(oldToken);
    }

    if (found) {
      results.push({
        company,
        oldProvider,
        oldToken,
        newProvider: found.provider,
        newToken: found.board,
        jobsFound: found.jobCount,
        issueReason: `Recovered via ATS Probe (${found.provider}: ${found.board} with ${found.jobCount} jobs)`
      });
      console.log(`[${i + 1}/${zeroJobs.length}] ✅ FOUND ${company}: ${oldProvider}("${oldToken}") -> ${found.provider}("${found.board}") with ${found.jobCount} jobs`);
    } else {
      let issue = "Unknown";
      if (oldToken.includes("google.com/search")) {
        issue = "Google Search query URL (cannot be scraped)";
      } else if (oldProvider === "none") {
        issue = "Provider is 'none' / No careers URL configured";
      } else if (oldProvider === "greenhouse" || oldProvider === "lever" || oldProvider === "ashby" || oldProvider === "smartrecruiters") {
        issue = `Dead/Invalid ${oldProvider} token (returned 404 or empty)`;
      } else if (oldProvider === "workday") {
        issue = "Workday WAF Cloudflare block or expired URL";
      } else if (oldProvider === "custom") {
        issue = "Generic corporate website; requires targeted career portal URL or custom crawler";
      }
      results.push({
        company,
        oldProvider,
        oldToken,
        issueReason: issue
      });
      console.log(`[${i + 1}/${zeroJobs.length}] ❌ 0-job reason for ${company}: ${issue}`);
    }
  }

  console.log("\n==================================================");
  console.log("AUDIT SUMMARY");
  console.log("==================================================");
  const recovered = results.filter(r => r.newProvider);
  console.log(`Total zero-job boards analyzed: ${zeroJobs.length}`);
  console.log(`Immediately recoverable with verified standard ATS APIs: ${recovered.length}`);

  // Summary by issue reason
  const reasons: Record<string, number> = {};
  for (const r of results.filter(r => !r.newProvider)) {
    reasons[r.issueReason] = (reasons[r.issueReason] || 0) + 1;
  }
  console.log("\nUnrecovered Breakdown:", reasons);
}

main();
