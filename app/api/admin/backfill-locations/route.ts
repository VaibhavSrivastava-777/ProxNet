import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`, {
      headers: {
        "User-Agent": "ProxNet-Migration/1.0"
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;
    
    const addr = data.address;
    const parts = [
      addr.neighbourhood,
      addr.suburb,
      addr.road,
      addr.residential,
      addr.city_district,
      addr.city || addr.town
    ].filter(Boolean);
    
    if (parts.length > 0) {
      return parts.slice(0, 2).join(", ");
    }
    return data.display_name || null;
  } catch (e) {
    console.error(`Reverse geocoding failed for ${lat},${lng}:`, e);
    return null;
  }
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, home_lat, home_lng, home_name, office_lat, office_lng, office_name");

  if (error || !users) {
    return NextResponse.json({ error: error?.message || "Error fetching users" }, { status: 500 });
  }

  let successCount = 0;

  for (const user of users) {
    const updates: Record<string, any> = {};

    const needsHomeGeocode = user.home_lat && user.home_lng && (
      !user.home_name ||
      user.home_name.trim() === "" ||
      user.home_name.toLowerCase() === "home" ||
      user.home_name.toLowerCase() === "office"
    );

    const needsOfficeGeocode = user.office_lat && user.office_lng && (
      !user.office_name ||
      user.office_name.trim() === "" ||
      user.office_name.toLowerCase() === "home" ||
      user.office_name.toLowerCase() === "office"
    );

    if (needsHomeGeocode) {
      const name = await reverseGeocode(user.home_lat, user.home_lng);
      if (name) {
        updates.home_name = name;
      }
      await sleep(1000); // Respect Nominatim limit
    }

    if (needsOfficeGeocode) {
      const name = await reverseGeocode(user.office_lat, user.office_lng);
      if (name) {
        updates.office_name = name;
      }
      await sleep(1000); // Respect Nominatim limit
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (!updateErr) {
        successCount++;
      }
    }
  }

  return NextResponse.json({ success: true, count: successCount, total: users.length });
}
