import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkRsvps() {
  const supabase = createAdminClient();
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("*, user:users(id, full_name, email)")
    .eq("event_id", "a2ef6197-38c4-44b2-acd4-2af503ff2102");
  console.log("RSVPs for Sept 2026 event:", rsvps);

  const { data: inApp } = await supabase
    .from("in_app_notifications")
    .select("*")
    .like("title", "%South City%")
    .order("created_at", { ascending: false });
  console.log("In-app notifications for South City:", inApp);
}

checkRsvps().catch(console.error);
