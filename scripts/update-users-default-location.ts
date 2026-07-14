import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing required environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("Updating active_location to 'home' for all users in database...");
  const { data, error } = await supabase
    .from("users")
    .update({ active_location: "home" })
    .neq("id", "00000000-0000-0000-0000-000000000000") // update all users
    .select("id, full_name, active_location");

  if (error) {
    console.error("Update failed:", error);
    process.exit(1);
  }

  console.log(`Successfully updated ${data?.length || 0} users to have active_location = 'home'.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
