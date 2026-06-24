import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import QAContentWrapper from "./QAContent";

export default async function QAPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const profileIncomplete = !user.company || !user.job_title || (!user.home_lat && !user.office_lat);
  if (profileIncomplete) {
    redirect("/profile?onboarding=true");
  }

  return <QAContentWrapper />;
}
