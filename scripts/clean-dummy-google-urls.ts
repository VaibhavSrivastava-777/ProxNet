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
    .select("company_name, provider, board_token_or_url")
    .ilike("board_token_or_url", "%careers.google.com%");

  console.log("Configs with Google Careers URL:");
  configs?.forEach(c => {
    console.log(`- ${c.company_name} [${c.provider}]: ${c.board_token_or_url}`);
  });

  // Clean up those that are NOT Google
  for (const c of configs || []) {
    if (c.company_name.toLowerCase().trim() === "google") continue;
    console.log(`Clearing dummy Google Careers URL for: ${c.company_name}`);
    await supabase
      .from("company_ats_config")
      .update({
        provider: "none",
        board_token_or_url: "",
        scrape_notes: "Cleared dummy Google Careers URL",
      })
      .eq("company_name", c.company_name);
  }

  // Also clean up user_target_companies
  const { data: targets } = await supabase
    .from("user_target_companies")
    .select("company_name, careers_url, ats_board_token")
    .or("careers_url.ilike.%careers.google.com%,ats_board_token.ilike.%careers.google.com%");

  console.log("\nUser target companies with Google Careers URL:");
  targets?.forEach(t => {
    console.log(`- ${t.company_name}: ${t.careers_url || t.ats_board_token}`);
  });

  for (const t of targets || []) {
    if (t.company_name.toLowerCase().trim() === "google") continue;
    console.log(`Resetting user target company: ${t.company_name}`);
    await supabase
      .from("user_target_companies")
      .update({
        careers_url: null,
        ats_board_token: null,
        ats_provider: "none",
        scrape_status: "needs_url",
        scrape_notes: "Please provide company careers page URL",
      })
      .eq("company_name", t.company_name);
  }

  console.log("Cleanup complete!");
}

main().catch(console.error);
