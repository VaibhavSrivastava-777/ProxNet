import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  console.log("=== Checking Environment Variables ===");
  console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "SET (" + process.env.FIREBASE_PROJECT_ID + ")" : "MISSING");
  console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? "SET (" + process.env.FIREBASE_CLIENT_EMAIL + ")" : "MISSING");
  console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "SET (length: " + process.env.FIREBASE_PRIVATE_KEY.length + ")" : "MISSING");
  console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "SET (prefix: " + process.env.RESEND_API_KEY.slice(0, 7) + "...)" : "MISSING");
  console.log("RESEND_FROM_EMAIL:", process.env.RESEND_FROM_EMAIL || "not set (default: notifications@proxnet.in)");

  const supabase = createAdminClient();

  console.log("\n=== Checking User 'Vaibhav Srivastava' ===");
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, email, is_active, company, job_title")
    .ilike("full_name", "%vaibhav%srivastava%");

  if (error) {
    console.error("Error querying user:", error);
    return;
  }

  console.log("Found users matching 'Vaibhav Srivastava':", users);

  if (users && users.length > 0) {
    for (const u of users) {
      console.log(`\nTokens for user ${u.id} (${u.full_name}, ${u.email}):`);
      const { data: tokens, error: tokenErr } = await supabase
        .from("fcm_tokens")
        .select("*")
        .eq("user_id", u.id);

      if (tokenErr) {
        console.error("Error fetching tokens:", tokenErr);
      } else {
        console.log("FCM tokens count:", tokens?.length);
        console.log("FCM tokens details:", tokens);
      }
    }
  }
}

main().catch(console.error);
