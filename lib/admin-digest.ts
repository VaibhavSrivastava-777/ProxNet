import { SupabaseClient } from "@supabase/supabase-js";
import { isValidEnterprise, normalizeCompanyName } from "./competitors/discover-competitors";

export interface DailyDigestReport {
  dateStr: string; // e.g., "Tuesday, Sep 22, 2026"
  period: {
    startIstIso: string;
    endIstIso: string;
    startUtcIso: string;
    endUtcIso: string;
  };
  companyMetrics: {
    totalNetworkCompanies: number;
    totalCompetitorCompanies: number;
    totalConfiguredAts: number;
    totalCompaniesWithJobs: number;
    incrementalNetworkCompanies: number;
    incrementalCompetitors: number;
    newCompanyNames: string[];
  };
  goodIndicators: {
    newSignupsCount: number;
    newSignups: Array<{ name: string; title: string; company: string; wallet: number }>;
    pioneerBountiesCount: number;
    pioneerCompanies: string[];
    referralThreadsCount: number;
    referralThreads: Array<{ threadId: string; role: string; company: string; createdAt: string }>;
    referralMessagesCount: number;
    jobsScrapedYesterday: number;
    topJobCompanies: Array<{ company: string; count: number }>;
    notificationsDelivered: number;
  };
  badIndicators: {
    scraperErrorsCount: number;
    failedCompanies: Array<{ company: string; provider: string; notes: string }>;
    uncoveredDemandCount: number;
    uncoveredCompanies: Array<{ company: string; seekersCount: number }>;
    stalledThreadsCount: number;
    stalledThreads: Array<{ threadId: string; company: string; role: string; waitingHours: number }>;
    incompleteSignupsCount: number;
    incompleteUsers: Array<{ name: string; missing: string[] }>;
    blockedUsersCount: number;
  };
}

/**
 * Calculates start and end timestamps for the previous calendar day in IST (UTC+05:30)
 */
export function getPreviousDayIstBounds(referenceDate = new Date()): {
  dateStr: string;
  startIstIso: string;
  endIstIso: string;
  startUtcIso: string;
  endUtcIso: string;
} {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(referenceDate.getTime() + istOffsetMs);

  // Yesterday in IST
  const yesterdayIst = new Date(nowIst);
  yesterdayIst.setUTCDate(yesterdayIst.getUTCDate() - 1);

  const yYear = yesterdayIst.getUTCFullYear();
  const yMonth = yesterdayIst.getUTCMonth();
  const yDate = yesterdayIst.getUTCDate();

  // 00:00:00.000 IST
  const startUtc = new Date(Date.UTC(yYear, yMonth, yDate, 0, 0, 0, 0) - istOffsetMs);
  // 23:59:59.999 IST
  const endUtc = new Date(Date.UTC(yYear, yMonth, yDate, 23, 59, 59, 999) - istOffsetMs);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dateStr = `${dayNames[yesterdayIst.getUTCDay()]}, ${monthNames[yMonth]} ${yDate}, ${yYear}`;

  return {
    dateStr,
    startIstIso: new Date(Date.UTC(yYear, yMonth, yDate, 0, 0, 0, 0)).toISOString().replace("Z", "+05:30"),
    endIstIso: new Date(Date.UTC(yYear, yMonth, yDate, 23, 59, 59, 999)).toISOString().replace("Z", "+05:30"),
    startUtcIso: startUtc.toISOString(),
    endUtcIso: endUtc.toISOString(),
  };
}

/**
 * Gathers and aggregates all metrics for the previous day
 */
