import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  
  const { data: updated, error } = await supabase
    .from("users")
    .update({ is_active: false })
    .eq("id", "a2a05c8b-5a70-4212-990e-276b91219a24")
    .select("id, full_name, email, company, is_active");

  if (error) {
    console.error("Error updating user:", error);
    process.exit(1);
  }

  console.log("Updated user in database:", updated);
}

main();
