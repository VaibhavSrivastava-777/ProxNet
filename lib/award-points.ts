/**
 * Points Awarding Utility
 *
 * Inserts a row into network_points_ledger, updates users.network_points,
 * and optionally sends a push notification for significant milestones.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { POINTS_CONFIG, calculateTier, TIERS } from "@/lib/network-score";
import type { PointReason } from "@/lib/network-score";

/**
 * Award points to a user and log the transaction.
 * @returns The new total points, or null on failure.
 */
export async function awardPoints(
  userId: string,
  reason: PointReason,
  referenceId?: string,
  options?: { silent?: boolean }
): Promise<number | null> {
  const points = POINTS_CONFIG[reason];
  if (!points) return null;

  const supabase = createAdminClient();

  // 1. Insert ledger entry
  const { error: ledgerError } = await supabase
    .from("network_points_ledger")
    .insert({
      user_id: userId,
      points,
      reason,
      reference_id: referenceId ?? null,
    });

  if (ledgerError) {
    console.error("Failed to insert points ledger entry:", ledgerError);
    return null;
  }

  // 2. Update running total on user
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("network_points")
    .eq("id", userId)
    .single();

  if (fetchError || !userData) {
    console.error("Failed to fetch user points:", fetchError);
    return null;
  }

  const oldPoints = userData.network_points || 0;
  const newPoints = oldPoints + points;

  const { error: updateError } = await supabase
    .from("users")
    .update({ network_points: newPoints })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update user points:", updateError);
    return null;
  }

  // 3. Check for tier-up and send notification
  if (!options?.silent) {
    const oldTier = calculateTier(oldPoints);
    const newTier = calculateTier(newPoints);

    const reasonLabels: Record<string, string> = {
      INVITE_SIGNUP: "A professional from your neighborhood just joined ProxNet",
      INVITEE_FIRST_POST: "Your invitee is already connecting with neighbors",
      INVITEE_FIRST_REFERRAL: "Your invitee just offered a job referral",
      SECOND_DEGREE_SIGNUP: "Your network tree is growing — a 2nd-degree connection joined",
      WEEKLY_STREAK: "You've been sharing consistently this week",
      LOCALITY_MILESTONE: "Your locality just hit a new milestone",
    };

    const label = reasonLabels[reason] || "You earned points";

    // Notify on tier-up
    if (newTier.level > oldTier.level) {
      await sendNotification(userId, {
        title: `${newTier.badge} Level Up! You're now a ${newTier.name}`,
        body: `${label}. You've reached ${newPoints} pts and unlocked the ${newTier.name} tier!`,
        url: "/grow",
      }).catch((e) => console.error("Tier-up notification failed:", e));
    } else if (reason === "INVITE_SIGNUP") {
      // Always notify on new signups — this is the core dopamine hit
      await sendNotification(userId, {
        title: "🎉 Your local network just grew!",
        body: `${label}. Your network is stronger now. (+${points} pts)`,
        url: "/grow",
      }).catch((e) => console.error("Invite signup notification failed:", e));
    }
  }

  return newPoints;
}

/**
 * Get the tier name for a user with a description snippet.
 * Used for inline badge display in profile and chat.
 */
export function formatTierLabel(points: number): string {
  const tier = calculateTier(points);
  const tierIdx = TIERS.findIndex((t) => t.level === tier.level);
  const nextTier = tierIdx + 1 < TIERS.length ? TIERS[tierIdx + 1] : null;

  if (!nextTier) return `${tier.badge} ${tier.name} (Max Tier)`;
  const pointsToNext = nextTier.minPoints - points;
  return `${tier.badge} ${tier.name} • ${pointsToNext} pts to ${nextTier.name}`;
}
