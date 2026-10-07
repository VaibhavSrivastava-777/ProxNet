import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

interface CheckResult {
  company: string;
  provider: string;
  tokenOrUrl: string;
  status: string;
  error?: string;
  discovered?: { provider: string; token: string; count: number };
}

async function testFetch(url: string, timeoutMs = 3000): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    return { ok: false, status: 0, text: e.message };
  }
}

async function probeAts(token: string): Promise<{ provider: string; token: string; count: number } | null> {
  const clean = token.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!clean) return null;

  // 1. Greenhouse
  const gh = await testFetch(`https://boards-api.greenhouse.io/v1/boards/${clean}/jobs`);
  if (gh.ok) {
    try {
      const data = JSON.parse(gh.text);
      if (data.jobs && data.jobs.length > 0) return { provider: "greenhouse", token: clean, count: data.jobs.length };
    } catch {}
  }

  // 2. Lever
  const lev = await testFetch(`https://api.lever.co/v0/postings/${clean}?mode=json`);
  if (lev.ok) {
    try {
      const data = JSON.parse(lev.text);
      if (Array.isArray(data) && data.length > 0) return { provider: "lever", token: clean, count: data.length };
    } catch {}
  }

  // 3. Ashby
  const ash = await testFetch(`https://api.ashbyhq.com/posting-api/job-board/${clean}`);
  if (ash.ok) {
    try {
      const data = JSON.parse(ash.text);
      if (data.jobs && data.jobs.length > 0) return { provider: "ashby", token: clean, count: data.jobs.length };
    } catch {}
  }

  // 4. SmartRecruiters
  const sr = await testFetch(`https://api.smartrecruiters.com/v1/companies/${clean}/postings`);
  if (sr.ok) {
    try {
      const data = JSON.parse(sr.text);
      if (data.content && data.content.length > 0) return { provider: "smartrecruiters", token: clean, count: data.content.length };
    } catch {}
  }

  return null;
}

async function main() {
  const supabase = createAdminClient();
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*")
    .order("provider", { ascending: true });

  const zeroJobs = (configs || []).filter(c => c.company_name !== "cron_status" && (!c.total_jobs_found || c.total_jobs_found === 0));
  console.log(`Analyzing ${zeroJobs.length} companies with 0 jobs found...`);

  // Let's test standard ATS providers first: greenhouse, lever, ashby, smartrecruiters
  const standardAts = zeroJobs.filter(c => ["greenhouse", "lever", "ashby", "smartrecruiters"].includes(c.provider));
  console.log(`\n--- Diagnosing ${standardAts.length} Standard ATS boards (Greenhouse, Lever, Ashby, SmartRecruiters) ---`);

  const results: CheckResult[] = [];

  for (const c of standardAts) {
    let testUrl = "";
    if (c.provider === "greenhouse") testUrl = `https://boards-api.greenhouse.io/v1/boards/${c.board_token_or_url}/jobs`;
    else if (c.provider === "lever") testUrl = `https://api.lever.co/v0/postings/${c.board_token_or_url}?mode=json`;
    else if (c.provider === "ashby") testUrl = `https://api.ashbyhq.com/posting-api/job-board/${c.board_token_or_url}`;
    else if (c.provider === "smartrecruiters") testUrl = `https://api.smartrecruiters.com/v1/companies/${c.board_token_or_url}/postings`;

    const res = await testFetch(testUrl);
    let status = `HTTP ${res.status}`;
    let jobCount = 0;

    if (res.ok) {
      try {
        const json = JSON.parse(res.text);
        if (Array.isArray(json)) jobCount = json.length;
        else if (json.jobs) jobCount = json.jobs.length;
        else if (json.content) jobCount = json.content.length;
        status = jobCount > 0 ? `API OK (${jobCount} jobs)` : "API OK (0 jobs returned - empty board)";
      } catch {
        status = "Invalid JSON response";
      }
    }

    // If failed or 0 jobs, probe alternative slug variants!
    let discovered: { provider: string; token: string; count: number } | undefined;
    if (!res.ok || jobCount === 0) {
      const candidates = [
        c.company_name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        c.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        c.company_name.toLowerCase().split(/\s+/)[0],
        c.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") + "careers",
        c.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") + "inc",
        c.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") + "tech",
      ];
      for (const cand of candidates) {
        if (!cand || cand === c.board_token_or_url) continue;
        const found = await probeAts(cand);
        if (found) {
          discovered = found;
          break;
        }
      }
    }

    results.push({
      company: c.company_name,
      provider: c.provider,
      tokenOrUrl: c.board_token_or_url,
      status,
      discovered,
    });
  }

  for (const r of results) {
    console.log(`• ${r.company} [${r.provider}] (token: "${r.tokenOrUrl}") -> Status: ${r.status}${r.discovered ? ` => 🎯 DISCOVERED FIX: [${r.discovered.provider}] "${r.discovered.token}" (${r.discovered.count} jobs)` : ""}`);
  }
}

main().catch(console.error);
