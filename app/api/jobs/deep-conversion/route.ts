import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductWalletCredits } from "@/lib/wallet";
import { runDeepCareerConversionMiner } from "@/lib/jobs/deep-conversion-miner";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, resume_text, wallet, profile_digest")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const resumeText = userData.resume_text?.trim() || "";
    if (resumeText.length < 50) {
      return NextResponse.json({
        error: "NO_RESUME",
        message: "Please upload your resume to run the Deep Career Conversion Miner.",
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedCount = Math.min(5, Math.max(1, parseInt(body.opportunityCount || "1", 10)));
    const costPerOpportunity = 3;

    // Run the deep conversion miner for requestedCount opportunities
    const { candidate, blueprints } = await runDeepCareerConversionMiner(user.id, requestedCount);

    // Fair Billing: Charge exactly 3 credits per opportunity actually unearthed
    const actualUnearthed = blueprints.length;
    const totalCreditsToDeduct = actualUnearthed * costPerOpportunity;

    let remainingWallet = userData.wallet ?? 0;
    if (totalCreditsToDeduct > 0) {
      const runId = `miner_${Date.now()}`;
      const deduction = await deductWalletCredits(user.id, "deep_career_miner", runId, totalCreditsToDeduct);
      remainingWallet = deduction.newBalance;
    }

    return NextResponse.json({
      success: true,
      blueprints,
      remainingWallet,
      creditsExpended: totalCreditsToDeduct,
      costPerOpportunity,
      unearthedCount: actualUnearthed,
      candidate: {
        name: candidate.fullName,
        role: candidate.currentRole,
        company: candidate.currentCompany,
        targetCompanies: candidate.targetCompanies,
      }
    });

  } catch (error: any) {
    console.error("[deep-conversion API error]:", error);
    return NextResponse.json({
      error: "CONVERSION_MINER_FAILED",
      message: error?.message || "An unexpected error occurred during deep career conversion mining."
    }, { status: 500 });
  }
}
