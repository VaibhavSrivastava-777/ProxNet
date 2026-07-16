export const unstable_instant = { prefetch: 'static', unstable_disableValidation: true };

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LocalForumFeed } from "@/components/home/LocalForumFeed";
import { isOnboardingIncomplete } from "@/lib/profile-validation";

export default async function ForumPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const onboardingIncomplete = isOnboardingIncomplete(user);
  if (onboardingIncomplete) {
    redirect("/profile?onboarding=true");
  }

  redirect("/qa?tab=forum");
}
