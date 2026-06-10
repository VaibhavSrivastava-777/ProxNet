/**
 * Run: npx tsx scripts/seed-admin.ts
 * Requires ADMIN_SU_ID, ADMIN_SU_PWD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const suId = process.env.ADMIN_SU_ID;
  const suPwd = process.env.ADMIN_SU_PWD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!suId || !suPwd || !url || !key) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const passwordHash = await bcrypt.hash(suPwd, 12);

  const { data: existing } = await supabase
    .from("admin_credentials")
    .select("id")
    .eq("su_id", suId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("admin_credentials")
      .update({ password_hash: passwordHash })
      .eq("su_id", suId);
    if (error) {
      console.error("Update failed:", error.message, error);
      process.exit(1);
    }
    console.log("Admin password updated for", suId);
  } else {
    const { error } = await supabase.from("admin_credentials").insert({
      su_id: suId,
      password_hash: passwordHash,
    });
    if (error) {
      console.error("Insert failed:", error.message, error);
      process.exit(1);
    }
    console.log("Admin created:", suId);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
