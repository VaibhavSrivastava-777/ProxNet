import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div
      className="animate-fadeIn"
      style={{
        maxWidth: 720,
        marginLeft: "auto",
        marginRight: "auto",
        padding: "32px 16px",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-h1">Your Profile</h1>
        <p className="text-body-sm" style={{ marginTop: 4 }}>
          Manage your professional details and privacy settings.
        </p>
      </div>
      <Suspense fallback={<div className="text-center py-12 text-sm text-[var(--color-text-secondary)]">Loading form...</div>}>
        <ProfileForm initialUser={user} />
      </Suspense>
    </div>
  );
}
