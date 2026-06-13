import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { CarpoolClient } from "@/components/carpool/CarpoolClient";

export const metadata = {
  title: "Carpool - ProxNet",
};

export default async function CarpoolPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fadeInUp">
      <div className="mb-8">
        <h1 className="text-h1">Carpool Match</h1>
        <p className="text-body-sm text-[var(--color-text-secondary)] mt-1">
          Coordinate rides with verified professionals in your proximity.
        </p>
      </div>

      <CarpoolClient user={user} />
    </div>
  );
}
