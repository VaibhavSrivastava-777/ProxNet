import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const atsConfigs = [
  // Examples for Lever
  { company_name: "Stripe", provider: "lever", board_token_or_url: "stripe" },
  { company_name: "Figma", provider: "lever", board_token_or_url: "figma" },
  { company_name: "Notion", provider: "lever", board_token_or_url: "notionhq" },
  { company_name: "Netflix", provider: "lever", board_token_or_url: "netflix" },

  // Examples for Greenhouse
  { company_name: "Airbnb", provider: "greenhouse", board_token_or_url: "airbnb" },
  { company_name: "Twilio", provider: "greenhouse", board_token_or_url: "twilio" },
  { company_name: "Dropbox", provider: "greenhouse", board_token_or_url: "dropbox" },
  { company_name: "Pinterest", provider: "greenhouse", board_token_or_url: "pinterest" },
  { company_name: "Coinbase", provider: "greenhouse", board_token_or_url: "coinbase" },
];

async function seed() {
  console.log("Seeding ATS configs into database...");
  let successCount = 0;

  for (const config of atsConfigs) {
    const { error } = await supabase
      .from("company_ats_config")
      .upsert(config, { onConflict: "company_name" });

    if (error) {
      console.error(`❌ Failed to upsert ${config.company_name}:`, error.message);
    } else {
      console.log(`✅ Upserted ${config.company_name}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Done! Successfully seeded ${successCount} companies.`);
}

seed();
