import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, home_lat, home_lng, profile_digest")
    .not("profile_digest->active_beacon", "is", null);

  console.log("Supabase error:", error);
  console.log("Users with beacon count:", data?.length);
  if (data && data.length > 0) {
    for (const u of data) {
      console.log(`User: ${u.full_name} (${u.id})`);
      console.log(`Coords: ${u.home_lat}, ${u.home_lng}`);
      console.log("active_beacon:", JSON.stringify(u.profile_digest?.active_beacon, null, 2));
    }
  }

  // Also let's check all users count and coords
  const { data: allUsers } = await supabase.from("users").select("id, full_name, home_lat, home_lng");
  console.log("\nTotal users in DB:", allUsers?.length);
  console.log("Users sample:", allUsers?.slice(0, 5));
}

main().catch(console.error);
