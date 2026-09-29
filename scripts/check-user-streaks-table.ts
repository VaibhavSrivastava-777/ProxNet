import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function check() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_streaks")
    .select("*")
    .limit(1);

  if (error) {
    console.log("user_streaks table check:", error.message, error.code);
  } else {
    console.log("user_streaks table exists and is accessible!", { data });
  }
}

check().catch(console.error);
