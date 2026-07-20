import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase environment variables in environment");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const fakeId = "00000000-0000-0000-0000-000000000000";

  console.log("Deleting all chat_participants...");
  const res = await supabase.from("chat_participants").delete().neq("session_id", fakeId);
  console.log(res.error ? res.error.message : `Deleted participants`);
}

run();
