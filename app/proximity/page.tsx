export const unstable_instant = { prefetch: 'static', unstable_disableValidation: true };

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProximityMap } from "@/components/map/ProximityMap";
import { isOnboardingIncomplete } from "@/lib/profile-validation";

export default async function ProximityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const onboardingIncomplete = isOnboardingIncomplete(user);
  if (onboardingIncomplete) {
    redirect("/profile?onboarding=true");
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 animate-fadeIn" style={{ paddingBottom: "3rem" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 className="text-h1">Proximity Map</h1>
        <p className="text-body-sm" style={{ marginTop: 4 }}>
          Adjust the search radius and explore anonymized company clusters on the map.
        </p>
      </div>
      <ProximityMap />
    </div>
  );
}
