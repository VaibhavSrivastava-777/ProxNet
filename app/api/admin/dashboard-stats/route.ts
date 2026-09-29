import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameCompany } from "@/lib/jobs/job-filters";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: blockedUsers },
      { data: missingEmbeddingsList },
      { data: usersList },
      { count: totalJobs },
      { count: freshJobs },
      { data: latestJobs },
      { count: totalCarpools },
      { data: configs }
    ] = await Promise.all([
      supabase.from("users").select("*", { head: true, count: "exact" }),
      supabase.from("users").select("*", { head: true, count: "exact" }).eq("is_active", true),
      supabase.from("users").select("*", { head: true, count: "exact" }).eq("is_blocked", true),
      supabase.from("users").select("id").is("embedding", null).eq("is_active", true),
      supabase.from("users").select("id, full_name, email, company, job_title, home_lat, home_lng, home_name, office_lat, office_lng, office_name"),
      supabase.from("scraped_jobs").select("*", { head: true, count: "exact" }),
      supabase.from("scraped_jobs").select("*", { head: true, count: "exact" }).gte("created_at", sevenDaysAgo.toISOString()),
      supabase.from("scraped_jobs").select("created_at, posted_at").order("created_at", { ascending: false }).limit(1),
      supabase.from("carpool_posts").select("*", { head: true, count: "exact" }),
      supabase.from("company_ats_config").select("company_name, provider, board_token_or_url, total_jobs_found, last_scraped_at")
    ]);

    const totalUsersCount = totalUsers || 0;
    const activeUsersCount = activeUsers || 0;
    const blockedUsersCount = blockedUsers || 0;
    const missingEmbeddingsCount = missingEmbeddingsList?.length || 0;
    const readyEmbeddingsCount = Math.max(0, activeUsersCount - missingEmbeddingsCount);

    let incompleteProfilesCount = 0;
    let missingGeocodesCount = 0;
    const userCompaniesMap = new Map<string, number>();

    for (const u of (usersList || [])) {
      if (u.company && u.company.trim()) {
        const cleanComp = u.company.trim();
        userCompaniesMap.set(cleanComp, (userCompaniesMap.get(cleanComp) || 0) + 1);
      }
      const isProfileIncomplete = !u.full_name?.trim() || !u.company?.trim() || !u.job_title?.trim() || !u.email?.trim();
      if (isProfileIncomplete) incompleteProfilesCount++;

      const hasHomeCoords = u.home_lat && u.home_lng;
      const hasOfficeCoords = u.office_lat && u.office_lng;
      const homeNeedsGeocode = hasHomeCoords && (!u.home_name || u.home_name.toLowerCase() === "home" || u.home_name.toLowerCase() === "office");
      const officeNeedsGeocode = hasOfficeCoords && (!u.office_name || u.office_name.toLowerCase() === "home" || u.office_name.toLowerCase() === "office");
      if (homeNeedsGeocode || officeNeedsGeocode) missingGeocodesCount++;
    }

    const completeProfilesCount = Math.max(0, totalUsersCount - incompleteProfilesCount);

    const JUNK_COMPANY_TOKENS = new Set([
      "retired",
      "independent advisory practice",
      "ex tcs n tech mahindra , consulting",
      "proxnet",
      "motiveminds consulting pvt ltd",
      "t",
      "x",
      "self employed",
      "freelance",
      "none",
      "n/a",
      "na"
    ]);

    const validConfigs = (configs || []).filter(c => c.provider && c.provider !== "none" && c.provider !== "cron_status");
    const noneConfigs = (configs || []).filter(c => c.provider === "none");
    const noneSet = new Set(noneConfigs.map(c => c.company_name.toLowerCase().trim()));

    const unmappedCompanies: { name: string; userCount: number }[] = [];
    const directHiringCompanies: { name: string; userCount: number }[] = [];
    let mappedNetworkCompanies = 0;

    for (const [compName, count] of userCompaniesMap.entries()) {
      const lower = compName.toLowerCase().trim();
      if (JUNK_COMPANY_TOKENS.has(lower) || lower.length <= 1) {
        continue;
      }

      // 1. Direct or alias match to an active ATS config
      const matched = validConfigs.find(c => isSameCompany(compName, c.company_name));
      if (matched) {
        mappedNetworkCompanies++;
        continue;
      }

      // 2. Evaluated and confirmed to have no public ATS (direct hiring / enterprise portal)
      if (noneSet.has(lower)) {
        directHiringCompanies.push({ name: compName, userCount: count });
        continue;
      }

      // 3. Truly unmapped (new company, never checked)
      unmappedCompanies.push({ name: compName, userCount: count });
    }

    unmappedCompanies.sort((a, b) => b.userCount - a.userCount);
    directHiringCompanies.sort((a, b) => b.userCount - a.userCount);

    const totalNetworkCompanies = mappedNetworkCompanies + directHiringCompanies.length + unmappedCompanies.length;
    const coveredNetworkCompanies = mappedNetworkCompanies + directHiringCompanies.length;

    const embeddingsCoveragePct = activeUsersCount > 0 ? Math.round((readyEmbeddingsCount / activeUsersCount) * 100) : 100;
    const atsCoveragePct = totalNetworkCompanies > 0 ? Math.round((coveredNetworkCompanies / totalNetworkCompanies) * 100) : 100;
    const profileCompletenessPct = totalUsersCount > 0 ? Math.round((completeProfilesCount / totalUsersCount) * 100) : 100;
    const totalJobsCount = totalJobs || 0;
    const freshJobsCount = freshJobs || 0;
    const jobFreshnessPct = totalJobsCount > 0 ? Math.round((freshJobsCount / totalJobsCount) * 100) : 0;

    const latestJobDate = latestJobs?.[0]?.created_at || latestJobs?.[0]?.posted_at || null;

    // Cron status if present
    const cronRow = (configs || []).find(c => c.provider === "cron_status");
    let cronStatus = null;
    if (cronRow) {
      try {
        cronStatus = JSON.parse(cronRow.board_token_or_url);
      } catch (e) {}
    }

    return NextResponse.json({
      // Backward-compatible fields
      users: totalUsersCount,
      jobs: totalJobsCount,
      carpools: totalCarpools || 0,
      ats: {
        total: configs?.length || 0,
        mapped: validConfigs.length,
        unmapped: unmappedCompanies.length,
        directHiring: directHiringCompanies.length
      },
      // Rich Leading Indicators & Action Insights
      summary: {
        totalUsers: totalUsersCount,
        activeUsers: activeUsersCount,
        blockedUsers: blockedUsersCount,
        totalJobs: totalJobsCount,
        freshJobs7d: freshJobsCount,
        totalCarpools: totalCarpools || 0,
        totalNetworkCompanies,
        mappedNetworkCompanies,
        directHiringCompanies: directHiringCompanies.length,
        unmappedNetworkCompanies: unmappedCompanies.length
      },
      leadingIndicators: {
        embeddings: {
          readyCount: readyEmbeddingsCount,
          missingCount: missingEmbeddingsCount,
          coveragePct: embeddingsCoveragePct,
          status: missingEmbeddingsCount === 0 ? "healthy" : missingEmbeddingsCount > 10 ? "critical" : "warning",
          actionTitle: `Generate ${missingEmbeddingsCount} Missing Embeddings`,
          endpoint: "/api/admin/backfill-embeddings",
          method: "POST"
        },
        atsCoverage: {
          totalNetworkCompanies,
          mappedCount: mappedNetworkCompanies,
          directHiringCount: directHiringCompanies.length,
          unmappedCount: unmappedCompanies.length,
          coveragePct: atsCoveragePct,
          status: unmappedCompanies.length === 0 ? "healthy" : unmappedCompanies.length > 10 ? "warning" : "healthy",
          actionTitle: "Auto-Discover & Seed ATS",
          endpoint: "/api/admin/seed-ats",
          method: "POST"
        },
        jobFreshness: {
          totalJobs: totalJobsCount,
          freshJobs7d: freshJobsCount,
          freshPct: jobFreshnessPct,
          latestJobDate,
          status: freshJobsCount > 50 ? "healthy" : "warning",
          actionTitle: "Run 3-Agent Scraper Pipeline",
          endpoint: "/api/admin/scrape-jobs",
          method: "POST"
        },
        profileCompleteness: {
          completeCount: completeProfilesCount,
          incompleteCount: incompleteProfilesCount,
          completenessPct: profileCompletenessPct,
          status: incompleteProfilesCount === 0 ? "healthy" : incompleteProfilesCount > 20 ? "warning" : "healthy",
          actionTitle: `Send Reminders to ${incompleteProfilesCount} Users`,
          endpoint: "/api/admin/remind-profiles",
          method: "POST"
        },
        geocoding: {
          missingCount: missingGeocodesCount,
          status: missingGeocodesCount === 0 ? "healthy" : "warning",
          actionTitle: `Backfill ${missingGeocodesCount} Locality Names`,
          endpoint: "/api/admin/backfill-locations",
          method: "GET"
        }
      },
      unmappedCompanies,
      directHiringCompanies,
      cronStatus
    });
  } catch (err: any) {
    console.error("Failed to fetch dashboard stats:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
