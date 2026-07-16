import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { CarpoolClient } from "@/components/carpool/CarpoolClient";
import { CarpoolGatekeeper } from "@/components/carpool/CarpoolGatekeeper";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { isOnboardingIncomplete } from "@/lib/profile-validation";

export const metadata = {
  title: "Carpool - ProxNet",
};

export default async function CarpoolPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const onboardingIncomplete = isOnboardingIncomplete(user);
  if (onboardingIncomplete) {
    redirect("/profile?onboarding=true");
  }

  const hasLocations = !!(user.home_lat && user.home_lng && user.office_lat && user.office_lng);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fadeInUp">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-1">
          <h1 className="text-h1">Carpool Match</h1>
          <HowItWorksModal type="carpool" />
        </div>
        <p className="text-body-sm text-[var(--color-text-secondary)]">
          Coordinate rides with verified professionals in your proximity.
        </p>
      </div>

      {hasLocations ? <CarpoolClient user={user} /> : <CarpoolGatekeeper />}
    </div>
  );
}
