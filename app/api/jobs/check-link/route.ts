import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectJobPage } from "@/lib/jobs/job-quality";

export const maxDuration = 30;

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
    const inspection = await inspectJobPage(cleanUrl, 7000);

    if (inspection.status === "closed") {
      handleExpiredJobInBackground(jobId);
      return NextResponse.json({
        ok: false,
        isExpired: true,
        statusCode: inspection.httpStatus || 404,
        reason: inspection.reason,
        directUrl: inspection.finalUrl || cleanUrl,
        fallbackUrl: searchFallback,
        linkedInFallback,
      });
    }

    // If live description was extracted and jobId provided, save to DB in background
    if (inspection.description && jobId) {
      (async () => {
        try {
          const supabase = createAdminClient();
          await supabase
            .from("scraped_jobs")
            .update({ description: inspection.description })
            .eq("id", jobId);
        } catch {}
      })();
    }

    return NextResponse.json({
      ok: true,
      isExpired: false,
      statusCode: inspection.httpStatus || 200,
      directUrl: inspection.finalUrl || cleanUrl,
      fallbackUrl: searchFallback,
      linkedInFallback,
      reason: inspection.reason,
      description: inspection.description,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: true,
      isExpired: false,
      statusCode: 0,
      directUrl: cleanUrl,
      fallbackUrl: searchFallback,
      linkedInFallback,
      reason: `Could not verify (${err.message}), assuming active`,
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
