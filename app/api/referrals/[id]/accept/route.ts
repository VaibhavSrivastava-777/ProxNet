export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductWalletCredits } from "@/lib/wallet";
import { REFERRAL_CREDIT_COST, createReferralThread, notify } from "@/lib/referrals";

/**
 * Giver accepts. The seeker is charged here, not when they asked.
 * Order: claim the request -> charge the seeker -> open the chat.
 */
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
  if (!req || req.giver_id !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (req.status !== "requested") {
    return NextResponse.json({ error: "This request is no longer open" }, { status: 409 });
  }

  const { data: seeker } = await supabase.from("users").select("wallet").eq("id", req.seeker_id).single();
  if ((seeker?.wallet ?? 0) < REFERRAL_CREDIT_COST) {
    return NextResponse.json(
      { error: "The seeker does not have enough credits for this referral." },
      { status: 402 }
    );
  }

  // Claim atomically so two accepts cannot both succeed.
  const { data: claimed } = await supabase
    .from("referral_requests")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", req.id)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ error: "This request is no longer open" }, { status: 409 });
  }

  const charge = await deductWalletCredits(req.seeker_id, "referral_request_cost", req.id, REFERRAL_CREDIT_COST);
  if (!charge.success) {
    await supabase.from("referral_requests").update({ status: "requested", accepted_at: null }).eq("id", req.id);
    return NextResponse.json({ error: "Could not charge the seeker. Please try again." }, { status: 500 });
  }

  let threadId: string;
  try {
    threadId = await createReferralThread({
      seekerId: req.seeker_id,
      giverId: req.giver_id,
      company: req.company,
    });
  } catch (err) {
    console.error("Failed to create referral thread:", err);
    // Undo the claim and refund the charge so the seeker is not left out of pocket.
    await supabase.from("referral_requests").update({ status: "requested", accepted_at: null }).eq("id", req.id);
    const { data: current } = await supabase.from("users").select("wallet").eq("id", req.seeker_id).single();
    await supabase.from("users").update({ wallet: (current?.wallet ?? 0) + REFERRAL_CREDIT_COST }).eq("id", req.seeker_id);
    return NextResponse.json({ error: "Could not open the chat. Please try again." }, { status: 500 });
  }

  await supabase.from("referral_requests").update({ thread_id: threadId }).eq("id", req.id);

  await notify(
    req.seeker_id,
    "Referral request accepted",
    `Your referral request at ${req.company} was accepted. Open the chat to continue.`,
    `/jobs/chat/${threadId}`
  );

  return NextResponse.json({ threadId });
}
