import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createAdminClient } from "../lib/supabase/admin";
import { sendNotification } from "../lib/notifications";

async function main() {
  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, email");

  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  console.log(`Fetched ${users?.length} users. Sending test FCM...`);
  
  for (const user of (users || [])) {
    try {
      await sendNotification(user.id, {
        title: "ProxNet Update",
        body: "Share option enabled for ProxNet - help your friends to secure real connections",
        url: "/grow"
      });
      console.log(`Sent notification successfully to user: ${user.full_name} (${user.email})`);
    } catch (e) {
      console.error(`Failed to send to user ${user.id}:`, e);
    }
  }
  console.log("Completed sending test notifications.");
}

main().catch(console.error);
