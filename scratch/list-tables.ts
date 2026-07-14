import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from("scraped_jobs").select("*").limit(1);
  if (error) {
    console.error("Error connecting:", error);
    return;
  }
  console.log("Database connection successful!");

  // Try to list tables via SQL
  // (We don't have a direct raw SQL executor, but we can see if there are tables we can query)
  const tables = [
    "users",
    "user_current_locations",
    "admin_credentials",
    "questions",
    "question_targets",
    "chat_sessions",
    "chat_participants",
    "chat_messages",
    "job_posts",
    "job_threads",
    "job_participants",
    "job_messages",
    "company_ats_config",
    "scraped_jobs",
    "cron_runs",
    "logs",
    "system_status"
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select("count").limit(1);
    if (!error) {
      console.log(`✅ Table exists: ${table}`);
    } else {
      console.log(`❌ Table does NOT exist or error: ${table} (${error.message})`);
    }
  }
}

check();
