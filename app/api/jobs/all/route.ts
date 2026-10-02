import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanJobTitle } from "@/lib/jobs/job-filters";

function cleanUrlAndTitle(rawTitle: string, rawUrl: string) {
  const cleanUrl = (rawUrl || "").replace(/&amp;/g, "&").trim();
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
    } catch {
      // ignore parsing error
    }
  }

  return { title: cleanJobTitle(title || "Job Opening"), url: cleanUrl };
}

// Global in-memory cache for base grouped companies across all users
interface CachedBaseCompany {
  company: string;
  contactsCount: number;
  referralContacts: Array<{ id: string; alias: string }>;
  jobs: Array<{
    id: string;
    title: string;
    location: string;
    url: string;
    description: string;
    posted_at: string;
    keywords: string[];
  }>;
}

let cachedCompaniesList: CachedBaseCompany[] | null = null;
let cachedTotalJobsCount = 0;
let lastCacheTime = 0;
let isRefreshingCache = false;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes server TTL

async function refreshCompaniesCache(supabase: any) {
  if (isRefreshingCache && cachedCompaniesList) return;
  isRefreshingCache = true;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysIso = thirtyDaysAgo.toISOString();

    // 1. Fetch all 7k scraped jobs in parallel batches + company users concurrently
    const batchRanges = [
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
      [5000, 5999],
      [6000, 6999],
    ];

    const [
      b0, b1, b2, b3, b4, b5, b6,
      usersRes
    ] = await Promise.all([
      ...batchRanges.map(([start, end]) =>
        supabase
          .from("scraped_jobs")
          .select("id, company, title, location, url, description, posted_at, keywords")
          .gte("posted_at", thirtyDaysIso)
          .order("posted_at", { ascending: false })
          .range(start, end)
      ),
      supabase
        .from("users")
        .select("id, company, job_title")
        .eq("is_blocked", false)
        .not("company", "is", null),
    ]);

    const allJobs: any[] = [
      ...(b0.data || []),
      ...(b1.data || []),
      ...(b2.data || []),
      ...(b3.data || []),
      ...(b4.data || []),
      ...(b5.data || []),
      ...(b6.data || []),
    ];

    cachedTotalJobsCount = allJobs.length;

    // 2. Map users who can refer by company name
    const companyReferrers = new Map<string, Array<{ id: string; alias: string }>>();
    for (const u of usersRes.data || []) {
      if (u.company && u.company.trim()) {
        const cKey = u.company.trim().toLowerCase();
        if (!companyReferrers.has(cKey)) {
          companyReferrers.set(cKey, []);
        }
        companyReferrers.get(cKey)!.push({
          id: u.id,
          alias: u.job_title ? `${u.job_title} @ ${u.company}` : `Professional @ ${u.company}`,
        });
      }
    }

    // 3. Segment all jobs by company name
    const companiesMap = new Map<string, CachedBaseCompany>();

    for (const job of allJobs) {
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

    // Sort companies by total job count (descending)
    cachedCompaniesList = Array.from(companiesMap.values()).sort((a, b) => b.jobs.length - a.jobs.length);
    lastCacheTime = Date.now();
  } catch (err) {
    console.error("[/api/jobs/all] Error refreshing cache:", err);
  } finally {
    isRefreshingCache = false;
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();

    // 1. Refresh or fetch cache if empty / expired
    const isCacheExpired = !cachedCompaniesList || (Date.now() - lastCacheTime > CACHE_TTL_MS);
    if (isCacheExpired) {
      await refreshCompaniesCache(supabase);
    }

    // 2. Concurrently fetch lightweight user profile & follows for personalized referral flags
    const [userProfileRes, followsRes] = await Promise.all([
      supabase
        .from("users")
        .select("resume_text, resume_url, wallet, company, invite_code")
        .eq("id", user.id)
        .single(),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id),
    ]);

    const userProfile = userProfileRes.data;
    const followedSet = new Set(followsRes.data?.map(f => f.following_id) || []);

    // 3. Personalize followed status on referral contacts (instant memory map)
    const baseList = cachedCompaniesList || [];
    const personalizedCompanies = baseList.map(comp => {
      const filteredReferrers = comp.referralContacts.filter(r => r.id !== user.id);
      return {
        company: comp.company,
        contactsCount: filteredReferrers.length,
        referralContacts: filteredReferrers.map(rc => ({
          id: rc.id,
          alias: rc.alias,
          is_followed: followedSet.has(rc.id),
        })),
        jobs: comp.jobs,
      };
    });

    return NextResponse.json({
      success: true,
      hasResume: Boolean(userProfile?.resume_text && userProfile.resume_text.trim().length > 50),
      resumeUrl: userProfile?.resume_url || null,
      wallet: userProfile?.wallet ?? 0,
      inviteCode: userProfile?.invite_code || null,
      currentUserId: user.id,
      currentUserCompany: userProfile?.company || null,
      totalCompanies: personalizedCompanies.length,
      totalJobs: cachedTotalJobsCount,
      companies: personalizedCompanies,
    }, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (err: unknown) {
    console.error("[/api/jobs/all] unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
