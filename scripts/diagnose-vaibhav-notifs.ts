import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkVaibhav() {
  const supabase = createAdminClient();
  const { data: notifs } = await supabase
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .order("created_at", { ascending: false })
    .limit(20);
  console.log("Recent notifications for Vaibhav:", notifs);
}

checkVaibhav().catch(console.error);
