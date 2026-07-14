import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from("scraped_jobs").select("company");
  if (error) {
    console.error(error);
    return;
  }
  
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.company] = (counts[row.company] || 0) + 1;
  }
  console.log("Scraped jobs counts:", counts);
}
run();
