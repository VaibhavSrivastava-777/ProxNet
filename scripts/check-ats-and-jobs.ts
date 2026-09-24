import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function check() {
  const supabase = createAdminClient();
  const { data: ats, count: atsCount } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, total_jobs_found, last_scraped_at", { count: "exact" });

  console.log("ATS configs total count:", atsCount);
  const valid = (ats || []).filter(a => a.provider !== "none" && a.provider !== "error");
  console.log(`Valid scrapeable providers (${valid.length}):`, valid);

  const { count: jobCount } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });
  console.log("Total scraped jobs in database:", jobCount);
}
check().catch(console.error);
