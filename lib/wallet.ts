/**
 * Wallet Credits Management
 *
 * Awards credits to users.wallet and logs/notifies where appropriate.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type CreditReason =
  | "push_notifications_enabled"
  | "shared_job_opportunity"
  | "responded_referral_ask"
  | "answered_career_question";

export const CREDIT_REWARDS: Record<CreditReason, { amount: number; label: string }> = {
  push_notifications_enabled: { amount: 5, label: "Enabling Notifications" },
  shared_job_opportunity: { amount: 5, label: "Sharing a Job Opportunity" },
  responded_referral_ask: { amount: 5, label: "Responding to a Referral Ask" },
  answered_career_question: { amount: 3, label: "Answering a Career Question" },
};

export interface AwardCreditsResult {
  success: boolean;
  creditsAwarded: number;
  newBalance: number;
  message?: string;
}

/**
 * Award credits to a user's wallet with deduplication.
 */
export async function awardWalletCredits(
  userId: string,
  reason: CreditReason,
  referenceId?: string
): Promise<AwardCreditsResult> {
  const config = CREDIT_REWARDS[reason];
  if (!config) {
    return { success: false, creditsAwarded: 0, newBalance: 0, message: "Invalid credit reward reason" };
  }

  const supabase = createAdminClient();

  // 1. Fetch current profile_digest and wallet
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("wallet, profile_digest")
    .eq("id", userId)
    .single();

  if (fetchError || !userData) {
    console.error("Failed to fetch user for wallet reward:", fetchError);
    return { success: false, creditsAwarded: 0, newBalance: 0, message: "Failed to fetch user" };
  }

  const profileDigest = userData.profile_digest || {};
  const currentWallet = userData.wallet ?? 0;
  const rewardedActions = profileDigest.rewarded_actions || [];

  // 2. Check deduplication
  if (reason === "push_notifications_enabled") {
    if (profileDigest.push_reward_claimed || rewardedActions.includes("push_notifications_enabled")) {
      return {
        success: false,
        creditsAwarded: 0,
        newBalance: currentWallet,
        message: "Push reward already claimed",
      };
    }
  } else if (referenceId) {
    const actionKey = `${reason}:${referenceId}`;
    if (rewardedActions.includes(actionKey)) {
      return {
        success: false,
        creditsAwarded: 0,
        newBalance: currentWallet,
        message: "Reward already claimed for this action",
      };
    }
  }

  // 3. Calculate new balance & updated digest
  const newBalance = currentWallet + config.amount;
  const actionKey = referenceId ? `${reason}:${referenceId}` : reason;
  const newRewardedActions = rewardedActions.includes(actionKey)
    ? rewardedActions
    : [...rewardedActions, actionKey];

  const updatedDigest = {
    ...profileDigest,
    rewarded_actions: newRewardedActions,
    ...(reason === "push_notifications_enabled"
      ? { push_reward_claimed: true, push_reward_claimed_at: new Date().toISOString() }
      : {}),
    last_reward_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      wallet: newBalance,
      profile_digest: updatedDigest,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update wallet balance:", updateError);
    return { success: false, creditsAwarded: 0, newBalance: currentWallet, message: "Database update error" };
  }

  console.log(`[Wallet] Awarded ${config.amount} credits to ${userId} for ${config.label}. New balance: ${newBalance}`);

  return {
    success: true,
    creditsAwarded: config.amount,
    newBalance,
    message: `+${config.amount} credits earned for ${config.label}!`,
  };
}