export async function generateDailyAdminDigestData(
  supabase: SupabaseClient,
  referenceDate = new Date()
): Promise<DailyDigestReport> {
  const bounds = getPreviousDayIstBounds(referenceDate);
  const { startUtcIso, endUtcIso } = bounds;

  // 1. COMPANY METRICS
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, wallet, home_lat, created_at, is_blocked, profile_digest")
    .eq("is_active", true);

  const activeUsers = allUsers || [];
  const networkCompaniesMap = new Map<string, string>();
  const usersBeforeYesterday = activeUsers.filter((u) => u.created_at < startUtcIso);
  const priorCompanyKeys = new Set(
    usersBeforeYesterday
      .map((u) => normalizeCompanyName(u.company || ""))
      .filter((c) => isValidEnterprise(c))
  );

  const newCompanyNames: string[] = [];
  for (const u of activeUsers) {
    const raw = u.company?.trim();
    if (raw && isValidEnterprise(raw)) {
      const key = normalizeCompanyName(raw);
      if (!networkCompaniesMap.has(key)) {
        networkCompaniesMap.set(key, raw);
      }
    }
  }

  // 2. ATS CONFIGS & COMPETITORS
  const { data: atsConfigs } = await supabase.from("company_ats_config").select("*");
  const configs = atsConfigs || [];

  let totalCompetitors = 0;
  let incrementalCompetitors = 0;
  const failedCompanies: Array<{ company: string; provider: string; notes: string }> = [];

  for (const c of configs) {
    const notesStr = c.scrape_notes || "";
    const isCompetitor = notesStr.includes('"is_competitor"') || notesStr.includes("competitor");
    if (isCompetitor) {
      totalCompetitors++;
      if (c.created_at >= startUtcIso && c.created_at <= endUtcIso) {
        incrementalCompetitors++;
      }
    }

    if (
      notesStr.toLowerCase().includes("fail") ||
      notesStr.toLowerCase().includes("error") ||
      c.provider === "error"
    ) {
      failedCompanies.push({
        company: c.company_name,
        provider: c.provider,
        notes: notesStr.slice(0, 100),
      });
    }
  }

  // Check new signups yesterday
  const signupsYesterday = activeUsers.filter(
    (u) => u.created_at >= startUtcIso && u.created_at <= endUtcIso
  );

  for (const u of signupsYesterday) {
    const key = normalizeCompanyName(u.company || "");
    if (key && isValidEnterprise(key) && !priorCompanyKeys.has(key)) {
      newCompanyNames.push(u.company.trim());
      priorCompanyKeys.add(key); // avoid double counting if multiple signups from same new company
    }
  }

  // 3. JOBS INGESTION
  const { data: scrapedJobsYesterday } = await supabase
    .from("scraped_jobs")
    .select("company, created_at")
    .gte("created_at", startUtcIso)
    .lte("created_at", endUtcIso);

  const jobsList = scrapedJobsYesterday || [];
  const jobsCountByCompany: Record<string, number> = {};
  for (const j of jobsList) {
    if (j.company) {
      jobsCountByCompany[j.company] = (jobsCountByCompany[j.company] || 0) + 1;
    }
  }

  const topJobCompanies = Object.entries(jobsCountByCompany)
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const { data: allJobsDistinct } = await supabase.from("scraped_jobs").select("company");
  const totalCompaniesWithJobs = new Set(
    (allJobsDistinct || []).map((j) => normalizeCompanyName(j.company || "")).filter(Boolean)
  ).size;

  // 4. REFERRALS & CHATS
  const { data: threadsYesterday } = await supabase
    .from("job_threads")
    .select("id, post_id, created_at, status")
    .gte("created_at", startUtcIso)
    .lte("created_at", endUtcIso);

  const { data: messagesYesterday } = await supabase
    .from("job_messages")
    .select("id, created_at")
    .gte("created_at", startUtcIso)
    .lte("created_at", endUtcIso);

  // Fetch details for threads yesterday
  const referralThreadsList: Array<{ threadId: string; role: string; company: string; createdAt: string }> = [];
  for (const t of threadsYesterday || []) {
    let companyName = "Unknown";
    let roleName = "Referral Request";
    if (t.post_id) {
      const { data: post } = await supabase
        .from("job_posts")
        .select("company, role")
        .eq("id", t.post_id)
        .maybeSingle();
      if (post) {
        companyName = post.company || "Unknown";
        roleName = post.role || "Referral Request";
      }
    }
    referralThreadsList.push({
      threadId: t.id,
      company: companyName,
      role: roleName,
      createdAt: t.created_at,
    });
  }

  // 5. STALLED REFERRAL THREADS (Candidate messaged > 24 hours ago, no response from referrer)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: olderActiveThreads } = await supabase
    .from("job_threads")
    .select("id, post_id, created_at")
    .eq("status", "active")
    .lte("created_at", twentyFourHoursAgo)
    .limit(20);

  const stalledThreads: Array<{ threadId: string; company: string; role: string; waitingHours: number }> = [];
  for (const ot of olderActiveThreads || []) {
    const { data: msgs } = await supabase
      .from("job_messages")
      .select("sender_id, created_at")
      .eq("thread_id", ot.id)
      .order("created_at", { ascending: true });

    // Stalled if only 1 message sent ever (initial pitch)
    if (msgs && msgs.length === 1) {
      const hoursWaiting = Math.round(
        (Date.now() - new Date(msgs[0].created_at).getTime()) / (1000 * 60 * 60)
      );
      let comp = "Company";
      let r = "Role";
      if (ot.post_id) {
        const { data: p } = await supabase
          .from("job_posts")
          .select("company, role")
          .eq("id", ot.post_id)
          .maybeSingle();
        if (p) {
          comp = p.company || comp;
          r = p.role || r;
        }
      }
      stalledThreads.push({
        threadId: ot.id,
        company: comp,
        role: r,
        waitingHours: hoursWaiting,
      });
    }
  }

  // 6. UNCOVERED REFERRAL DEMAND
  // Companies where users seek jobs or target companies, but ProxNet has 0 verified professionals
  const { data: seekerPosts } = await supabase
    .from("job_posts")
    .select("company")
    .eq("type", "seeker")
    .eq("status", "active");

  const seekerCompanyCounts: Record<string, number> = {};
  for (const sp of seekerPosts || []) {
    const cleanComp = sp.company?.trim();
    if (cleanComp && isValidEnterprise(cleanComp)) {
      const key = normalizeCompanyName(cleanComp);
      // Check if any active user works here
      if (!networkCompaniesMap.has(key)) {
        seekerCompanyCounts[cleanComp] = (seekerCompanyCounts[cleanComp] || 0) + 1;
      }
    }
  }

  const uncoveredCompanies = Object.entries(seekerCompanyCounts).map(([company, count]) => ({
    company,
    seekersCount: count,
  }));

  // 7. INCOMPLETE SIGNUPS YESTERDAY
  const incompleteUsers: Array<{ name: string; missing: string[] }> = [];
  for (const u of signupsYesterday) {
    const missing: string[] = [];
    if (!u.company?.trim()) missing.push("Company");
    if (!u.job_title?.trim()) missing.push("Job Title");
    if (!u.home_lat) missing.push("Location");
    if (missing.length > 0) {
      incompleteUsers.push({
        name: u.full_name || "Unnamed Member",
        missing,
      });
    }
  }

  // 8. NOTIFICATIONS DELIVERED
  const { count: notifCount } = await supabase
    .from("in_app_notifications")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startUtcIso)
    .lte("created_at", endUtcIso);

  // 9. BLOCKED USERS
  const blockedUsersCount = activeUsers.filter((u) => u.is_blocked).length;

  return {
    dateStr: bounds.dateStr,
    period: bounds,
    companyMetrics: {
      totalNetworkCompanies: networkCompaniesMap.size,
      totalCompetitorCompanies: totalCompetitors,
      totalConfiguredAts: configs.length,
      totalCompaniesWithJobs,
      incrementalNetworkCompanies: newCompanyNames.length,
      incrementalCompetitors,
      newCompanyNames,
    },
    goodIndicators: {
      newSignupsCount: signupsYesterday.length,
      newSignups: signupsYesterday.map((u) => ({
        name: u.full_name || "Member",
        title: u.job_title || "Professional",
        company: u.company || "Company not specified",
        wallet: u.wallet || 0,
      })),
      pioneerBountiesCount: newCompanyNames.length,
      pioneerCompanies: newCompanyNames,
      referralThreadsCount: threadsYesterday?.length || 0,
      referralThreads: referralThreadsList,
      referralMessagesCount: messagesYesterday?.length || 0,
      jobsScrapedYesterday: jobsList.length,
      topJobCompanies,
      notificationsDelivered: notifCount || 0,
    },
    badIndicators: {
      scraperErrorsCount: failedCompanies.length,
      failedCompanies: failedCompanies.slice(0, 8),
      uncoveredDemandCount: uncoveredCompanies.length,
      uncoveredCompanies: uncoveredCompanies.slice(0, 5),
      stalledThreadsCount: stalledThreads.length,
      stalledThreads: stalledThreads.slice(0, 5),
      incompleteSignupsCount: incompleteUsers.length,
      incompleteUsers,
      blockedUsersCount,
    },
  };
}
