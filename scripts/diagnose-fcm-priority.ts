import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkFcmTokens() {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("email", ["vaibhav.srivastava@iiml.org", "swatipandya.sr@gmail.com"]);

  console.log("Users found:", users);

  for (const u of users || []) {
    const { data: tokens } = await supabase
      .from("fcm_tokens")
      .select("*")
      .eq("user_id", u.id);
    console.log(`FCM Tokens for ${u.full_name} (${u.email}):`, tokens?.length, tokens);
  }

  const { count: totalTokens } = await supabase
    .from("fcm_tokens")
    .select("*", { count: "exact", head: true });
  console.log("Total FCM tokens in database across all users:", totalTokens);
}

checkFcmTokens().catch(console.error);
