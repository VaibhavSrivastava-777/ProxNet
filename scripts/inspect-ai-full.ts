import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: aiUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", "a2a05c8b-5a70-4212-990e-276b91219a24")
    .single();

  console.log("ProxNet AI user in DB:", aiUser);

  // Also check other user with company 'ProxNet' or 'Dell Technologies'
  const { data: proxnetUsers } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, is_active")
    .ilike("company", "%proxnet%");
  console.log("Users with company ProxNet:", proxnetUsers);
}

main().catch(console.error);
