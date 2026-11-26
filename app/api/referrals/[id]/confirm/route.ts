export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardWalletCredits } from "@/lib/wallet";
import { notify } from "@/lib/referrals";

/** Seeker confirms they received the referral. The giver earns 1 credit. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: req } = await supabase
    .from("referral_requests")
    .select("id, seeker_id, giver_id, company, status")
    .eq("id", id)
    .maybeSingle();
  if (!req || req.seeker_id !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "referral_posted") {
    return NextResponse.json({ error: "The referral has not been posted yet" }, { status: 409 });
  }

  // Claim the completion first so a double-click cannot pay the giver twice.
  const { data: claimed } = await supabase
    .from("referral_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("status", "referral_posted")
    .select("id")
    .maybeSingle();
  if (!claimed) return NextResponse.json({ error: "Already confirmed" }, { status: 409 });

  const reward = await awardWalletCredits(req.giver_id, "referral_completed", req.id);

  await notify(
    req.giver_id,
    "Referral confirmed",
    reward.success
      ? `The seeker confirmed your referral at ${req.company}. You earned 1 credit.`
      : `The seeker confirmed your referral at ${req.company}.`,
    "/referrals"
  );

  return NextResponse.json({ ok: true, giverCreditAwarded: reward.success });
}
