import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import type { User, UserVisibility } from "@/lib/types";

function dotProduct(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseInt(searchParams.get("radius") ?? "5000", 10);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Invalid location parameters" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch current user's embedding
  const { data: meRecord } = await supabase
    .from("users")
    .select("embedding")
    .eq("id", user.id)
    .single();

  const myEmbedding = meRecord?.embedding ? (meRecord.embedding as unknown as number[]) : null;

  // Fetch all active users
  const { data: users, error: errUsers } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .neq("id", user.id);

  if (errUsers) return NextResponse.json({ error: errUsers.message }, { status: 500 });

  // Fetch user locations
  const { data: currentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map(
    (currentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }])
  );

  // Fetch following list
  const { data: following } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);
  
  const followingIds = new Set((following ?? []).map((f) => f.following_id));

  const nearbyPeople: any[] = [];

  for (const u of (users ?? []) as User[]) {
    // If user has no job title or company, don't show in proximity list
    if (!u.job_title?.trim() || !u.company?.trim()) continue;

    const current = locationMap.get(u.id);
    let minDistance = Infinity;

    const locsToCheck = [];
    if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
    if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
    if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

    for (const loc of locsToCheck) {
      const distance = haversineDistanceMeters(lat, lng, loc.lat, loc.lng);
      if (distance <= radius && distance < minDistance) {
        minDistance = distance;
      }
    }

    if (minDistance <= radius) {
      const similarityVal = dotProduct(myEmbedding, u.embedding as unknown as number[]);
      const similarityScore = myEmbedding && u.embedding ? Math.round(similarityVal * 100) : 50; // default to 50 if no embedding

      nearbyPeople.push({
        id: u.id,
        anonymous_name: u.anonymous_name || `Neighbour-${u.id.slice(0, 4)}`,
        job_title: u.job_title.trim(),
        company: u.company.trim(),
        profile_photo_url: u.visibility?.showPhoto ? u.profile_photo_url : null,
        distance: minDistance,
        similarity: similarityScore,
        is_followed: followingIds.has(u.id),
      });
    }
  }

  // Sort by similarity descending, then by distance ascending
  nearbyPeople.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return a.distance - b.distance;
  });

  return NextResponse.json({ people: nearbyPeople });
}
