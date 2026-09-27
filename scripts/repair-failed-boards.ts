import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";
import { discoverAts } from "../lib/ats-discovery";

async function repairBoards() {
  const supabase = createAdminClient();

  // 1. Add Sal Securities into company_ats_config
  const { data: existingSal } = await supabase
    .from("company_ats_config")
    .select("id")
    .ilike("company_name", "Sal Securities")
    .maybeSingle();

  if (!existingSal) {
    const { error: salErr } = await supabase.from("company_ats_config").insert({
      company_name: "Sal Securities",
      provider: "custom",
      board_token_or_url: "https://www.google.com/search?q=Sal+Securities+careers+jobs",
      scrape_notes: "Pioneer company added for tracking",
      total_jobs_found: 0
    });
    console.log("Inserted Sal Securities into company_ats_config:", salErr ? salErr.message : "Success");
  }

  // 2. Fix Independent Advisory Practice (empty URL causing 400 error)
  await supabase
    .from("company_ats_config")
    .update({
      provider: "none",
      board_token_or_url: "none",
      scrape_notes: "Independent practice without public ATS board (skipped)"
    })
    .ilike("company_name", "Independent Advisory Practice");
  console.log("Updated Independent Advisory Practice to provider: 'none'");

  // 3. Fix Retired (empty URL causing 400 error)
  await supabase
    .from("company_ats_config")
    .update({
      provider: "none",
      board_token_or_url: "none",
      scrape_notes: "Status label without public ATS board (skipped)"
    })
    .ilike("company_name", "Retired");
  console.log("Updated Retired to provider: 'none'");

  // 4. Test discovery for Grammarly, Canva, Confluent, Snyk, Plaid
  const checkList = ["Grammarly", "Canva", "Confluent", "Snyk", "Plaid", "DoorDash"];
  for (const comp of checkList) {
    const res = await discoverAts(comp);
    console.log(`Discovery for ${comp}:`, res);
    if (res && res.provider && res.provider !== "greenhouse") {
      await supabase
        .from("company_ats_config")
        .update({
          provider: res.provider,
          board_token_or_url: res.board,
          scrape_notes: `Updated to ${res.provider}`
        })
        .ilike("company_name", comp);
    } else if (!res) {
      // If greenhouse returns 404, switch to custom careers URL so it uses Firecrawl
      await supabase
        .from("company_ats_config")
        .update({
          provider: "custom",
          board_token_or_url: `https://www.${comp.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/careers`,
          scrape_notes: "Switched from 404 greenhouse to custom careers URL"
        })
        .ilike("company_name", comp);
    }
  }

  console.log("Finished repairing boards!");
}

repairBoards().catch(console.error);
