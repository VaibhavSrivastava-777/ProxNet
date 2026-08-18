import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { discoverAts } from "../lib/ats-discovery";

dotenv.config({ path: ".env.local" });

const TARGET_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

async function testAddAndDelete() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("🔍 Fetching initial target companies for user:", TARGET_USER_ID);
  const { data: user } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", TARGET_USER_ID)
    .single();

  const initialTargets: string[] = user?.profile_digest?.target_companies || [];
  console.log("  Initial Targets:", initialTargets.join(", "));

  // 1. Test Adding a new company "Zscaler"
  const testCompany = "Zscaler";
  console.log(`\n➕ Adding target company "${testCompany}"...`);

  // Discover ATS
  const ats = await discoverAts(testCompany);
  console.log(`  ATS Discovered for ${testCompany}:`, ats);

  // Update profile_digest
  if (!initialTargets.includes(testCompany)) {
    initialTargets.push(testCompany);
    const updatedDigest = { ...user?.profile_digest, target_companies: initialTargets };
    await supabase.from("users").update({ profile_digest: updatedDigest }).eq("id", TARGET_USER_ID);
    console.log(`  ✅ Added "${testCompany}" to user profile_digest.`);
  }

  // 2. Verify addition
  const { data: userAfterAdd } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", TARGET_USER_ID)
    .single();
  console.log("  Targets After Add:", (userAfterAdd?.profile_digest?.target_companies || []).join(", "));

  // 3. Test Deleting the company "Zscaler"
  console.log(`\n➖ Removing target company "${testCompany}"...`);
  const finalTargets = (userAfterAdd?.profile_digest?.target_companies || []).filter(c => c !== testCompany);
  const finalDigest = { ...userAfterAdd?.profile_digest, target_companies: finalTargets };
  await supabase.from("users").update({ profile_digest: finalDigest }).eq("id", TARGET_USER_ID);

  const { data: userAfterDelete } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", TARGET_USER_ID)
    .single();
  console.log("  Targets After Delete:", (userAfterDelete?.profile_digest?.target_companies || []).join(", "));

  console.log("\n🎉 Target company add/delete test completed successfully!");
  process.exit(0);
}

testAddAndDelete().catch(e => { console.error(e); process.exit(1); });
