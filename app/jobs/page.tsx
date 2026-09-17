import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isOnboardingIncomplete } from "@/lib/profile-validation";
import QAContentWrapper from "@/app/qa/QAContent";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const onboardingIncomplete = isOnboardingIncomplete(user);
  if (onboardingIncomplete) {
    redirect("/profile?onboarding=true");
  }

  return <QAContentWrapper initialTab="/jobs" />;
}
