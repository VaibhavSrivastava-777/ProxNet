import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: userData } = await supabase
    .from("users")
    .select("wallet, profile_digest")
    .eq("id", user.id)
    .single();

  const sprint = userData?.profile_digest?.sprint_mode;
  if (!sprint || !sprint.expires_at) {
    return NextResponse.json({
      active: false,
      wallet: userData?.wallet ?? 0,
      stats: { appliedCount: 0, outreachCount: 0, referralsCount: 0, goal: 15 },
    });
  }

  const expiresAt = new Date(sprint.expires_at).getTime();
  const now = Date.now();
  const isActive = expiresAt > now;
  const daysRemaining = isActive ? Math.max(1, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : 0;

  return NextResponse.json({
    active: isActive,
    expiresAt: sprint.expires_at,
    daysRemaining,
    wallet: userData?.wallet ?? 0,
    stats: {
      appliedCount: sprint.applied_count || 0,
      outreachCount: sprint.outreach_count || 0,
      referralsCount: sprint.referrals_count || 0,
      goal: sprint.goal || 15,
    },
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("wallet, initial_credits_granted, profile_digest")
    .eq("id", user.id)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentWallet = userData.wallet ?? 0;
  const SPRINT_COST = 3; // 3 credits / 7 days per Plan 2

  if (userData.initial_credits_granted && currentWallet < SPRINT_COST) {
    return NextResponse.json(
      {
        error: "INSUFFICIENT_CREDITS",
        message: "You need at least 3 credits to activate 7-Day Application Sprint Mode. Claim a Pioneer Bounty (+10) or invite a colleague to earn credits!",
        wallet: currentWallet,
      },
      { status: 402 }
    );
  }

  const newWallet = Math.max(0, currentWallet - SPRINT_COST);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const currentDigest = userData.profile_digest || {};
  const previousSprint = currentDigest.sprint_mode || {};

  const updatedSprint = {
    active: true,
    started_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    goal: previousSprint.goal || 15,
    applied_count: previousSprint.applied_count || 0,
    outreach_count: previousSprint.outreach_count || 0,
    referrals_count: previousSprint.referrals_count || 0,
  };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      wallet: newWallet,
      profile_digest: {
        ...currentDigest,
        sprint_mode: updatedSprint,
      },
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[sprint-mode] Update error:", updateError);
    return NextResponse.json({ error: "Failed to activate sprint mode" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    active: true,
    daysRemaining: 7,
    expiresAt: expiresAt.toISOString(),
    remainingWallet: newWallet,
    stats: {
      appliedCount: updatedSprint.applied_count,
      outreachCount: updatedSprint.outreach_count,
      referralsCount: updatedSprint.referrals_count,
      goal: updatedSprint.goal,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, delta = 1, goal } = await request.json();
  const supabase = createAdminClient();

  const { data: userData } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  const currentDigest = userData?.profile_digest || {};
  const sprint = currentDigest.sprint_mode || {
    active: true,
    applied_count: 0,
    outreach_count: 0,
    referrals_count: 0,
    goal: 15,
  };

  if (action === "applied") {
    sprint.applied_count = Math.max(0, (sprint.applied_count || 0) + delta);
  } else if (action === "outreach") {
    sprint.outreach_count = Math.max(0, (sprint.outreach_count || 0) + delta);
  } else if (action === "referral") {
    sprint.referrals_count = Math.max(0, (sprint.referrals_count || 0) + delta);
  }

  if (typeof goal === "number" && goal > 0) {
    sprint.goal = goal;
  }

  await supabase
    .from("users")
    .update({
      profile_digest: {
        ...currentDigest,
        sprint_mode: sprint,
      },
    })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    stats: {
      appliedCount: sprint.applied_count || 0,
      outreachCount: sprint.outreach_count || 0,
      referralsCount: sprint.referrals_count || 0,
      goal: sprint.goal || 15,
    },
  });
}
