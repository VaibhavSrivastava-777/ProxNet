import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkEvents() {
  const supabase = createAdminClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false })
    .limit(10);
  console.log("Recent Events:", events);

  const { data: eventLogs } = await supabase
    .from("event_notifications_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  console.log("Event Notification Logs:", eventLogs);

  const { data: emailLogs } = await supabase
    .from("email_notifications_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Email Notification Logs:", emailLogs);
}

checkEvents().catch(console.error);
