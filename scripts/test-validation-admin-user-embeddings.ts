import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

function isVectorReady(u: any): boolean {
  if (u.has_embedding !== undefined) return Boolean(u.has_embedding);
  if (!u.embedding) return false;
  if (Array.isArray(u.embedding)) return u.embedding.length > 0;
  if (typeof u.embedding === "string") {
    const trimmed = (u.embedding as string).trim();
    return trimmed.length > 2 && trimmed !== "[]" && trimmed !== "null";
  }
  return false;
}

async function run() {
  console.log("================================================================================");
  console.log("🧪 VALIDATION TEST: Admin User Database & Embedding Match Readiness");
  console.log("================================================================================\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Fetch total users from DB
  const { data: users, error, count } = await supabase
    .from("users")
    .select("id, full_name, email, company, job_title, embedding", { count: "exact" });

  if (error) {
    console.error("❌ Database query error:", error);
    process.exit(1);
  }

  console.log(`Fetched ${users?.length} users from Supabase.`);

  let vectorReadyCount = 0;
  let missingVectorCount = 0;

  for (const u of users || []) {
    // Simulate what app/api/admin/users/route.ts returns:
    const hasEmbeddingAPI = Boolean(
      u.embedding &&
      (Array.isArray(u.embedding)
        ? u.embedding.length > 0
        : typeof u.embedding === "string"
        ? u.embedding.trim().length > 2 && u.embedding.trim() !== "[]" && u.embedding.trim() !== "null"
        : true)
    );

    const apiUser = {
      ...u,
      has_embedding: hasEmbeddingAPI,
      embedding: hasEmbeddingAPI ? "[VECTOR_READY]" : null,
    };

    // Simulate what UserTable.tsx evaluates:
    const isReadyUI = isVectorReady(apiUser);
    if (isReadyUI) {
      vectorReadyCount++;
    } else {
      missingVectorCount++;
      console.log(`  Missing: ${u.full_name} (${u.email})`);
    }
  }

  console.log(`\nVector Ready in UI: ${vectorReadyCount} / ${users?.length}`);
  console.log(`Missing Vector in UI: ${missingVectorCount} / ${users?.length}`);

  let passed = true;
  if (vectorReadyCount !== users?.length) {
    console.error(`❌ Expected all ${users?.length} users with vector to show 'Vector Ready', but ${missingVectorCount} were missing.`);
    passed = false;
  } else {
    console.log(`✅ All ${vectorReadyCount} of ${users?.length} users show 'Vector Ready' matching the Admin Cockpit!`);
  }

  console.log("\n================================================================================");
  console.log(`📊 TEST RESULT: ${passed ? "PASSED (100%)" : "FAILED"}`);
  console.log("================================================================================\n");

  if (!passed) process.exit(1);
}

run();
