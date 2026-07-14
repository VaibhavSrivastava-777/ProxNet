import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import { resolveUserLocation } from "@/lib/anonymize";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .not("company", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filteredUsers = users ?? [];

  if (latParam && lngParam && radiusParam) {
    const centerLat = parseFloat(latParam);
    const centerLng = parseFloat(lngParam);
    const radiusMeters = parseInt(radiusParam, 10);

    const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
    const locationMap = new Map(
      (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
    );

    filteredUsers = (users ?? []).filter((u) => {
      const current = locationMap.get(u.id);
      const loc = resolveUserLocation(u, current?.lat, current?.lng);
      if (!loc) return false;
      const distance = haversineDistanceMeters(centerLat, centerLng, loc.lat, loc.lng);
      return distance <= radiusMeters;
    });
  }

  const uniqueCompaniesMap = new Map<string, string>();
  for (const d of filteredUsers) {
    if (!d.company) continue;
    const trimmed = d.company.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!uniqueCompaniesMap.has(lower)) {
      uniqueCompaniesMap.set(lower, trimmed);
    } else {
      const existing = uniqueCompaniesMap.get(lower)!;
      if (existing === existing.toLowerCase() && trimmed !== trimmed.toLowerCase()) {
        uniqueCompaniesMap.set(lower, trimmed);
      }
    }
  }
  const companies = Array.from(uniqueCompaniesMap.values()).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ companies });
}
