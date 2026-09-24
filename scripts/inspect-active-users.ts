import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function inspectUsers() {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, job_title, company, resume_text, about, embedding, profile_digest")
    .eq("is_active", true)
    .limit(10);

  console.log(`Found ${users?.length || 0} active users:`);
  for (const u of users || []) {
    console.log(`- ${u.full_name} (${u.email}) | Role: "${u.job_title}" | Company: "${u.company}" | Has embedding: ${Boolean(u.embedding)} | Resume: ${Boolean(u.resume_text)}`);
  }
}

inspectUsers();
