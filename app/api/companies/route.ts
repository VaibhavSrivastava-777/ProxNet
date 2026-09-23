import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import { resolveUserLocation } from "@/lib/anonymize";
import { TOP_COMPANIES, searchCompanies } from "@/lib/data/curated-suggestions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("company, home_lat, home_lng, office_lat, office_lng")
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

    filteredUsers = (users ?? []).filter((u: any) => {
      const current = locationMap.get(u.id);
      const loc = resolveUserLocation(u, current?.lat, current?.lng);
      if (!loc) return false;
      const distance = haversineDistanceMeters(centerLat, centerLng, loc.lat, loc.lng);
      return distance <= radiusMeters;
    });
  }

  const dbCompaniesMap = new Map<string, string>();
  for (const d of filteredUsers) {
    if (!d.company) continue;
    const trimmed = d.company.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!dbCompaniesMap.has(lower)) {
      dbCompaniesMap.set(lower, trimmed);
    } else {
      const existing = dbCompaniesMap.get(lower)!;
      if (existing === existing.toLowerCase() && trimmed !== trimmed.toLowerCase()) {
        dbCompaniesMap.set(lower, trimmed);
      }
    }
  }
  const dbCompanies = Array.from(dbCompaniesMap.values());

  if (q && q.trim()) {
    const matched = searchCompanies(q.trim(), dbCompanies, 10);
    return NextResponse.json({ companies: matched });
  }

  // Merge dbCompanies with curated TOP_COMPANIES, prioritizing DB entries
  const allMap = new Map<string, string>();
  for (const c of dbCompanies) {
    allMap.set(c.toLowerCase(), c);
  }
  for (const c of TOP_COMPANIES) {
    if (!allMap.has(c.toLowerCase())) {
      allMap.set(c.toLowerCase(), c);
    }
  }

  const companies = Array.from(allMap.values()).sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ companies });
}
