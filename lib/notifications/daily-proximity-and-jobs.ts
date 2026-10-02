import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import { isSameCompany } from "@/lib/jobs/job-filters";

export interface DailyDigestResult {
  userId: string;
  neighborNotificationSent: boolean;
  jobNotificationSent: boolean;
  newNeighborCount?: number;
  topJobs?: Array<{ id: string; title: string; company: string }>;
}

/**
 * Evaluates and dispatches daily proximity alerts (new members in 2km)
 * and top 3 matching job opportunities for a single user.
 */
export async function sendDailyUserDigest(userId: string): Promise<DailyDigestResult> {
  const supabase = createAdminClient();

  // 1. Fetch user's profile and preferences
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, about, resume_text, profile_digest, embedding, home_lat, home_lng")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return { userId, neighborNotificationSent: false, jobNotificationSent: false };
  }

  let neighborNotificationSent = false;
  let jobNotificationSent = false;
  let newNeighborCount = 0;
  const topJobs: Array<{ id: string; title: string; company: string }> = [];

  const now = new Date();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // -------------------------------------------------------------
  // PART 1: Check for addition of any new member in 2km proximity
  // -------------------------------------------------------------
  if (user.home_lat && user.home_lng) {
    const userLat = Number(user.home_lat);
    const userLng = Number(user.home_lng);

    // Fetch members who joined in the last 24 hours with home coordinates
    const { data: newMembers } = await supabase
      .from("users")
      .select("id, full_name, anonymous_name, job_title, company, home_lat, home_lng, created_at")
      .neq("id", user.id)
      .eq("is_blocked", false)
      .gte("created_at", twentyFourHoursAgo)
      .not("home_lat", "is", null)
      .not("home_lng", "is", null);

    const neighborsWithin2Km: Array<{
      id: string;
      name: string;
      title: string;
      company: string;
      distanceMeters: number;
    }> = [];

    for (const m of newMembers || []) {
      if (m.home_lat && m.home_lng) {
        const dist = haversineDistanceMeters(userLat, userLng, Number(m.home_lat), Number(m.home_lng));
        if (dist <= 2000) { // 2km
          neighborsWithin2Km.push({
            id: m.id,
            name: m.full_name || m.anonymous_name || "A professional",
            title: m.job_title || "Colleague",
            company: m.company || "tech community",
            distanceMeters: dist,
          });
        }
      }
    }

    if (neighborsWithin2Km.length > 0) {
      newNeighborCount = neighborsWithin2Km.length;
      // Sort closest first
      neighborsWithin2Km.sort((a, b) => a.distanceMeters - b.distanceMeters);
      const closest = neighborsWithin2Km[0];
      const distKm = (closest.distanceMeters / 1000).toFixed(1);

      const title = `👋 New Neighbor Nearby (${distKm} km)`;
      const body = neighborsWithin2Km.length === 1
        ? `${closest.name} (${closest.title} @ ${closest.company}) joined ProxNet within ${distKm} km of your neighborhood.`
        : `${closest.name} and ${neighborsWithin2Km.length - 1} other professional${neighborsWithin2Km.length > 2 ? "s" : ""} joined ProxNet within 2 km of you.`;

      await sendNotification(user.id, {
        title,
        body,
        url: "/network",
        data: {
          type: "new_neighbor_2km",
          count: newNeighborCount,
          closestDistanceKm: distKm,
        },
      });
      neighborNotificationSent = true;
    }
  }

  // -------------------------------------------------------------
  // PART 2: Daily Notification of Top 3 Matching Opportunities
  // -------------------------------------------------------------
  try {
    let matchedCandidates: any[] = [];

    // Stage 1: Vector similarity matching if user has embedding
    if (user.embedding) {
      const { data: vectorMatches, error: matchError } = await supabase.rpc("match_scraped_jobs", {
        query_embedding: user.embedding,
        match_threshold: 0.20,
        match_count: 50,
      });

      if (!matchError && vectorMatches && vectorMatches.length > 0) {
        matchedCandidates = vectorMatches;
      }
    }

    // Fallback: If no vector match or sparse profile, fetch latest high-quality scraped jobs
    if (matchedCandidates.length === 0) {
      const { data: fallbackJobs } = await supabase
        .from("scraped_jobs")
        .select("id, title, company, location, url, description, posted_at, keywords")
        .order("posted_at", { ascending: false })
        .limit(30);

      matchedCandidates = fallbackJobs || [];
    }

    // Exclude candidate's current company and pick 3 unique companies
    const userCompany = user.company?.trim() || "";
    const seenCompanies = new Set<string>();

    for (const j of matchedCandidates) {
      if (!j.company) continue;
      if (userCompany && isSameCompany(j.company, userCompany)) continue;
      const cKey = j.company.trim().toLowerCase();
      if (!seenCompanies.has(cKey)) {
        seenCompanies.add(cKey);
        topJobs.push({
          id: j.id,
          title: j.title,
          company: j.company,
        });
      }
      if (topJobs.length >= 3) break;
    }

    if (topJobs.length > 0) {
      const companyNames = topJobs.map((j) => j.company).join(", ");
      const title = `🎯 Top 3 Job Opportunities Today`;
      const body = `Top matching roles at ${companyNames} matched to your background. Tap to prepare and apply.`;

      await sendNotification(user.id, {
        title,
        body,
        url: "/jobs",
        data: {
          type: "daily_top_3_jobs",
          jobIds: topJobs.map((j) => j.id),
        },
      });
      jobNotificationSent = true;
    }
  } catch (err) {
    console.error(`Failed to dispatch top 3 jobs notification for user ${user.id}:`, err);
  }

  return {
    userId,
    neighborNotificationSent,
    jobNotificationSent,
    newNeighborCount,
    topJobs,
  };
}

/**
 * Runs the daily proximity & top 3 matching jobs digest across all active users.
 */
export async function runDailyProximityAndJobsCron(): Promise<{
  totalUsersChecked: number;
  neighborsAlertedCount: number;
  jobsAlertedCount: number;
}> {
  const supabase = createAdminClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .eq("is_blocked", false)
    .eq("is_active", true);

  if (error || !users) {
    console.error("Failed to fetch users for daily proximity and jobs cron:", error);
    return { totalUsersChecked: 0, neighborsAlertedCount: 0, jobsAlertedCount: 0 };
  }

  let neighborsAlertedCount = 0;
  let jobsAlertedCount = 0;

  for (const u of users) {
    try {
      const res = await sendDailyUserDigest(u.id);
      if (res.neighborNotificationSent) neighborsAlertedCount++;
      if (res.jobNotificationSent) jobsAlertedCount++;
      // Brief breathing room between user notifications
      await new Promise((resolve) => setTimeout(resolve, 80));
    } catch (e) {
      console.error(`Error processing digest for user ${u.id}:`, e);
    }
  }

  return {
    totalUsersChecked: users.length,
    neighborsAlertedCount,
    jobsAlertedCount,
  };
}
