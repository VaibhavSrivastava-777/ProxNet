import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function check() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profile_likes")
    .select("id")
    .limit(1);

  if (error) {
    console.log("Table check status: Table might not exist or error:", error.message);
  } else {
    console.log("Table check status: 'profile_likes' table exists and is accessible!", { data });
  }
}

check();
