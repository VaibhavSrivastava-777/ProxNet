import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function testEventLog() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("event_notifications_log").select("*").limit(5);
  console.log("event_notifications_log query result:", { data, error });
}

testEventLog().catch(console.error);
