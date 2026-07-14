export const unstable_instant = { prefetch: 'static', unstable_disableValidation: true };

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import QAContentWrapper from "./QAContent";
import { isProfileIncomplete } from "@/lib/profile-validation";

export default async function QAPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profileIncomplete = isProfileIncomplete(user);
  if (profileIncomplete) {
    redirect("/profile?onboarding=true");
  }

  return <QAContentWrapper />;
}
