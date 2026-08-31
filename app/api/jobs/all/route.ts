import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

function cleanUrlAndTitle(rawTitle: string, rawUrl: string) {
  let cleanUrl = (rawUrl || "").replace(/&amp;/g, "&").trim();
  let title = (rawTitle || "").trim();

  // If title is generic ("Job Opportunity", "Job Opening", or empty), extract from URL slug
  if (!title || title.toLowerCase() === "job opportunity" || title.toLowerCase() === "job opening") {
    try {
      const parsed = new URL(cleanUrl);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const jobIndex = parts.findIndex(p => p.toLowerCase() === "job");
      if (jobIndex !== -1 && parts[jobIndex + 1]) {
        const slug = decodeURIComponent(parts[jobIndex + 1]);
        const cleanedSlug = slug
          .replace(/-(IND|USA|CAN|GBR|AUS|SGP|DEU|FRA|NLD|IND|KA|MH|DL|TG|TN|AP)-\d+.*$/i, "")
          .replace(/-\d{5,8}.*$/, "");
        
        const slugParts = cleanedSlug.split("-");
        if (slugParts.length > 1) {
          title = slugParts.slice(1).join(" ").replace(/_/g, " ").trim();
        } else {
          title = cleanedSlug.replace(/_/g, " ").trim();
        }
      }
    } catch (e) {}
  }

  return { title: title || "Job Opening", url: cleanUrl };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();

    // 1. Fetch scraped jobs from the last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: scrapedJobs, error: jobsError } = await supabase
      .from("scraped_jobs")
      .select("id, company, title, location, url, description, posted_at, keywords")
      .gte("posted_at", sixtyDaysAgo.toISOString())
      .order("posted_at", { ascending: false })
      .limit(3000);

    if (jobsError) {
      console.error("[/api/jobs/all] jobsError:", jobsError);
      return NextResponse.json({ error: jobsError.message }, { status: 500 });
    }

    // 2. Fetch all active users with companies for referral matching
    const { data: usersData } = await supabase
      .from("users")
      .select("id, company, job_title")
      .eq("is_blocked", false)
      .not("company", "is", null);

    const { data: followsData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const followedSet = new Set(followsData?.map(f => f.following_id) || []);

    // Map users who can refer by company name
    const companyReferrers = new Map<string, Array<{ id: string; alias: string; is_followed: boolean }>>();
    for (const u of usersData || []) {
      if (u.company && u.company.trim() && u.id !== user.id) {
        const cKey = u.company.trim().toLowerCase();
        if (!companyReferrers.has(cKey)) {
          companyReferrers.set(cKey, []);
        }
        companyReferrers.get(cKey)!.push({
          id: u.id,
          alias: u.job_title ? `${u.job_title} @ ${u.company}` : `Professional @ ${u.company}`,
          is_followed: followedSet.has(u.id),
        });
      }
    }

    // 3. Segment all jobs by company name
    const companiesMap = new Map<string, {
      company: string;
      contactsCount: number;
      referralContacts: Array<{ id: string; alias: string; is_followed: boolean }>;
      jobs: Array<{
        id: string;
        title: string;
        location: string;
        url: string;
        description: string;
        posted_at: string;
        keywords: string[];
      }>;
    }>();

    for (const job of scrapedJobs || []) {
      const rawCompany = (job.company || "Hiring Company").trim();
      if (!rawCompany) continue;
      const compKey = rawCompany.toLowerCase();

      if (!companiesMap.has(compKey)) {
        const referrers = companyReferrers.get(compKey) || [];
        companiesMap.set(compKey, {
          company: rawCompany,
          contactsCount: referrers.length,
          referralContacts: referrers,
          jobs: [],
        });
      }

      const compData = companiesMap.get(compKey)!;
      if (!compData.jobs.some(j => j.id === job.id)) {
        const { title: formattedTitle, url: formattedUrl } = cleanUrlAndTitle(job.title, job.url);

        compData.jobs.push({
          id: job.id,
          title: formattedTitle,
          location: job.location || "Remote / India",
          url: formattedUrl,
          description: job.description || "",
          posted_at: job.posted_at || new Date().toISOString(),
          keywords: job.keywords || [],
        });
      }
    }

    // Sort jobs within each company by posted_at descending (newest first)
    for (const comp of companiesMap.values()) {
      comp.jobs.sort((a, b) => {
        const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
        return dateB - dateA;
      });
    }

    // Convert map to array and sort by total job count (descending)
    const companiesArray = Array.from(companiesMap.values()).sort((a, b) => b.jobs.length - a.jobs.length);

    return NextResponse.json({
      success: true,
      totalCompanies: companiesArray.length,
      totalJobs: scrapedJobs?.length || 0,
      companies: companiesArray,
    });
  } catch (err: any) {
    console.error("[/api/jobs/all] unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
