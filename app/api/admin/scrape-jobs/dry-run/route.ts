import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScraper } from "@/lib/scrapers/registry";

export const maxDuration = 120; // 2 minutes

export async function POST(request: Request) {
  const isAdmin = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { companyName } = await request.json();
    if (!companyName) {
      return NextResponse.json({ error: "Missing companyName in request body" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: config } = await supabase
      .from("company_ats_config")
      .select("*")
      .ilike("company_name", companyName)
      .single();

    const scraper = getScraper(companyName, config || undefined);
    if (!scraper) {
      return NextResponse.json({ 
        error: `No scraping strategy registered for "${companyName}". Please configure the ATS mapping first.` 
      }, { status: 404 });
    }

    console.log(`[Dry Run] Triggering scraper for ${companyName}...`);
    // Fetch 2 jobs max
    const jobs = await scraper.scrape(2);
    
    return NextResponse.json({
      success: true,
      companyName,
      jobsCount: jobs.length,
      jobs
    });
  } catch (e: any) {
    console.error(`[Dry Run Error] Failed to dry run scraping:`, e);
    return NextResponse.json({ 
      error: `Scraping dry-run failed: ${e.message || e}` 
    }, { status: 500 });
  }
}
