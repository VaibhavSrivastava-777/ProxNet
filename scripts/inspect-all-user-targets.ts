import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, profile_digest");

  console.log("=== USERS WITH TARGET COMPANIES IN PROFILE_DIGEST ===");
  for (const u of users || []) {
    const targets = u.profile_digest?.target_companies;
    if (targets && targets.length > 0) {
      console.log(`User: ${u.full_name} (${u.email}) [${u.id}]`);
      console.log(`  Targets:`, targets);
    }
  }

  const { data: utc } = await supabase
    .from("user_target_companies")
    .select("*");

  console.log("\n=== USER_TARGET_COMPANIES TABLE ===");
  for (const row of utc || []) {
    console.log(`Company: "${row.company_name}" | User: ${row.user_id}`);
    console.log(`  Provider: ${row.ats_provider} | Board/Token: ${row.ats_board_token}`);
    console.log(`  Careers URL: ${row.careers_url}`);
    console.log(`  Scrape Status: ${row.scrape_status} | Jobs Found: ${row.total_jobs_found}`);
    console.log(`  Scrape Notes: ${row.scrape_notes}`);
    console.log(`  Last Scraped: ${row.last_scraped_at}`);
  }
}

main().catch(console.error);
