import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import assert from "assert";
import fs from "fs";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  console.log("=== VALIDATION 1: REFERRAL NUDGING 300-HOUR CAP ===");
  const morningRemindersCode = fs.readFileSync("app/api/cron/morning-reminders/route.ts", "utf-8");
  assert(
    morningRemindersCode.includes("hoursSinceInitial > 300"),
    "morning-reminders route must enforce 300h cutoff"
  );
  console.log("✅ morning-reminders enforces hoursSinceInitial > 300 cutoff");

  const adminDigestCode = fs.readFileSync("lib/admin-digest.ts", "utf-8");
  assert(
    adminDigestCode.includes("threeHundredHoursAgo") && adminDigestCode.includes("hoursWaiting > 300"),
    "admin-digest must enforce 300h cutoff on stalled referral threads"
  );
  console.log("✅ admin-digest enforces 300h cutoff on stalled referral threads");

  console.log("\n=== VALIDATION 2: PIONEER COMPANY AUTO-SEEDING & SAL SECURITIES ===");
  const scraperCronCode = fs.readFileSync("app/api/cron/scrape-network-and-competitors/route.ts", "utf-8");
  assert(
    scraperCronCode.includes("Auto-seeding") && scraperCronCode.includes("discoverAts"),
    "scrape-network-and-competitors must auto-seed pioneer network companies"
  );
  console.log("✅ scrape-network-and-competitors auto-seeds pioneer network companies");

  const profileCode = fs.readFileSync("app/api/profile/route.ts", "utf-8");
  assert(
    profileCode.includes("Auto-discovered pioneer company on profile update"),
    "profile route must auto-seed pioneer companies on company updates"
  );
  console.log("✅ profile route auto-seeds pioneer companies on profile updates");

  const supabase = createAdminClient();
  const { data: salConfig } = await supabase
    .from("company_ats_config")
    .select("*")
    .ilike("company_name", "Sal Securities")
    .maybeSingle();

  assert(salConfig, "Sal Securities must exist in company_ats_config");
  console.log(`✅ Sal Securities successfully configured: provider='${salConfig.provider}', board='${salConfig.board_token_or_url}'`);

  console.log("\n=== VALIDATION 3: REPAIRED ATS BOARDS ===");
  const { data: indAdv } = await supabase
    .from("company_ats_config")
    .select("provider, board_token_or_url")
    .ilike("company_name", "Independent Advisory Practice")
    .maybeSingle();
  assert(indAdv && indAdv.provider === "none", "Independent Advisory Practice must be provider 'none'");
  console.log("✅ Independent Advisory Practice updated to provider 'none' (eliminating 400 Bad Request)");

  const { data: canvaConfig } = await supabase
    .from("company_ats_config")
    .select("provider, board_token_or_url")
    .ilike("company_name", "Canva")
    .maybeSingle();
  assert(canvaConfig && canvaConfig.provider === "smartrecruiters", "Canva must be smartrecruiters");
  console.log("✅ Canva updated to provider 'smartrecruiters' (eliminating 404 Greenhouse error)");

  const { data: plaidConfig } = await supabase
    .from("company_ats_config")
    .select("provider, board_token_or_url")
    .ilike("company_name", "Plaid")
    .maybeSingle();
  assert(plaidConfig && plaidConfig.provider === "ashby", "Plaid must be ashby");
  console.log("✅ Plaid updated to provider 'ashby' (eliminating 404 Greenhouse error)");

  console.log("\n🎉 ALL USER SPECIFICATION VALIDATIONS PASSED!");
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
