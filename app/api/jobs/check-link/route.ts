import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

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
  "requisition has been closed",
  "404 not found",
  "job not found",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const company = searchParams.get("company") || "";
  const title = searchParams.get("title") || "";
  const jobId = searchParams.get("jobId") || "";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  return verifyJobUrl(url, company, title, jobId);
}

export async function POST(request: Request) {
  try {
    const { url, company, title, jobId } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }
    return verifyJobUrl(url, company || "", title || "", jobId || "");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function verifyJobUrl(url: string, company: string, title: string, jobId?: string) {
  const cleanUrl = url.trim();
  const searchFallback = `https://www.google.com/search?q=${encodeURIComponent(`${company} "${title}" careers apply`)}`;
  const linkedInFallback = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${company} ${title}`)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(cleanUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    // 1. Check HTTP 404 / 410 error
    if (res.status === 404 || res.status === 410) {
      handleExpiredJobInBackground(jobId);
      return NextResponse.json({
        ok: false,
        isExpired: true,
        statusCode: res.status,
        reason: `Requisition link returned HTTP ${res.status} (Page Not Found)`,
        directUrl: cleanUrl,
        fallbackUrl: searchFallback,
        linkedInFallback,
      });
    }

    // 2. Check Redirect Mismatch:
    // Many ATS systems (Greenhouse, Lever, etc.) return 200 by redirecting to careers root when a job closes
    if (res.redirected && res.url) {
      try {
        const originalUrlObj = new URL(cleanUrl);
        const finalUrlObj = new URL(res.url);

        // Greenhouse: /jobs/<id> redirected to /careers or /<company> root without /jobs/
        if (
          originalUrlObj.hostname.includes("greenhouse.io") &&
          !finalUrlObj.pathname.includes("/jobs/")
        ) {
          handleExpiredJobInBackground(jobId);
          return NextResponse.json({
            ok: false,
            isExpired: true,
            statusCode: 200,
            reason: "Job posting has closed on Greenhouse and redirected to company careers homepage",
            directUrl: cleanUrl,
            fallbackUrl: searchFallback,
            linkedInFallback,
          });
        }

        // Lever: /<company>/<posting-id> redirected to /<company> root
        if (
          originalUrlObj.hostname.includes("lever.co") &&
          originalUrlObj.pathname !== finalUrlObj.pathname &&
          finalUrlObj.pathname === `/${originalUrlObj.pathname.split("/").filter(Boolean)[0]}`
        ) {
          handleExpiredJobInBackground(jobId);
          return NextResponse.json({
            ok: false,
            isExpired: true,
            statusCode: 200,
            reason: "Job posting has closed on Lever and redirected to company board root",
            directUrl: cleanUrl,
            fallbackUrl: searchFallback,
            linkedInFallback,
          });
        }

        // SmartRecruiters / Ashby / others: redirected away from posting
        if (
          originalUrlObj.pathname.length > 5 &&
          finalUrlObj.pathname.length <= 1 &&
          originalUrlObj.hostname !== finalUrlObj.hostname
        ) {
          handleExpiredJobInBackground(jobId);
          return NextResponse.json({
            ok: false,
            isExpired: true,
            statusCode: 200,
            reason: "Requisition redirected to generic portal homepage",
            directUrl: cleanUrl,
            fallbackUrl: searchFallback,
            linkedInFallback,
          });
        }
      } catch {}
    }

    // 3. Inspect HTML body for closed markers
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const htmlText = (await res.text()).slice(0, 50000).toLowerCase();
      for (const marker of CLOSED_MARKERS) {
        if (htmlText.includes(marker)) {
          handleExpiredJobInBackground(jobId);
          return NextResponse.json({
            ok: false,
            isExpired: true,
            statusCode: res.status,
            reason: `Job listing contains closed notice: "${marker}"`,
            directUrl: cleanUrl,
            fallbackUrl: searchFallback,
            linkedInFallback,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      isExpired: false,
      statusCode: res.status,
      directUrl: cleanUrl,
      fallbackUrl: searchFallback,
      linkedInFallback,
      reason: "Link active and verified",
    });

  } catch (err: any) {
    // If request timed out or network error, don't block user
    return NextResponse.json({
      ok: true,
      isExpired: false,
      statusCode: 0,
      directUrl: cleanUrl,
      fallbackUrl: searchFallback,
      linkedInFallback,
      reason: `Could not verify (${err.name === "AbortError" ? "Timeout" : err.message}), assuming active`,
    });
  }
}

async function handleExpiredJobInBackground(jobId?: string) {
  if (!jobId) return;
  try {
    const supabase = createAdminClient();
    // Delete expired job from scraped_jobs so future searches don't serve it
    await supabase.from("scraped_jobs").delete().eq("id", jobId);
  } catch (e) {
    console.warn("[check-link] Failed to cleanup expired job:", e);
  }
}
