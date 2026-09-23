import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { isSyntheticLinkedInUrl } from "../lib/linkedin/normalize-url";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("🧹 CLEANING UP SYNTHETIC LINKEDIN URLS IN DATABASE...\n");

  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, email, linkedin_sub, linkedin_profile_url");

  if (error) {
    console.error("Failed to query users:", error);
    process.exit(1);
  }

  const syntheticUsers = (users || []).filter((u) =>
    isSyntheticLinkedInUrl(u.linkedin_profile_url, u.linkedin_sub)
  );

  console.log(`Found ${syntheticUsers.length} users with synthetic sub-derived LinkedIn URLs:`);
  for (const u of syntheticUsers) {
    console.log(` - User ID: ${u.id} (${u.full_name}) -> URL: ${u.linkedin_profile_url}`);
  }

  if (syntheticUsers.length === 0) {
    console.log("\n✓ No synthetic LinkedIn URLs found in database. Clean state!");
    return;
  }

  console.log("\nResetting synthetic linkedin_profile_url to null for affected users...");
  for (const u of syntheticUsers) {
    const { error: updateError } = await supabase
      .from("users")
      .update({
        linkedin_profile_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", u.id);

    if (updateError) {
      console.error(`❌ Failed to reset URL for ${u.id}:`, updateError);
    } else {
      console.log(` ✓ Successfully reset linkedin_profile_url for user ${u.full_name} (${u.id})`);
    }
  }

  // Verification step
  const { data: verifyUsers } = await supabase
    .from("users")
    .select("id, full_name, linkedin_sub, linkedin_profile_url")
    .in(
      "id",
      syntheticUsers.map((u) => u.id)
    );

  const remaining = (verifyUsers || []).filter((u) =>
    isSyntheticLinkedInUrl(u.linkedin_profile_url, u.linkedin_sub)
  );

  if (remaining.length === 0) {
    console.log("\n🎉 ALL SYNTHETIC LINKEDIN URLS CLEANED UP SUCCESSFULLY!");
  } else {
    console.error(`\n⚠️ Warning: ${remaining.length} users still have synthetic URLs!`);
  }
}

main().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
