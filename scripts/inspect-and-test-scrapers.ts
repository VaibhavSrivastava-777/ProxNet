import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: configs, error: cfgErr } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, scrape_notes, total_jobs_found, last_scraped_at")
    .order("company_name");

  if (cfgErr) {
    console.error("Error fetching company_ats_config:", cfgErr);
    return;
  }

  const { data: userTargets } = await supabase
    .from("user_target_companies")
    .select("company_name, ats_provider, ats_board_token, careers_url, scrape_status, scrape_notes");

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

  console.log(`company_ats_config rows: ${configs?.length || 0}`);
  console.log(`user_target_companies rows: ${userTargets?.length || 0}`);
  console.log(`users distinct companies: ${userCompanies.size}`);

  const byProvider: Record<string, number> = {};
  configs?.forEach(c => {
    byProvider[c.provider || "missing"] = (byProvider[c.provider || "missing"] || 0) + 1;
  });
  console.log("\nBreakdown by provider in company_ats_config:");
  console.table(byProvider);
}

main().catch(console.error);
