import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkEmails() {
  const supabase = createAdminClient();
  const { data: logs, error } = await supabase
    .from("email_notifications_log")
    .select("*")
    .limit(20);
  console.log("email_notifications_log:", error, logs);
}

checkEmails().catch(console.error);
