/**
 * Job posting quality & liveness checks.
 *
 * - isLikelyJobPostingUrl: rejects URLs that are clearly NOT a single job posting
 *   (search pages, careers landing pages, category listings, PDFs, Google links).
 * - getDescriptionText / hasSubstantiveDescription: detects title-only "descriptions".
 * - inspectJobPage: fetches the posting and decides active / closed / unknown,
 *   extracting a real description from JSON-LD JobPosting / meta tags when present.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const MIN_DESCRIPTION_CHARS = 200;

const CLOSED_MARKERS = [
  "no longer available",
  "no longer accepting applications",
  "position has been filled",
  "this position has been filled",
  "job is closed",
  "job has expired",
  "this job has expired",
  "job posting has expired",
  "posting has closed",
  "this posting is closed",
  "this role has been closed",
  "this job is no longer active",
  "job is no longer active",
  "position is closed",
  "requisition has been closed",
  "job post not found",
  "job not found",
  "invalid opportunity",
  "opportunity is no longer",
  "job you are looking for is no longer",
  "job you're looking for is no longer",
  "no longer exists",
  "page not found",
  "unable to find the page",
  "404 not found",
  "this job has been removed",
  "the job has been filled",
];

const NON_JOB_HOSTS = [
  "google.com",
  "bing.com",
  "linkedin.com/jobs/search",
  "indeed.com/jobs?",
  "naukri.com/",
  "glassdoor.",
];

const LISTING_PATH_PATTERNS: RegExp[] = [
  /\/search(?:[-_]jobs|[-_]results)?\/?$/i,
  /\/job[-_]search[-_]results/i,
  /\/all[-_]openings/i,
  /\/job[-_]category\//i,
  /\/(careers?|jobs|openings|opportunities|vacancies|join[-_]us|work[-_]with[-_]us)\/?$/i,
  /\.pdf$/i,
];

const LISTING_QUERY_KEYS = ["search", "q", "keywords", "department", "category", "filter_job_category", "ts", "regions", "sort_by", "start"];

/**
 * Returns false for URLs that clearly point at a search/listing/landing page instead of
 * one specific requisition. A real posting URL nearly always carries a job identifier.
 */
export function isLikelyJobPostingUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const full = `${u.hostname}${u.pathname}${u.search}`.toLowerCase();
  if (NON_JOB_HOSTS.some((h) => full.includes(h))) return false;

  const path = u.pathname.replace(/\/+$/, "");

  // Query-driven listing pages (e.g. ?search=&department=tech) with no job id in the path
  const queryKeys = Array.from(u.searchParams.keys()).map((k) => k.toLowerCase());
  const hasJobIdParam = queryKeys.some((k) => ["gh_jid", "jobid", "job_id", "id", "pid", "jid", "req", "reqid", "requisitionid", "jobreqid"].includes(k));
  const hasListingParam = queryKeys.some((k) => LISTING_QUERY_KEYS.includes(k));

  if (!path && !hasJobIdParam) return false;
  if (!hasJobIdParam && LISTING_PATH_PATTERNS.some((re) => re.test(u.pathname))) return false;
  if (/\.pdf$/i.test(u.pathname)) return false;

  // Job identifier signals: numeric id (4+ digits), UUID, requisition codes (JR123, R12345, REQ-123)
  const idSignal =
    /\d{4,}/.test(path) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(path) ||
    /\b(jr|r|req|job)[-_]?\d{3,}\b/i.test(path) ||
    hasJobIdParam;

  if (hasListingParam && !idSignal) return false;
  if (!idSignal) {
    // Allow slug-style detail URLs only when they clearly sit under a job/position segment
    // with a meaningful slug, e.g. /careers/job/senior-payroll-analyst-12
    const segments = path.split("/").filter(Boolean);
    const jobSegIdx = segments.findIndex((s) => /^(job|jobs|position|positions|posting|postings|requisition|opening|details?)$/i.test(s));
    if (jobSegIdx === -1 || jobSegIdx === segments.length - 1) return false;
    const slug = segments[segments.length - 1];
    if (/^\d+$/.test(slug)) return true;
    if (slug.split("-").length < 2) return false;
  }
  return true;
}

