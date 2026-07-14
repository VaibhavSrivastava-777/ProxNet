import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from("users")
    .select("id, active_location, full_name, email");

  if (error) {
    console.error("Error fetching users:", error);
  } else {
    console.log(`Total users in database: ${data.length}`);
    const stats: Record<string, number> = {};
    for (const u of data) {
      stats[u.active_location] = (stats[u.active_location] || 0) + 1;
    }
    console.log("Stats by active_location:", stats);
    console.log("Users details:", data);
  }
}

check();
