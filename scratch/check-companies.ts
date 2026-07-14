import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Get unique companies from users table
  const { data: users, error: usersError } = await supabase.from("users").select("company");
  if (usersError) {
    console.error("Failed to fetch users:", usersError.message);
    process.exit(1);
  }

  const proxNetCompanies = Array.from(new Set(users.map((u: any) => {
    if (!u.company) return "";
    const clean = u.company.trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }).filter(Boolean)));

  console.log("ProxNet Companies found in users table:", proxNetCompanies);

  // 2. Fetch all configs
  const { data: configs, error: configsError } = await supabase.from("company_ats_config").select("*").neq("provider", "cron_status");
  if (configsError) {
    console.error("Failed to fetch configs:", configsError.message);
    process.exit(1);
  }

  console.log("\nAll registered configurations in company_ats_config:");
  configs.forEach(c => {
    console.log(`- Company: "${c.company_name}", Provider: "${c.provider}", URL/Token: "${c.board_token_or_url}"`);
  });

  const matching = configs.filter(c => {
    const normName = c.company_name.toLowerCase().trim();
    return proxNetCompanies.some(pc => pc.toLowerCase().trim() === normName);
  });

  console.log("\nMatching Configurations for ProxNet Companies:");
  matching.forEach(c => {
    console.log(`- "${c.company_name}" (Provider: ${c.provider})`);
  });

  const nonMatching = proxNetCompanies.filter(pc => {
    const normPC = pc.toLowerCase().trim();
    return !configs.some(c => c.company_name.toLowerCase().trim() === normPC);
  });

  console.log("\nProxNet Companies without any configuration in company_ats_config:");
  nonMatching.forEach(c => {
    console.log(`- "${c}"`);
  });
}

main();
