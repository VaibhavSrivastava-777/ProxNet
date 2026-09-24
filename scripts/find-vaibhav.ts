import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function findVaibhav() {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, job_title, company, resume_text, about, embedding, profile_digest")
    .ilike("full_name", "%vaibhav%");

  console.log(`Found ${users?.length || 0} users matching Vaibhav:`);
  for (const u of users || []) {
    console.log(`- ${u.full_name} (${u.email}) | ID: ${u.id} | Role: "${u.job_title}" | Company: "${u.company}" | Has embedding: ${Boolean(u.embedding)} | Resume: ${Boolean(u.resume_text)}`);
    console.log(`  Digest:`, JSON.stringify(u.profile_digest));
  }
}

findVaibhav();
