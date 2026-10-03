/**
 * Real-time URL Validator for Scraped & ATS Job Postings
 *
 * Verifies if a job URL is live and accepting applications.
 * Delegates to inspectJobPage (lib/jobs/job-quality.ts), which detects:
 * 1. Non-posting URLs (search/listing/landing pages, PDFs)
 * 2. HTTP 404 / 410 status codes
 * 3. Closed requisition redirects (board roots, error pages, search pages)
 * 4. In-page closed markers ("no longer available", "position filled", "invalid opportunity")
 * 5. Expired JSON-LD JobPosting (validThrough in the past)
 */

import { inspectJobPage } from "@/lib/jobs/job-quality";

/**
 * Strict check: only a positively verified "active" posting counts as live.
 * Timeouts / unreachable sites are treated as not live.
 */
export async function verifyJobUrlLive(
  url: string,
  timeoutMs = 3000
): Promise<{ live: boolean; reason?: string }> {
  if (!url || !url.startsWith("http")) {
    return { live: false, reason: "Invalid or empty URL" };
  }
  const inspection = await inspectJobPage(url, timeoutMs);
  return { live: inspection.status === "active", reason: inspection.reason };
}
