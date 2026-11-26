import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanJobTitle, isIndiaLocation } from "@/lib/jobs/job-filters";
import { isLikelyJobPostingUrl } from "@/lib/jobs/job-quality";
import { detectCandidateDiscipline } from "@/lib/jobs/discipline";
import { extractCandidateSkills } from "@/lib/jobs/skill-matching";

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
        if (job.url && !isLikelyJobPostingUrl(job.url)) continue;
        if (!isIndiaLocation(job.location, job.description, job.title)) continue;
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

    // Filter out companies with 0 eligible India jobs and sort by total job count (descending)
    const activeCompanies = Array.from(companiesMap.values()).filter(c => c.jobs.length > 0 || c.contactsCount > 0);
    cachedCompaniesList = activeCompanies.sort((a, b) => b.jobs.length - a.jobs.length);
    cachedTotalJobsCount = activeCompanies.reduce((acc, c) => acc + c.jobs.length, 0);
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

    // 2. Concurrently fetch lightweight user profile, follows, and tracked/applied applications for this user
    const [userProfileRes, followsRes, userAppsRes] = await Promise.all([
      supabase
        .from("users")
        .select("job_title, resume_text, resume_url, wallet, company, invite_code, profile_digest, about, professional_bio")
        .eq("id", user.id)
        .single(),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("job_applications")
        .select("job_id, company, job_title, job_url, stage")
        .eq("user_id", user.id),
    ]);

    const userProfile = userProfileRes.data;
    const userDiscipline = userProfile ? detectCandidateDiscipline(userProfile) : "operations_general";
    const userSkills = userProfile ? Array.from(extractCandidateSkills(userProfile)) : [];
    const followedSet = new Set(followsRes.data?.map(f => f.following_id) || []);

    // Build sets of opportunities whose status has been changed / tracked by this user
    const userApps = userAppsRes.data || [];
    const appliedJobIds = new Set<string>();
    const appliedUrls = new Set<string>();
    const appliedCompanyTitleKeys = new Set<string>();

    for (const app of userApps) {
      if (app.job_id) appliedJobIds.add(app.job_id);
      if (app.job_url) appliedUrls.add(app.job_url.trim().toLowerCase());
      if (app.company && app.job_title) {
        appliedCompanyTitleKeys.add(`${app.company.trim().toLowerCase()}:::${app.job_title.trim().toLowerCase()}`);
      }
    }

    // 3. Personalize followed status on referral contacts & exclude opportunities this user has moved to Applied / tracker
    const baseList = cachedCompaniesList || [];
    const personalizedCompanies = baseList
      .map(comp => {
        const filteredReferrers = comp.referralContacts.filter(r => r.id !== user.id);
        const compLower = comp.company.trim().toLowerCase();

        // Omit any opportunities this user has moved to Applied / changed status for
        const unappliedJobs = comp.jobs.filter(j => {
          if (j.id && appliedJobIds.has(j.id)) return false;
          if (j.url && appliedUrls.has(j.url.trim().toLowerCase())) return false;
          const tcKey = `${compLower}:::${(j.title || "").trim().toLowerCase()}`;
          if (appliedCompanyTitleKeys.has(tcKey)) return false;
          return true;
        });

        return {
          company: comp.company,
          contactsCount: filteredReferrers.length,
          referralContacts: filteredReferrers.map(rc => ({
            id: rc.id,
            alias: rc.alias,
            is_followed: followedSet.has(rc.id),
          })),
          jobs: unappliedJobs,
        };
      })
      .filter(comp => comp.jobs.length > 0 || comp.contactsCount > 0);

    const totalAvailableJobs = personalizedCompanies.reduce((acc, c) => acc + c.jobs.length, 0);

    return NextResponse.json({
      success: true,
      hasResume: Boolean(userProfile?.resume_text && userProfile.resume_text.trim().length > 50),
      resumeUrl: userProfile?.resume_url || null,
      wallet: userProfile?.wallet ?? 0,
      inviteCode: userProfile?.invite_code || null,
      currentUserId: user.id,
      currentUserCompany: userProfile?.company || null,
      userJobTitle: userProfile?.job_title || null,
      userDiscipline,
      userSkills,
      totalCompanies: personalizedCompanies.length,
      totalJobs: totalAvailableJobs,
      appliedSignatures: [
        ...Array.from(appliedJobIds).map(id => `id:${id}`),
        ...Array.from(appliedUrls).map(u => `url:${u}`),
        ...Array.from(appliedCompanyTitleKeys).map(k => `tc:${k}`),
      ],
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
