/**
 * Real-time URL Validator for Scraped & ATS Job Postings
 *
 * Verifies if a job URL is live and accepting applications.
 * Detects:
 * 1. HTTP 404 / 410 status codes
 * 2. Closed requisition redirects (e.g. Greenhouse/Lever redirecting to board root)
 * 3. In-page closed markers ("no longer available", "position filled", "page not found")
 */

const CLOSED_MARKERS = [
  "no longer available",
  "position has been filled",
  "job is closed",
  "page not found",
  "no longer accepting applications",
  "this job is no longer active",
  "unable to find the page",
  "job post not found",
  "position is closed",
  "404 not found",
  "this posting is closed",
  "this role has been closed",
];

export async function verifyJobUrlLive(
  url: string,
  timeoutMs = 3000
): Promise<{ live: boolean; reason?: string }> {
  if (!url || !url.startsWith("http")) {
    return { live: false, reason: "Invalid or empty URL" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timer);

    // 1. Direct dead status code check (404, 410, 500)
    if (res.status === 404 || res.status === 410) {
      return { live: false, reason: `HTTP ${res.status} Not Found` };
    }

    if (res.status >= 500) {
      return { live: false, reason: `HTTP ${res.status} Server Error` };
    }

    // 2. Redirect checks for closed job boards
    if (res.redirected && res.url) {
      try {
        const origUrl = new URL(url);
        const finalUrl = new URL(res.url);

        // Greenhouse: redirects from /jobs/:id to board root /:company when closed
        if (
          origUrl.hostname.includes("greenhouse.io") &&
          origUrl.pathname.includes("/jobs/") &&
          !finalUrl.pathname.includes("/jobs/")
        ) {
          return { live: false, reason: "Redirected to Greenhouse company board (job closed)" };
        }

        // Lever: redirects from /:company/:id to /:company when closed
        if (
          origUrl.hostname.includes("lever.co") &&
          origUrl.pathname !== finalUrl.pathname &&
          finalUrl.pathname === `/${origUrl.pathname.split("/")[1]}`
        ) {
          return { live: false, reason: "Redirected to Lever company root (job closed)" };
        }

        // Ashby: redirects from /:company/:id to /:company
        if (
          origUrl.hostname.includes("ashbyhq.com") &&
          origUrl.pathname !== finalUrl.pathname &&
          !finalUrl.pathname.includes(origUrl.pathname.split("/").pop() || "---")
        ) {
          return { live: false, reason: "Redirected away from Ashby requisition" };
        }
      } catch {
        // ignore URL parsing error
      }
    }

    // 3. HTML body closed markers inspection
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const htmlText = (await res.text()).slice(0, 15000).toLowerCase();
      for (const marker of CLOSED_MARKERS) {
        if (htmlText.includes(marker)) {
          return { live: false, reason: `Found closed marker: "${marker}"` };
        }
      }
    }

    return { live: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { live: false, reason: "URL probe timed out (unreachable)" };
    }
    // Network errors (DNS failure, domain dead)
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return { live: false, reason: `Network failure: ${msg}` };
    }
    return { live: false, reason: `Probe failed: ${msg}` };
  }
}

