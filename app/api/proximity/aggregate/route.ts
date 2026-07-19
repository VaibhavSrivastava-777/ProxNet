import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters, jitterCoordinate } from "@/lib/geo/haversine";
import { companyLogoUrl, resolveUserLocation } from "@/lib/anonymize";
import type { User, UserVisibility } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseInt(searchParams.get("radius") ?? "100", 10);
  const unfiltered = searchParams.get("unfiltered") === "true";
  const tagFilter = searchParams.get("tag")?.trim().toLowerCase() || null;

  if (Number.isNaN(lat) || Number.isNaN(lng) || (Number.isNaN(radius) && !unfiltered)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  const clusters = new Map<
    string,
    {
      company: string;
      count: number;
      latSum: number;
      lngSum: number;
      logoUrl: string;
      titles: Record<string, number>;
    }
  >();

  for (const u of (users ?? []) as User[]) {
    const visibility = u.visibility as UserVisibility;
    if (!visibility?.showCompany || !u.company?.trim()) continue;

    // Filter by tag if requested
    if (tagFilter) {
      if (!u.tags || !u.tags.some(t => t.toLowerCase() === tagFilter || t.toLowerCase().includes(tagFilter))) {
        continue;
      }
    }

    const current = locationMap.get(u.id);
    let bestLoc: { lat: number; lng: number } | null = null;
    let minDistance = Infinity;

    const locsToCheck = [];
    if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
    if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
    if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

    for (const loc of locsToCheck) {
      const distance = haversineDistanceMeters(lat, lng, loc.lat, loc.lng);
      if (distance < minDistance) {
        minDistance = distance;
        bestLoc = loc;
      }
    }

    if (!bestLoc) continue;
    if (!unfiltered && minDistance > radius) continue;
    const loc = bestLoc;

    const key = u.company.trim();
    const title = (visibility?.showTitle && u.job_title?.trim()) ? u.job_title.trim() : "Professional";
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      existing.latSum += loc.lat;
      existing.lngSum += loc.lng;
      existing.titles[title] = (existing.titles[title] || 0) + 1;
    } else {
      clusters.set(key, {
        company: key,
        count: 1,
        latSum: loc.lat,
        lngSum: loc.lng,
        logoUrl: companyLogoUrl(key),
        titles: { [title]: 1 },
      });
    }
  }

  const result = Array.from(clusters.values()).map((c) => {
    const centroidLat = c.latSum / c.count;
    const centroidLng = c.lngSum / c.count;
    const jittered = jitterCoordinate(centroidLat, centroidLng, c.company);
    return {
      company: c.company,
      logoUrl: c.logoUrl,
      count: c.count,
      lat: jittered.lat,
      lng: jittered.lng,
      titles: c.titles,
    };
  });

  return NextResponse.json({ clusters: result });
}
