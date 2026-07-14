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
  const { data, error } = await supabase.from("company_ats_config").select("company_name, provider, board_token_or_url");
  if (error) {
    console.error(error);
  } else {
    console.log(`Total configs: ${data.length}`);
    console.log("Configs list:");
    data.forEach(d => {
      console.log(`- ${d.company_name}: provider=${d.provider}, token_or_url=${d.board_token_or_url}`);
    });
  }
}
run();
