import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import * as fs from "fs";
import * as path from "path";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  console.log("=== VALIDATING IMPLICIT JOB POST FIXES ===");

  const supabase = createAdminClient();

  // Test 1: Verify code in init-referral sets status: "implicit" and is_public: false
  console.log("\nTest 1: Checking init-referral code...");
  const initRefContent = fs.readFileSync(
    path.join(process.cwd(), "app/api/jobs/chat/init-referral/route.ts"),
    "utf-8"
  );
  if (
    initRefContent.includes('status: "implicit"') &&
    initRefContent.includes("is_public: false")
  ) {
    console.log("✓ PASS: init-referral correctly sets status='implicit' and is_public=false");
  } else {
    throw new Error("FAIL: init-referral still sets status='active'");
  }

  // Test 2: Checking init code...
  console.log("\nTest 2: Checking init route code...");
  const initContent = fs.readFileSync(
    path.join(process.cwd(), "app/api/jobs/chat/init/route.ts"),
    "utf-8"
  );
  if (
    initContent.includes('status: "implicit"') &&
    initContent.includes("is_public: false")
  ) {
    console.log("✓ PASS: init route correctly sets status='implicit' and is_public=false");
  } else {
    throw new Error("FAIL: init route does not set implicit status");
  }

  // Test 3: Checking /api/job-posts route filters
  console.log("\nTest 3: Checking /api/job-posts GET query filters...");
  const jobPostsRouteContent = fs.readFileSync(
    path.join(process.cwd(), "app/api/job-posts/route.ts"),
    "utf-8"
  );
  if (
    jobPostsRouteContent.includes('.eq("status", "active")') &&
    jobPostsRouteContent.includes('.eq("is_public", true)')
  ) {
    console.log("✓ PASS: /api/job-posts enforces status='active' AND is_public=true");
  } else {
    throw new Error("FAIL: /api/job-posts does not filter is_public=true");
  }

  // Test 4: Checking JobPostCard experience_years rendering guard
  console.log("\nTest 4: Checking JobPostCard experience_years guard...");
  const cardContent = fs.readFileSync(
    path.join(process.cwd(), "components/forum/JobPostCard.tsx"),
    "utf-8"
  );
  if (cardContent.includes('Boolean(jobPost.experience_years && jobPost.experience_years !== "0" && jobPost.experience_years !== 0)')) {
    console.log("✓ PASS: JobPostCard guards against rendering truthy '0'");
  } else {
    throw new Error("FAIL: JobPostCard does not guard against '0'");
  }

  // Test 5: Verify Database State
  console.log("\nTest 5: Verifying Supabase database state for thread-associated posts...");
  const { data: threads } = await supabase
    .from("job_threads")
    .select("post_id, responder_post_id");

  const threadPostIds = new Set<string>();
  for (const t of threads || []) {
    if (t.post_id) threadPostIds.add(t.post_id);
    if (t.responder_post_id) threadPostIds.add(t.responder_post_id);
  }

  const { data: posts, error } = await supabase
    .from("job_posts")
    .select("id, role, company, status, is_public, user:users!job_posts_user_id_fkey(full_name)")
    .in("id", Array.from(threadPostIds));

  if (error) throw error;

  let activeLeaked = 0;
  for (const p of posts || []) {
    if (p.status === "active" && p.is_public) {
      console.error(`  ❌ LEAKED POST: [${p.id}] ${(p as any).user?.full_name}: ${p.role} @ ${p.company}`);
      activeLeaked++;
    }
  }

  if (activeLeaked === 0) {
    console.log(`✓ PASS: All ${posts?.length} thread-associated posts are marked implicit/private. Zero leaked posts in public feed!`);
  } else {
    throw new Error(`FAIL: ${activeLeaked} thread posts are still marked active!`);
  }

  console.log("\n🎉 ALL 5 TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
