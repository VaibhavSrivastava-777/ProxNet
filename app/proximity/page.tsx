import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProximityMap } from "@/components/map/ProximityMap";

export default async function ProximityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Professionals in your proximity</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Adjust the search radius and explore anonymized company clusters on the map.
        </p>
      </div>
      <ProximityMap />
    </div>
  );
}
