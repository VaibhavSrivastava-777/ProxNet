import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkRsvpsDetailed() {
  const supabase = createAdminClient();
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("user_id, status, users(full_name, email)")
    .eq("event_id", "a2ef6197-38c4-44b2-acd4-2af503ff2102");
  console.log("RSVPs for Sept 2026 event count:", rsvps?.length);
  const vaibhavRsvp = rsvps?.find(r => r.user_id === "50ecc4a2-c514-4922-8eb7-7e74961c7c4f");
  console.log("Did Vaibhav RSVP to his own event?:", vaibhavRsvp);
}

checkRsvpsDetailed().catch(console.error);
