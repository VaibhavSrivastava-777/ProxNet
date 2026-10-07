import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  const { data: allUsers, error: errAll } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, home_lat, home_lng, is_active, is_blocked")
    .limit(20);

  console.log("Total users sampled:", allUsers?.length, "Error:", errAll);
  console.log("Sample users:", allUsers?.slice(0, 5));

  const activeTrue = allUsers?.filter(u => u.is_active === true).length;
  const activeNull = allUsers?.filter(u => u.is_active === null || u.is_active === undefined).length;
  const activeFalse = allUsers?.filter(u => u.is_active === false).length;
  const blockedFalse = allUsers?.filter(u => u.is_blocked === false).length;

  console.log("Stats:", { activeTrue, activeNull, activeFalse, blockedFalse });
}

main().catch(console.error);
