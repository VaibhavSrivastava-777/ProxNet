import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  // Find all job posts that are associated with job_threads as post_id or responder_post_id
  const { data: threads } = await supabase
    .from("job_threads")
    .select("id, post_id, responder_post_id, created_at");

  const threadPostIds = new Set<string>();
  for (const t of threads || []) {
    if (t.post_id) threadPostIds.add(t.post_id);
    if (t.responder_post_id) threadPostIds.add(t.responder_post_id);
  }

  console.log(`Found ${threads?.length || 0} job threads referencing ${threadPostIds.size} post IDs.`);

  // Check how many of these thread posts are currently status: 'active'
  const postIdsArray = Array.from(threadPostIds);
  const { data: posts, error } = await supabase
    .from("job_posts")
    .select("id, role, company, type, status, is_public, description, skills, experience_years, created_at, user:users!job_posts_user_id_fkey(full_name, email)")
    .in("id", postIdsArray);

  if (error) {
    console.error("Error fetching posts:", error);
    return;
  }

  console.log(`\nThread-associated posts: ${posts?.length || 0}`);
  let activeCount = 0;
  let implicitCount = 0;

  for (const p of posts || []) {
    const isImplicitCandidate = (p.description === null || p.description === "") && (p.skills === "" || p.skills === null);
    if (p.status === "active") activeCount++;
    if (p.status === "implicit") implicitCount++;

    console.log(` • [${p.status}] [${p.type}] Role: ${p.role} @ ${p.company} | User: ${(p as any).user?.full_name} | isImplicitCandidate: ${isImplicitCandidate} | is_public: ${p.is_public}`);
  }

  console.log(`\nSummary: Active=${activeCount}, Implicit=${implicitCount}`);
}

main().catch(console.error);
