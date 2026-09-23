import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status")
    .order("company_name");

  const { data: userTargets } = await supabase
    .from("user_target_companies")
    .select("*");

  const { data: users } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const invalid = ["retired", "student", "freelance", "self-employed", "n/a", "none", "independent advisory", "cron_status"];
  const userCompanies = new Set(
    (users || [])
      .map((u) => u.company?.trim())
      .filter((c): c is string => Boolean(c) && !invalid.some((inv) => c.toLowerCase().includes(inv)))
  );

  console.log("=== CONFIGS IN company_ats_config ===");
  configs?.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.provider}] ${c.company_name} -> ${c.board_token_or_url || "none"}`);
  });

  console.log("\n=== USER TARGET COMPANIES ===");
  userTargets?.forEach((t, idx) => {
    console.log(`${idx + 1}. [${t.ats_provider}] ${t.company_name} -> ${t.ats_board_token || t.careers_url || "none"}`);
  });

  console.log("\n=== USER COMPANIES NOT IN company_ats_config ===");
  const configNames = new Set(configs?.map(c => c.company_name.toLowerCase().trim()) || []);
  let unconfiguredCount = 0;
  userCompanies.forEach(comp => {
    if (!configNames.has(comp.toLowerCase().trim())) {
      unconfiguredCount++;
      console.log(`${unconfiguredCount}. ${comp}`);
    }
  });
}

main().catch(console.error);
