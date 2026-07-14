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
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("full_name, company, email");

  if (userError) {
    console.error(userError);
    return;
  }

  const { data: configs, error: configError } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url");

  if (configError) {
    console.error(configError);
    return;
  }

  const configMap = new Map<string, { provider: string; board: string }>();
  configs.forEach(c => {
    configMap.set(c.company_name.toLowerCase().trim(), { provider: c.provider, board: c.board_token_or_url });
  });

  console.log("Users and their ATS Configurations:");
  for (const user of users || []) {
    const co = user.company ? user.company.trim() : "";
    if (!co) continue;
    const cleanCo = co.toLowerCase();
    
    // Let's find matches in configMap
    let matchedConfig = configMap.get(cleanCo);
    if (!matchedConfig) {
      // try prefix matching or word matching
      for (const [k, v] of configMap.entries()) {
        if (cleanCo.includes(k) || k.includes(cleanCo)) {
          matchedConfig = v;
          break;
        }
      }
    }

    console.log(`- User: ${user.full_name}`);
    console.log(`  Company: "${user.company}"`);
    if (matchedConfig) {
      console.log(`  ATS Match: ${matchedConfig.provider} (board: ${matchedConfig.board})`);
    } else {
      console.log(`  ATS Match: NONE in database`);
    }
  }
}
run();
