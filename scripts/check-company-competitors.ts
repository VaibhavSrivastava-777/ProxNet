import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function check() {
  const supabase = createAdminClient();
  const { data, error, count } = await supabase
    .from("company_competitors")
    .select("*", { count: "exact" });

  console.log("Result:", { error, count, rows: data });
}

check();
