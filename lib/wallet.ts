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
  | "answered_career_question"
  | "profile_100_percent"
  | "onboarding_bounty";

export const CREDIT_REWARDS: Record<CreditReason, { amount: number; label: string }> = {
  push_notifications_enabled: { amount: 5, label: "Enabling Notifications" },
  shared_job_opportunity: { amount: 5, label: "Sharing a Job Opportunity" },
  responded_referral_ask: { amount: 3, label: "Responding to a Referral Ask" },
  answered_career_question: { amount: 3, label: "Answering a Career Question" },
  profile_100_percent: { amount: 5, label: "Completing 100% of Profile" },
  onboarding_bounty: { amount: 10, label: "Onboarding Pioneer Professional" },
};

export type DebitReason =
  | "referral_request_cost"
  | "referral_response_transfer"
  | "deep_ats_fetch";

export const CREDIT_COSTS: Record<DebitReason, { amount: number; label: string }> = {
  referral_request_cost: { amount: 1, label: "Initiating a Referral Request" },
  referral_response_transfer: { amount: 3, label: "Transfer for Referral Response" },
  deep_ats_fetch: { amount: 1, label: "Deep ATS Match Hunter" },
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
  } else if (reason === "profile_100_percent") {
    if (profileDigest.profile_100_reward_claimed || rewardedActions.includes("profile_100_percent")) {
      return {
        success: false,
        creditsAwarded: 0,
        newBalance: currentWallet,
        message: "Profile completion reward already claimed",
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
    ...(reason === "profile_100_percent"
      ? { profile_100_reward_claimed: true, profile_100_reward_claimed_at: new Date().toISOString() }
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

export interface DeductCreditsResult {
  success: boolean;
  creditsDeducted: number;
  newBalance: number;
  wasNegative: boolean;
  message?: string;
}

/**
 * Deduct credits from a user's wallet with soft-warning (allows going negative to avoid blocking UX).
 */
export async function deductWalletCredits(
  userId: string,
  reason: DebitReason,
  referenceId?: string,
  customAmount?: number
): Promise<DeductCreditsResult> {
  const config = CREDIT_COSTS[reason];
  const amount = customAmount ?? config?.amount ?? 1;

  const supabase = createAdminClient();
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("wallet, profile_digest")
    .eq("id", userId)
    .single();

  if (fetchError || !userData) {
    return { success: false, creditsDeducted: 0, newBalance: 0, wasNegative: false, message: "User not found" };
  }

  const profileDigest = userData.profile_digest || {};
  const currentWallet = userData.wallet ?? 0;
  const deductedActions = profileDigest.deducted_actions || [];

  if (referenceId) {
    const actionKey = `${reason}:${referenceId}`;
    if (deductedActions.includes(actionKey)) {
      return {
        success: false,
        creditsDeducted: 0,
        newBalance: currentWallet,
        wasNegative: currentWallet < 0,
        message: "Credits already deducted for this action",
      };
    }
  }

  const newBalance = currentWallet - amount;
  const actionKey = referenceId ? `${reason}:${referenceId}` : reason;
  const newDeductedActions = [...deductedActions, actionKey];

  const updatedDigest = {
    ...profileDigest,
    deducted_actions: newDeductedActions,
    last_deduction_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      wallet: newBalance,
      profile_digest: updatedDigest,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update deducted wallet balance:", updateError);
    return { success: false, creditsDeducted: 0, newBalance: currentWallet, wasNegative: false, message: "Database update error" };
  }

  console.log(`[Wallet] Deducted ${amount} credits from ${userId} for ${config?.label || reason}. New balance: ${newBalance}`);

  return {
    success: true,
    creditsDeducted: amount,
    newBalance,
    wasNegative: newBalance < 0,
    message: `-${amount} credits for ${config?.label || reason}`,
  };
}

export interface TransferCreditsResult {
  success: boolean;
  transferredAmount: number;
  fromBalance: number;
  toBalance: number;
  message?: string;
}

/**
 * Atomically moves credits from requester to responder when a referral request is answered.
 */
export async function transferCredits(
  fromUserId: string,
  toUserId: string,
  amount: number,
  reason: "referral_response_transfer",
  referenceId?: string
): Promise<TransferCreditsResult> {
  const supabase = createAdminClient();

  // Deduplication check: only transfer once per thread referenceId
  if (referenceId) {
    const { data: toUserData } = await supabase
      .from("users")
      .select("profile_digest")
      .eq("id", toUserId)
      .single();
    const rewardedActions = toUserData?.profile_digest?.rewarded_actions || [];
    if (rewardedActions.includes(`responded_referral_ask:${referenceId}`)) {
      return {
        success: false,
        transferredAmount: 0,
        fromBalance: 0,
        toBalance: 0,
        message: "Transfer already completed for this thread",
      };
    }
  }

  // 1. Deduct from requester (sender)
  const deductRes = await deductWalletCredits(fromUserId, "referral_response_transfer", referenceId, amount);

  // 2. Award to responder (receiver)
  const awardRes = await awardWalletCredits(toUserId, "responded_referral_ask", referenceId);

  // 3. Notify the requester that credits were transferred to the referrer
  try {
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(fromUserId, {
      title: "💸 Credits Transferred",
      body: `${amount} credits were transferred to your referrer for responding to your referral ask.`,
      url: referenceId ? `/jobs/chat/${referenceId}` : "/jobs",
      data: {
        type: "credit_transfer",
        amount,
        threadId: referenceId,
      },
    });
  } catch (err) {
    console.error("Failed to notify requester of credit transfer:", err);
  }

  return {
    success: true,
    transferredAmount: amount,
    fromBalance: deductRes.newBalance,
    toBalance: awardRes.newBalance,
    message: `Transferred ${amount} credits successfully`,
  };
}

export interface PioneerBountyResult {
  awarded: boolean;
  inviterId?: string;
  companyName?: string;
  newBalance?: number;
  message?: string;
}

/**
 * Checks if the user is the first professional on ProxNet from their company.
 * If so, awards the +10 Pioneer Bounty to the member who invited them.
 */
export async function checkAndAwardPioneerBounty(
  newUserId: string,
  company: string
): Promise<PioneerBountyResult> {
  const cleanCompany = company?.trim();
  if (!cleanCompany) return { awarded: false, message: "No company specified" };

  const supabase = createAdminClient();

  // 1. Fetch user to verify they were invited by someone
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, invited_by, full_name")
    .eq("id", newUserId)
    .single();

  if (userError || !user || !user.invited_by) {
    return { awarded: false, message: "User not invited by anyone" };
  }

  // 2. Check if ANY other user on ProxNet already belongs to this company (case-insensitive)
  const { count: otherCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .ilike("company", cleanCompany)
    .neq("id", newUserId);

  if (otherCount && otherCount > 0) {
    return { awarded: false, message: "Company already has professionals on ProxNet" };
  }

  // 3. Award +10 credits to the inviter
  const actionRef = `${cleanCompany.toLowerCase()}`;
  const awardResult = await awardWalletCredits(user.invited_by, "onboarding_bounty", actionRef);

  if (!awardResult.success) {
    return { awarded: false, message: awardResult.message };
  }

  // 4. Send celebratory notification to inviter
  try {
    const { sendNotification } = await import("@/lib/notifications");
    await sendNotification(user.invited_by, {
      title: "🏆 Pioneer Bounty Earned!",
      body: `You earned +10 credits! ${user.full_name || "A professional"} joined as the first person from ${cleanCompany} on ProxNet.`,
      url: "/grow",
      data: {
        type: "pioneer_bounty",
        company: cleanCompany,
        credits: 10,
      },
    });
  } catch (err) {
    console.error("Failed to notify inviter of pioneer bounty:", err);
  }

  return {
    awarded: true,
    inviterId: user.invited_by,
    companyName: cleanCompany,
    newBalance: awardResult.newBalance,
    message: `+10 Pioneer Bounty awarded for onboarding first ${cleanCompany} professional!`,
  };
}

