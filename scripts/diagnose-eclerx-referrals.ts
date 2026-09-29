import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("*");

  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  const { data: usersData } = await supabase.from('users').select('id, company, job_title').eq('is_active', true).limit(100);
  const foundIn100 = usersData?.find(u => u.company?.toLowerCase().includes('eclerx'));
  console.log('Is Eclerx in the first 100 rows?', !!foundIn100);
  if (!foundIn100) {
    console.log('Row index of Harsh Jaiswal in full list:');
    const idx = users?.findIndex(u => u.company?.toLowerCase().includes('eclerx'));
    console.log('Index:', idx);
  }

  const pramodUsers = users?.filter(u => u.full_name?.toLowerCase().includes("pramod") || u.job_title?.toLowerCase().includes("it analyst"));
  console.log("=== PRAMOD USERS ===");
  console.log(pramodUsers?.map(u => ({ id: u.id, name: u.full_name, company: u.company, title: u.job_title, active: u.is_active, alias: u.alias })));

  // Check jobs table structure or error
  const { data: jobs, error: jobsErr } = await supabase.from("jobs").select("*").limit(3);
  console.log("=== JOBS ERROR ===", jobsErr);
  console.log("=== JOBS SAMPLE ===", jobs);
}

main();
