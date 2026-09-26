import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  // Find all job threads to collect their associated post IDs
  const { data: threads } = await supabase
    .from("job_threads")
    .select("id, post_id, responder_post_id");

  const threadPostIds = new Set<string>();
  for (const t of threads || []) {
    if (t.post_id) threadPostIds.add(t.post_id);
    if (t.responder_post_id) threadPostIds.add(t.responder_post_id);
  }

  console.log(`Found ${threadPostIds.size} thread post IDs.`);

  // Update these dummy/implicit thread posts to status: 'implicit' and is_public: false
  const idsToUpdate = Array.from(threadPostIds);
  const { data: updated, error } = await supabase
    .from("job_posts")
    .update({
      status: "implicit",
      is_public: false,
    })
    .in("id", idsToUpdate)
    .select("id, role, company, user:users!job_posts_user_id_fkey(full_name)");

  if (error) {
    console.error("Error updating implicit posts:", error);
    return;
  }

  console.log(`Successfully updated ${updated?.length || 0} implicit posts to status='implicit' and is_public=false:`);
  for (const p of updated || []) {
    console.log(` • Updated [${p.id}] ${(p as any).user?.full_name}: ${p.role} @ ${p.company}`);
  }
}

main().catch(console.error);
