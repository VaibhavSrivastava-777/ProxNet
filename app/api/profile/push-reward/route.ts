import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/profile/push-reward
 * Grants 5 wallet credits for enabling push notifications.
 * One-time only — checks `push_reward_claimed` flag in profile_digest.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Fetch current profile_digest and wallet
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("wallet, profile_digest")
    .eq("id", user.id)
    .single();

  if (fetchError || !userData) {
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }

  const profileDigest = userData.profile_digest || {};
  const currentWallet = userData.wallet ?? 0;

  // 2. Check if reward was already claimed
  if (profileDigest.push_reward_claimed) {
    return NextResponse.json({
      success: false,
      message: "Push reward already claimed",
      creditsAwarded: 0,
      newBalance: currentWallet,
    });
  }

  // 3. Award 5 credits and set flag
  const REWARD_CREDITS = 5;
  const newBalance = currentWallet + REWARD_CREDITS;
  const updatedDigest = {
    ...profileDigest,
    push_reward_claimed: true,
    push_reward_claimed_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      wallet: newBalance,
      profile_digest: updatedDigest,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Failed to grant push reward:", updateError);
    return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 });
  }

  console.log(`Push reward: Granted ${REWARD_CREDITS} credits to user ${user.id}. New balance: ${newBalance}`);

  return NextResponse.json({
    success: true,
    creditsAwarded: REWARD_CREDITS,
    newBalance,
  });
}
