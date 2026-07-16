export const unstable_instant = { prefetch: 'static', unstable_disableValidation: true };

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboardingIncomplete } from "@/lib/profile-validation";
import { GrowClient } from "@/components/grow/GrowClient";

export default async function GrowPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const onboardingIncomplete = isOnboardingIncomplete(user);
  if (onboardingIncomplete) {
    redirect("/profile?onboarding=true");
  }

  redirect("/qa?tab=grow");
}
