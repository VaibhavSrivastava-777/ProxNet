import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: boards } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url")
    .neq("provider", "cron_status")
    .neq("provider", "custom")
    .order("company_name", { ascending: true });

  console.log(`Checking ${(boards || []).length} structured ATS boards:`);
  for (const b of boards || []) {
    const token = b.board_token_or_url;
    if (token.length <= 4 || !token.startsWith("http")) {
      console.log(`- ${b.company_name} [${b.provider}]: "${token}"`);
    }
  }
}

main();
