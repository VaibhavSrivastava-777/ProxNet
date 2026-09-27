import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const validConfigs = (configs || []).filter(c => c.provider && c.provider !== "none" && c.provider !== "cron_status");
    const configuredCompaniesSet = new Set(validConfigs.map(c => c.company_name.toLowerCase().trim()));

    const unmappedCompanies: { name: string; userCount: number }[] = [];
    for (const [compName, count] of userCompaniesMap.entries()) {
      if (!configuredCompaniesSet.has(compName.toLowerCase().trim())) {
        unmappedCompanies.push({ name: compName, userCount: count });
      }
    }
    unmappedCompanies.sort((a, b) => b.userCount - a.userCount);

    const totalNetworkCompanies = userCompaniesMap.size;
    const mappedNetworkCompanies = Math.max(0, totalNetworkCompanies - unmappedCompanies.length);

    const embeddingsCoveragePct = activeUsersCount > 0 ? Math.round((readyEmbeddingsCount / activeUsersCount) * 100) : 100;
    const atsCoveragePct = totalNetworkCompanies > 0 ? Math.round((mappedNetworkCompanies / totalNetworkCompanies) * 100) : 100;
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
        unmapped: unmappedCompanies.length
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
      cronStatus
    });
  } catch (err: any) {
    console.error("Failed to fetch dashboard stats:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
