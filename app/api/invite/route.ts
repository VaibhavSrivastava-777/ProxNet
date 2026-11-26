import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import {
  getNextTierProgress,
  computeEarnedBadges,
} from "@/lib/network-score";

/**
 * GET /api/invite
 * Returns the current user's invite dashboard data.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Ensure the user has an invite code (backfill for pre-existing users)
  let inviteCode = user.invite_code;
  if (!inviteCode) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let code = "PX-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    await supabase
      .from("users")
      .update({ invite_code: code })
      .eq("id", user.id);
    inviteCode = code;
  }

  // Fetch invite stats
  const [
    { count: totalSignups },
    { data: recentPoints },
    { data: inviteeActivity },
    { data: allUsers },
    { data: weekEvents },
  ] = await Promise.all([
    // Total signups via this user's invite
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("invited_by", user.id),
    // Recent points ledger
    supabase
      .from("network_points_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    // Active invitees (invitees who have participated in at least 1 question or forum post)
    supabase
      .from("users")
      .select("id")
      .eq("invited_by", user.id),
    // All active users for locality count
    supabase
      .from("users")
      .select("id, home_lat, home_lng")
      .eq("is_active", true),
    // This week's share events (for streak detection)
    supabase
      .from("invite_events")
      .select("id")
      .eq("inviter_id", user.id)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Fetch 2nd-degree signups (users invited by my invitees)
  const inviteeIds = (inviteeActivity ?? []).map((u: { id: string }) => u.id);
  const { data: secondDegreeUsers } = inviteeIds.length > 0
    ? await supabase
        .from("users")
        .select("id, invited_by")
        .in("invited_by", inviteeIds)
    : { data: [] };

  // Calculate locality count (users within 2km of current user)
  let localityCount = 0;
  if (user.home_lat && user.home_lng && allUsers) {
    localityCount = allUsers.filter((u: { id: string; home_lat: number | null; home_lng: number | null }) => {
      if (!u.home_lat || !u.home_lng || u.id === user.id) return false;
      const dist = haversineDistanceMeters(
        Number(user.home_lat),
        Number(user.home_lng),
        Number(u.home_lat),
        Number(u.home_lng)
      );
      return dist <= 2000;
    }).length;
  }

  // Check active invitees (those who have created questions)
  let activeInviteeCount = 0;
  if (inviteeActivity && inviteeActivity.length > 0) {
    const inviteeIds = inviteeActivity.map((u: { id: string }) => u.id);
    const { count } = await supabase
      .from("questions")
      .select("asker_id", { count: "exact", head: true })
      .in("asker_id", inviteeIds);
    activeInviteeCount = count ?? 0;
  }

  // Compute tier and badges
  const points = user.network_points || 0;
  const tierProgress = getNextTierProgress(points);
  const hasStreak = (weekEvents?.length ?? 0) >= 3;
  const hasSecondDegree = (secondDegreeUsers?.length ?? 0) > 0;

  // Check if user is the building pioneer (first user within 500m)
  let isBuildingPioneer = false;
  if (user.home_lat && user.home_lng && allUsers) {
    const nearbyBefore = allUsers.filter((u: { id: string; home_lat: number | null; home_lng: number | null }) => {
      if (!u.home_lat || !u.home_lng || u.id === user.id) return false;
      return (
        haversineDistanceMeters(
          Number(user.home_lat),
          Number(user.home_lng),
          Number(u.home_lat),
          Number(u.home_lng)
        ) <= 500
      );
    });
    isBuildingPioneer = nearbyBefore.length === 0;
  }

  const badges = computeEarnedBadges({
    totalSignups: totalSignups ?? 0,
    activeInvitees: activeInviteeCount,
    hasStreak,
    inviteeGotMatch: false, // Would require cross-referencing carpool/job matches — simplified for now
    isBuildingPioneer,
    hasSecondDegree,
  });

  return NextResponse.json({
    inviteCode,
    points,
    tier: tierProgress.currentTier,
    nextTier: tierProgress.nextTier,
    progressPercent: tierProgress.progressPercent,
    pointsToNext: tierProgress.pointsToNext,
    totalSignups: totalSignups ?? 0,
    activeInvitees: activeInviteeCount,
    localityCount,
    recentPoints: recentPoints ?? [],
    badges,
    hasStreak,
  });
}
