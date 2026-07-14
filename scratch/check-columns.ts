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
    console.error("Error selecting from scraped_jobs:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Columns in scraped_jobs:", Object.keys(data[0]));
  } else {
    console.log("No rows in scraped_jobs");
  }
}

check();
