import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProximityMap } from "@/components/map/ProximityMap";

export default async function ProximityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profileIncomplete = !user.company || !user.job_title || (!user.home_lat && !user.office_lat);
  if (profileIncomplete) {
    redirect("/profile?onboarding=true");
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 animate-fadeIn" style={{ paddingBottom: "3rem" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 className="text-h1">Proximity Map</h1>
        <p className="text-body-sm" style={{ marginTop: 4 }}>
          Adjust the search radius and explore anonymized company clusters on the map.
        </p>
      </div>
      <ProximityMap />
    </div>
  );
}
