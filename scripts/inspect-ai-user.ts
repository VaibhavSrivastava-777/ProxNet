import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, anonymous_name, email, company, job_title, is_active");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const aiUsers = (users || []).filter(u => {
    const fn = (u.full_name || "").toLowerCase();
    const em = (u.email || "").toLowerCase();
    const cp = (u.company || "").toLowerCase();
    return fn.includes("proxnet") || em.includes("proxnet") || cp.includes("proxnet") || fn === "ai" || fn === "proxnet ai";
  });

  console.log("Matching users found:", aiUsers.length);
  for (const u of aiUsers) {
    console.log(u);
  }
}

main().catch(console.error);
