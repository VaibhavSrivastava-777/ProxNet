import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function testSchema() {
  const supabase = createAdminClient();
  const { data: users } = await supabase.from("users").select("id").limit(1);
  if (!users || users.length === 0) {
    console.log("No users found");
    return;
  }
  const testUserId = users[0].id;
  console.log("Testing with user:", testUserId);

  // Attempt insert
  const { data: insertData, error: insertError } = await supabase
    .from("user_streaks")
    .upsert({
      user_id: testUserId,
      current_streak: 1,
      longest_streak: 1,
      last_checkin_date: new Date().toISOString().split("T")[0],
      previous_streak: 0,
    }, { onConflict: "user_id" })
    .select();

  console.log("Upsert result:", { insertData, insertError });

  // Clean up
  await supabase.from("user_streaks").delete().eq("user_id", testUserId);
  console.log("Cleaned up test row.");
}

testSchema().catch(console.error);
