import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const radius = parseFloat(searchParams.get("radius") || "1000");
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

  const supabase = createAdminClient();

  // 1. Get ALL active users with a company
  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, company, job_title")
    .eq("is_blocked", false)
    .not("company", "is", null);

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

  // 2. Group referrars by company
  const companiesMap = new Map<string, {
    company: string;
    referrarCount: number;
    jobCount: number;
    referrars: any[];
    jobs: any[];
  }>();

  usersData.forEach((u: any) => {
    const rawCompany = u.company.trim();
    const compKey = rawCompany.toLowerCase();
    
    if (!companiesMap.has(compKey)) {
      companiesMap.set(compKey, {
        company: rawCompany,
        referrarCount: 0,
        jobCount: 0,
        referrars: [],
        jobs: []
      });
    }

    const compData = companiesMap.get(compKey)!;
    compData.referrarCount += 1;
    compData.referrars.push({
      id: u.id,
      alias: u.job_title ? `${u.job_title} @ ${rawCompany}` : `Professional @ ${rawCompany}`
    });
  });

  const activeCompanyKeys = Array.from(companiesMap.keys());

  // 3. Fetch scraped jobs and group by company
  const { data: scrapedJobs, error: scrapedError } = await supabase
    .from("scraped_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (scrapedError) return NextResponse.json({ error: scrapedError.message }, { status: 500 });

  (scrapedJobs || []).forEach((job: any) => {
    // The previous bug was checking job.company_name, but the column is job.company
    const jobCompName = job.company || job.company_name;
    if (!jobCompName) return;

    const compKey = jobCompName.trim().toLowerCase();
    
    // Only map jobs to active companies
    if (activeCompanyKeys.includes(compKey)) {
      const compData = companiesMap.get(compKey)!;
      compData.jobCount += 1;
      compData.jobs.push({
        id: job.id,
        role: job.title || job.role || "Job Opening",
        company: compData.company,
        skills: job.keywords || job.location || "",
        created_at: job.created_at || job.posted_at || new Date().toISOString(),
        url: job.url,
        description: job.description || "",
      });
    }
  });

  // Convert map to array and sort by jobCount (desc), then referrarCount (desc)
  const companiesArray = Array.from(companiesMap.values()).sort((a, b) => {
    if (b.jobCount !== a.jobCount) return b.jobCount - a.jobCount;
    return b.referrarCount - a.referrarCount;
  });

  return NextResponse.json({ 
    companies: companiesArray,
    currentUserId: user.id
  });
}
