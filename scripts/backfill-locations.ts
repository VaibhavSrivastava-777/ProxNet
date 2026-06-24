import { createClient } from "@supabase/supabase-js";

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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing required environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("Fetching users...");
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, home_lat, home_lng, home_name, office_lat, office_lng, office_name");

  if (error) {
    console.error("Failed to fetch users:", error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users. Scanning for generic or missing location names...`);

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
      console.log(`Geocoding home location for ${user.full_name || user.id}...`);
      const name = await reverseGeocode(user.home_lat, user.home_lng);
      if (name) {
        updates.home_name = name;
        console.log(`  Resolved home to: "${name}"`);
      }
      await sleep(1000); // Nominatim limit compliance
    }

    if (needsOfficeGeocode) {
      console.log(`Geocoding office location for ${user.full_name || user.id}...`);
      const name = await reverseGeocode(user.office_lat, user.office_lng);
      if (name) {
        updates.office_name = name;
        console.log(`  Resolved office to: "${name}"`);
      }
      await sleep(1000); // Nominatim limit compliance
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (updateErr) {
        console.error(`  Failed to update user ${user.id}:`, updateErr.message);
      } else {
        console.log(`  Successfully updated ${user.full_name || user.id}`);
      }
    }
  }

  console.log("Migration complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
