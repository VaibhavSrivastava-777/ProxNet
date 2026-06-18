import { sendNotification } from "../lib/notifications";
import { createAdminClient } from "../lib/supabase/admin";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').select('id, email').eq('email', 'vaibhav.srivastava@iiml.org').single();
  
  if (error || !data) {
    console.error("User not found", error);
    process.exit(1);
  }

  const userId = data.id;
  console.log("Sending push to:", userId);

  await sendNotification(userId, {
    title: "Test Notification",
    body: "This is a test broadcast notification for the PWA.",
    url: "/"
  });

  console.log("Done");
  process.exit(0);
}

run();
