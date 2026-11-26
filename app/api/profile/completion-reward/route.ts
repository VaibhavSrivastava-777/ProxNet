import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { awardWalletCredits } from "@/lib/wallet";
import { calculateProfileCompleteness } from "@/lib/profile-validation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: freshUser, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !freshUser) {
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }

  const completeness = calculateProfileCompleteness(freshUser);
  if (completeness < 100) {
    return NextResponse.json(
      {
        success: false,
        completeness,
        message: `Profile is ${completeness}% complete. Complete all sections to unlock +5 credits!`,
      },
      { status: 400 }
    );
  }

  const result = await awardWalletCredits(user.id, "profile_100_percent");

  return NextResponse.json({
    ...result,
    completeness,
  });
}
