import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function checkSalSecurities() {
  const supabase = createAdminClient();

  // 1. Check user who works at Sal Securities
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, company, created_at")
    .ilike("company", "%Sal Securities%");
  console.log("Users with Sal Securities:", users);

  // 2. Check company_ats_config for Sal Securities
  const { data: ats } = await supabase
    .from("company_ats_config")
    .select("*")
    .ilike("company_name", "%Sal Securities%");
  console.log("company_ats_config for Sal Securities:", ats);

  // 3. Check scraped_jobs for Sal Securities
  const { data: jobs } = await supabase
    .from("scraped_jobs")
    .select("id, title, company_name, location, posted_at, created_at")
    .ilike("company_name", "%Sal Securities%");
  console.log("scraped_jobs for Sal Securities:", jobs);
}

checkSalSecurities().catch(console.error);
