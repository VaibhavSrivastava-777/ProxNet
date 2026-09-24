import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function checkEmbeddings() {
  const supabase = createAdminClient();

  const { count: totalCount } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true });

  const { count: withEmbedding } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  const { count: withoutEmbedding } = await supabase
    .from("scraped_jobs")
    .select("*", { count: "exact", head: true })
    .is("embedding", null);

  console.log(`Total jobs in DB: ${totalCount}`);
  console.log(`Jobs with embedding: ${withEmbedding}`);
  console.log(`Jobs without embedding: ${withoutEmbedding}`);
}

checkEmbeddings();
