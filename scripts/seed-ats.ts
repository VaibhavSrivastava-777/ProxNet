import { createClient } from "@supabase/supabase-js";
import { companyMappings } from "../lib/anonymize";
import { discoverAts } from "../lib/ats-discovery";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  const force = process.argv.includes("--force");
  
  if (force) {
    console.log("Purging all dynamically discovered configurations (preserving custom configs)...");
    const { error: deleteError } = await supabase
      .from("company_ats_config")
      .delete()
      .neq("provider", "custom");
    if (deleteError) {
      console.error("Failed to purge configs:", deleteError.message);
      return;
    }
  }

  console.log("Fetching distinct companies from ProxNet network...");
  
  // Fetch existing companies from ProxNet network
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("company");

  if (userError) {
    console.error("Failed to fetch companies from users table", userError);
    return;
  }

  const networkCompanies = new Set(
    users.map(u => (u.company as string)?.trim()).filter((c): c is string => !!c)
  );

  // Add all statically known companies from the anonymize logic
  const staticCompanies = Object.keys(companyMappings);
  
  // Combine all unique companies
  const allCompanies = new Set([...networkCompanies, ...staticCompanies]);
  console.log(`Discovered ${allCompanies.size} unique companies. Proceeding to auto-discover ATS boards...`);

  let successCount = 0;
  let skipCount = 0;

  for (const company of allCompanies) {
    // Standardize company name visually
    const cleanCompany = typeof company === "string" ? company.trim() : "";
    if (!cleanCompany) continue;

    const formattedName = cleanCompany.charAt(0).toUpperCase() + cleanCompany.slice(1);
    
    // Attempt auto-discovery
    process.stdout.write(`Analyzing ${formattedName}... `);
    const ats = await discoverAts(cleanCompany);
    
    if (ats) {
      console.log(`✅ Found ${ats.provider.toUpperCase()} board (${ats.board})`);
      
      const { error } = await supabase
        .from("company_ats_config")
        .upsert({
          company_name: formattedName,
          provider: ats.provider,
          board_token_or_url: ats.board
        }, { onConflict: "company_name" });

      if (error) {
        console.error(`  ❌ Failed to upsert: ${error.message}`);
      } else {
        successCount++;
      }
    } else {
      console.log(`⏭️  No public board found. Marking as 'none'.`);
      
      // Seed placeholder config under provider 'none' to avoid checking again next time
      const { error } = await supabase
        .from("company_ats_config")
        .upsert({
          company_name: formattedName,
          provider: "none",
          board_token_or_url: "none"
        }, { onConflict: "company_name" });

      if (error) {
        console.error(`  ❌ Failed to upsert none-placeholder: ${error.message}`);
      }
      skipCount++;
    }
    
    // Add a tiny delay to respect rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 Done! Successfully seeded ${successCount} ATS configurations. (${skipCount} skipped/marked none)`);
}

seed();
