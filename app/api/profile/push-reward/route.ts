import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { awardWalletCredits } from "@/lib/wallet";

/**
 * POST /api/profile/push-reward
 * Grants 5 wallet credits for enabling push notifications.
 * One-time only — delegated to awardWalletCredits.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await awardWalletCredits(user.id, "push_notifications_enabled");
  return NextResponse.json(result);
}

