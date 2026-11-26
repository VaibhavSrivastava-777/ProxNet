import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import type { User, UserVisibility } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Get user's current location from table, or fallback to profile
  const { data: currentLoc } = await supabase
    .from("user_current_locations")
    .select("*")
    .eq("user_id", user.id)
    .single();

  let lat = currentLoc?.lat;
  let lng = currentLoc?.lng;

  if (lat == null || lng == null) {
    if (user.home_lat != null && user.home_lng != null) {
      lat = user.home_lat;
      lng = user.home_lng;
    } else if (user.office_lat != null && user.office_lng != null) {
      lat = user.office_lat;
      lng = user.office_lng;
    }
  }

  // If we have no location at all, return empty stats
  if (lat == null || lng == null) {
    return NextResponse.json({ professionals: 0, companies: 0, radiusKm: 5 });
  }

  const centerLat = Number(lat);
  const centerLng = Number(lng);
  const radius = 5000; // 5km default

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .neq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: allCurrentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (allCurrentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  const companies = new Set<string>();
  let professionals = 0;

  for (const u of (users ?? []) as User[]) {
    const visibility = u.visibility as UserVisibility;
    if (!visibility?.showCompany || !u.company?.trim()) continue;

    const current = locationMap.get(u.id);
    let minDistance = Infinity;

    const locsToCheck = [];
    if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
    if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
    if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

    for (const loc of locsToCheck) {
      const distance = haversineDistanceMeters(centerLat, centerLng, loc.lat, loc.lng);
      if (distance <= radius && distance < minDistance) {
        minDistance = distance;
      }
    }

    if (minDistance <= radius) {
      professionals++;
      companies.add(u.company.trim());
    }
  }

  let locationContext = "Unknown";
  if (currentLoc?.lat != null && currentLoc?.lng != null) {
    locationContext = "Current Location";
  } else if (user.home_lat != null && user.home_lng != null) {
    locationContext = "Home";
  } else if (user.office_lat != null && user.office_lng != null) {
    locationContext = "Office";
  }

  return NextResponse.json({
    professionals,
    companies: companies.size,
    radiusKm: 5,
    locationContext
  });
}
