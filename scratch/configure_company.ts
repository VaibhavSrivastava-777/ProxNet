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
  const company = "Accenture";
  const provider = "custom";
  const urlOrToken = "https://www.accenture.com/in-en/careers";

  console.log(`Setting ATS configuration for "${company}" to ${provider} -> ${urlOrToken}...`);
  
  const { data, error } = await supabase
    .from("company_ats_config")
    .update({
      provider,
      board_token_or_url: urlOrToken
    })
    .eq("company_name", company)
    .select();

  if (error) {
    console.error("❌ Failed to update config:", error.message);
  } else {
    console.log("✅ Successfully updated config:", data);
  }
}

run();
