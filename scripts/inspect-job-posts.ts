import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();
  const { data: posts, error } = await supabase
    .from("job_posts")
    .select(`
      *,
      creator:users!job_posts_user_id_fkey(id, full_name, email, company, job_title, created_at)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Query error:", error);
    return;
  }

  console.log(`Found ${posts?.length || 0} job posts:`);
  for (const p of posts || []) {
    console.log("------------------------------------------");
    console.log(`Post ID: ${p.id}`);
    console.log(`Created At: ${p.created_at}`);
    console.log(`Creator: ${p.creator?.full_name} (${p.creator?.email})`);
    console.log(`Creator Company: ${p.creator?.company} | Title: ${p.creator?.job_title}`);
    console.log(`Type: ${p.type} | Status: ${p.status}`);
    console.log(`Role: ${p.role} | Company: ${p.company}`);
    console.log(`Description: "${p.description}" (typeof: ${typeof p.description})`);
    console.log(`Skills: "${p.skills}" | Exp: "${p.experience_years}"`);
    console.log(`Source/Meta: is_public=${p.is_public}, radius=${p.radius_meters}`);
  }
}

main().catch(console.error);
