import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage your professional details and privacy settings.
        </p>
      </div>
      <ProfileForm initialUser={user} />
    </div>
  );
}
