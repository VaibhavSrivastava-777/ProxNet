import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkFailedBoards() {
  const supabase = createAdminClient();
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url, scrape_notes, last_scraped_at, total_jobs_found")
    .neq("provider", "cron_status")
    .neq("provider", "none")
    .not("scrape_notes", "is", null);

  const failed = (configs || []).filter(c => 
    c.scrape_notes && (
      c.scrape_notes.toLowerCase().includes("error") || 
      c.scrape_notes.toLowerCase().includes("fail") ||
      c.scrape_notes.toLowerCase().includes("404") ||
      c.scrape_notes.toLowerCase().includes("400")
    )
  );

  console.log(`Total boards with error scrape_notes (${failed.length}):`);
  for (const f of failed) {
    console.log(`- ${f.company_name} (${f.provider}) [URL/Token: ${f.board_token_or_url}]:\n  Notes: ${f.scrape_notes}\n`);
  }
}

checkFailedBoards().catch(console.error);
