import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng } = await request.json();
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error: locationError } = await supabase.from("user_current_locations").upsert({
    user_id: user.id,
    lat,
    lng,
    updated_at: new Date().toISOString(),
  });

  if (locationError) return NextResponse.json({ error: locationError.message }, { status: 500 });

  // On first location acquisition (when home or office are null), set them to current location
  const updates: any = {};
  if (!user.home_lat || !user.home_lng) {
    updates.home_lat = lat;
    updates.home_lng = lng;
  }
  if (!user.office_lat || !user.office_lng) {
    updates.office_lat = lat;
    updates.office_lng = lng;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from("users").update(updates).eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