export function getDescriptionText(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the description carries real content (not just the title echoed back).
 */
export function hasSubstantiveDescription(description?: string | null, title?: string | null): boolean {
  const text = getDescriptionText(description);
  if (text.length < MIN_DESCRIPTION_CHARS) return false;
  if (title) {
    const t = title.toLowerCase().trim();
    const remainder = text.toLowerCase().replace(t, "").trim();
    if (remainder.length < MIN_DESCRIPTION_CHARS * 0.75) return false;
  }
  return true;
}

export type JobPageStatus = "active" | "closed" | "unknown";

export interface JobPageInspection {
  status: JobPageStatus;
  reason: string;
  finalUrl?: string;
  httpStatus?: number;
  description?: string;
}

function extractJsonLdJobPosting(html: string): Record<string, unknown> | null {
  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const candidates: unknown[] = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ? parsed["@graph"] : [parsed];
      const jp = candidates.find((c: any) => {
        const type = c?.["@type"];
        return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      });
      if (jp && typeof jp === "object") return jp as Record<string, unknown>;
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return null;
}

function extractMetaDescription(html: string): string {
  const m =
    html.match(/<meta[^>]+(?:property|name)=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:description["']/i) ||
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isErrorOrListingRedirect(original: URL, final: URL): string | null {
  const finalPath = final.pathname.toLowerCase();
  if (/(^|\/)(error|errorpage|error-page|404|not-found|notfound|page-not-found|job-not-found|expired)(\/|$|\.|\?)/.test(finalPath) || /errortype=/i.test(final.search)) {
    return "Redirected to an error page";
  }
  const origSegs = original.pathname.split("/").filter(Boolean);
  const finalSegs = final.pathname.split("/").filter(Boolean);
  if (origSegs.length >= 2 && finalSegs.length <= 1 && original.pathname !== final.pathname) {
    return "Redirected to careers homepage";
  }
  if (original.hostname.includes("greenhouse.io") && original.pathname.includes("/jobs/") && !final.pathname.includes("/jobs/")) {
    return "Greenhouse redirected to board root (job closed)";
  }
  if (original.hostname.includes("lever.co") && origSegs.length >= 2 && finalSegs.length <= 1) {
    return "Lever redirected to board root (job closed)";
  }
  if (original.hostname.includes("ashbyhq.com")) {
    const id = origSegs[origSegs.length - 1];
    if (id && !final.pathname.includes(id)) return "Ashby redirected away from requisition";
  }
  if (/\/(search|jobs|careers)\/?$/i.test(final.pathname) && !/\/(search|jobs|careers)\/?$/i.test(original.pathname)) {
    return "Redirected to a job search/listing page";
  }
  return null;
}

/**
 * Fetches a job posting and classifies it. Network failures/timeouts return "unknown"
 * (callers decide whether unknown is acceptable).
 */
export async function inspectJobPage(url: string, timeoutMs = 7000): Promise<JobPageInspection> {
  if (!isLikelyJobPostingUrl(url)) {
    return { status: "closed", reason: "Link is not a specific job posting (search or listing page)" };
  }

  let res: Response;
  try {
    res = await fetch(url.trim(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
      return { status: "closed", reason: "Career site domain does not resolve" };
    }
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { status: "unknown", reason: isTimeout ? "Career site timed out" : `Could not reach career site (${msg})` };
  }

  const finalUrl = res.url || url;
  if (res.status === 404 || res.status === 410) {
    return { status: "closed", reason: `Posting returned HTTP ${res.status}`, httpStatus: res.status, finalUrl };
  }

  try {
    const redirectIssue = res.redirected ? isErrorOrListingRedirect(new URL(url), new URL(finalUrl)) : null;
    if (redirectIssue) {
      return { status: "closed", reason: redirectIssue, httpStatus: res.status, finalUrl };
    }
  } catch {
    // ignore URL parse issues
  }

  if (res.status >= 400) {
    // 401/403/429/5xx are usually bot protection or transient errors, not proof of closure
    return { status: "unknown", reason: `Career site responded HTTP ${res.status}`, httpStatus: res.status, finalUrl };
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("html")) {
    if (contentType.includes("pdf")) {
      return { status: "closed", reason: "Link is a PDF document, not a job posting", httpStatus: res.status, finalUrl };
    }
    return { status: "unknown", reason: `Unexpected content type ${contentType}`, httpStatus: res.status, finalUrl };
  }

  const html = (await res.text()).slice(0, 600000);
  const jobPosting = extractJsonLdJobPosting(html);

  if (jobPosting) {
    const rawVt = jobPosting.validThrough;
    const validThrough = typeof rawVt === "string" || typeof rawVt === "number" ? new Date(rawVt) : null;
    if (validThrough && !isNaN(validThrough.getTime()) && validThrough.getTime() < Date.now()) {
      return { status: "closed", reason: "Posting's application deadline has passed", httpStatus: res.status, finalUrl };
    }
    const description = typeof jobPosting.description === "string" ? jobPosting.description : "";
    return {
      status: "active",
      reason: "Verified live job posting",
      httpStatus: res.status,
      finalUrl,
      description: description || undefined,
    };
  }

  const text = visibleText(html).slice(0, 80000);
  const marker = CLOSED_MARKERS.find((m) => text.includes(m));
  if (marker) {
    return { status: "closed", reason: `Career site says: "${marker}"`, httpStatus: res.status, finalUrl };
  }

  const meta = extractMetaDescription(html);
  return {
    status: "active",
    reason: "Posting page loaded",
    httpStatus: res.status,
    finalUrl,
    description: meta && meta.length >= MIN_DESCRIPTION_CHARS ? meta : undefined,
  };
}
