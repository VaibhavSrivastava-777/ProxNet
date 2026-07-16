import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const { data: userRecord, error: userError } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .single();

  if (userError) {
    console.error("User Error:", userError);
    return;
  }
  console.log("User details:", userRecord);

  const { data: tokens, error: tokenError } = await supabase
    .from("fcm_tokens")
    .select("*")
    .eq("user_id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f");

  if (tokenError) {
    console.error("Token Error:", tokenError);
  } else {
    console.log("FCM tokens registered:", tokens);
  }
}

main().catch(console.error);
