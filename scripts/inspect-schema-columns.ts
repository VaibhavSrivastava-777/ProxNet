import { createAdminClient } from "../lib/supabase/admin";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function check() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, profile_digest")
    .limit(1);
  console.log("Users basic select:", { data, error });

  // Test selecting ask_me_about
  const { data: colData, error: colError } = await supabase
    .from("users")
    .select("id, ask_me_about, help_offers, tinkering_with, quick_chat_preference, society_name")
    .limit(1);
  console.log("Users scrapbook columns:", { colData, colError });
}

check();
