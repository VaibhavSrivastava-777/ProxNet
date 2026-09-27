import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function testVaibhavLogs() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("event_notifications_log")
    .select("*")
    .eq("user_id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f");
  console.log("Vaibhav event notification logs:", data);
}

testVaibhavLogs().catch(console.error);
