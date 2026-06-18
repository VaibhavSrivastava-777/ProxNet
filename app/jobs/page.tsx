import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { JobsClient } from "@/components/jobs/JobsClient";
import { HowItWorksModal } from "@/components/HowItWorksModal";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-4xl py-6 md:py-8">
      <div className="mb-6 md:mb-8 text-center px-4">
        <div className="flex items-center justify-center gap-4 mb-2">
          <h1 className="text-h1">Job Referrals</h1>
          <HowItWorksModal type="jobs" />
        </div>
        <p className="text-body-sm max-w-xl mx-auto">
          Looking for a job? Offering a referral? Connect with verified professionals anonymously based on skills and experience.
        </p>
      </div>

      <JobsClient />
    </div>
  );
}
