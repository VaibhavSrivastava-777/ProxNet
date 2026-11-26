import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboardingIncomplete } from "@/lib/profile-validation";
import { ReferralHub } from "@/components/referrals/ReferralHub";

export default async function ReferralsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isOnboardingIncomplete(user)) redirect("/profile?onboarding=true");

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <ReferralHub />
    </main>
  );
}
