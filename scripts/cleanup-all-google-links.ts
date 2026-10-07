import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("======================================================");
  console.log("🧹 CLEANING UP GENERIC GOOGLE.COM LINKS ACROSS DATABASE");
  console.log("======================================================");

  // 1. Clean company_ats_config
  console.log("\n▶ 1. Cleaning company_ats_config generic Google links...");
  
  // A. Jason
  const { error: jasonErr } = await supabase
    .from("company_ats_config")
    .update({
      provider: "custom",
      board_token_or_url: "https://www.jasoninc.com/careers/",
      scrape_notes: "Updated from generic Google search URL to official portal"
    })
    .eq("company_name", "Jason");
  console.log("  - Updated Jason:", jasonErr ? jasonErr.message : "OK");

  // B. Backpack International Pvt Ltd
  const { error: backpackErr } = await supabase
    .from("company_ats_config")
    .update({
      provider: "none",
      board_token_or_url: "",
      scrape_notes: "Cleared generic Google search URL; no automated ATS board"
    })
    .eq("company_name", "Backpack International Pvt Ltd");
  console.log("  - Updated Backpack International Pvt Ltd:", backpackErr ? backpackErr.message : "OK");

  // C. Delete garbage dummy names (. and S and Startup)
  const dummyNames = [".", "S", "Startup"];
  for (const dummy of dummyNames) {
    const { error: delErr } = await supabase
      .from("company_ats_config")
      .delete()
      .eq("company_name", dummy);
    console.log(`  - Deleted dummy company "${dummy}":`, delErr ? delErr.message : "OK");
  }

  // Double check any remaining non-Google company in company_ats_config with google.com
  const { data: remainingGoogleConfigs } = await supabase
    .from("company_ats_config")
    .select("id, company_name, board_token_or_url")
    .ilike("board_token_or_url", "%google.com%")
    .neq("company_name", "Google");

  if (remainingGoogleConfigs && remainingGoogleConfigs.length > 0) {
    console.log(`  Found ${remainingGoogleConfigs.length} remaining non-Google configs with google.com:`);
    for (const r of remainingGoogleConfigs) {
      console.log(`    Resetting ${r.company_name} [${r.board_token_or_url}] -> provider: none`);
      await supabase
        .from("company_ats_config")
        .update({
          provider: "none",
          board_token_or_url: "",
          scrape_notes: "Cleared generic Google URL"
        })
        .eq("id", r.id);
    }
  } else {
    console.log("  No other non-Google configs have google.com in company_ats_config.");
  }

  // 2. Clean user_target_companies
  console.log("\n▶ 2. Cleaning user_target_companies generic Google links...");
  const { data: targets } = await supabase
    .from("user_target_companies")
    .select("id, company_name, ats_board_token, careers_url")
    .or("ats_board_token.ilike.%google.com%,careers_url.ilike.%google.com%")
    .neq("company_name", "Google");

  if (targets && targets.length > 0) {
    for (const t of targets) {
      console.log(`  Fixing target: ${t.company_name} (token=${t.ats_board_token}, url=${t.careers_url})`);
      if (t.company_name.toLowerCase() === "hp" || t.company_name.toLowerCase() === "hp inc.") {
        await supabase
          .from("user_target_companies")
          .update({
            ats_provider: "custom",
            ats_board_token: "https://jobs.hp.com/",
            careers_url: "https://jobs.hp.com/",
            scrape_status: "pending",
            scrape_notes: "Updated from generic Google careers search to official HP jobs portal"
          })
          .eq("id", t.id);
        console.log(`    Set ${t.company_name} to official HP jobs portal`);
      } else {
        await supabase
          .from("user_target_companies")
          .update({
            ats_provider: "none",
            ats_board_token: null,
            careers_url: null,
            scrape_status: "needs_url",
            scrape_notes: "Cleared generic Google URL; please provide direct careers URL"
          })
          .eq("id", t.id);
        console.log(`    Reset ${t.company_name} to needs_url`);
      }
    }
  } else {
    console.log("  No non-Google targets have google.com in user_target_companies.");
  }

  // 3. Clean scraped_jobs
  console.log("\n▶ 3. Cleaning scraped_jobs non-Google jobs with Google URLs...");
  const { data: invalidJobs } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, url")
    .ilike("url", "%google.com%")
    .neq("company", "Google");

  if (invalidJobs && invalidJobs.length > 0) {
    console.log(`  Found ${invalidJobs.length} invalid non-Google jobs with Google URLs:`);
    for (const j of invalidJobs) {
      console.log(`    Deleting: [${j.company}] "${j.title}" -> ${j.url}`);
      await supabase.from("scraped_jobs").delete().eq("id", j.id);
    }
  } else {
    console.log("  No invalid non-Google jobs with Google URLs found in scraped_jobs.");
  }

  console.log("\n======================================================");
  console.log("✅ GOOGLE.COM LINK CLEANUP COMPLETE");
  console.log("======================================================");
}

main().catch(console.error);
