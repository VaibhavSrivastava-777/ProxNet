import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env variables in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching active ProxNet companies from users table...");
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("company")
    .not("company", "is", null);

  if (userError) {
    console.error("Failed to fetch users:", userError.message);
    return;
  }

  const proxnetCompanies = Array.from(new Set(
    users.map((u: any) => u.company.trim().toLowerCase()).filter(Boolean)
  ));
  console.log(`Active ProxNet companies in users profiles (${proxnetCompanies.length}):`, proxnetCompanies);

  // 1. Clean company_ats_config
  console.log("Fetching all configurations from company_ats_config...");
  const { data: configs, error: configError } = await supabase
    .from("company_ats_config")
    .select("*");

  if (configError) {
    console.error("Failed to fetch configs:", configError.message);
    return;
  }

  const configsToDelete = configs.filter(c => {
    if (c.company_name === "cron_status" || c.provider === "cron_status") return false;
    return !proxnetCompanies.includes(c.company_name.toLowerCase().trim());
  });

  console.log(`Found ${configsToDelete.length} configurations to delete.`);
  for (const c of configsToDelete) {
    console.log(`Deleting config for: ${c.company_name} (ID: ${c.id})`);
    const { error } = await supabase
      .from("company_ats_config")
      .delete()
      .eq("id", c.id);
    if (error) {
      console.error(`Failed to delete config for ${c.company_name}:`, error.message);
    }
  }

  // 2. Clean scraped_jobs
  console.log("Cleaning scraped_jobs table...");
  const { data: jobs, error: jobsError } = await supabase
    .from("scraped_jobs")
    .select("company");

  if (jobsError) {
    console.error("Failed to fetch jobs:", jobsError.message);
    return;
  }

  const distinctJobCompanies = Array.from(new Set(
    jobs.map((j: any) => j.company).filter(Boolean)
  ));

  const jobCompaniesToDelete = distinctJobCompanies.filter(name => {
    return !proxnetCompanies.includes(name.toLowerCase().trim());
  });

  console.log(`Found ${jobCompaniesToDelete.length} companies with scraped jobs to delete:`, jobCompaniesToDelete);

  for (const comp of jobCompaniesToDelete) {
    console.log(`Deleting scraped jobs for company: ${comp}`);
    const { error } = await supabase
      .from("scraped_jobs")
      .delete()
      .eq("company", comp);
    if (error) {
      console.error(`Failed to delete jobs for ${comp}:`, error.message);
    } else {
      console.log(`Successfully deleted jobs for ${comp}`);
    }
  }

  console.log("Cleanup complete!");
}

run().catch(console.error);
