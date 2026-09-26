import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function inspectSampleRows() {
  const supabase = createAdminClient();

  const { data: jobs } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, description, url")
    .in("title", ["businessoperationslead", "managerbusinessfinance", "directorofcommercialsales"])
    .limit(5);

  for (const j of jobs || []) {
    console.log(`Company: ${j.company} | Title: ${j.title}`);
    console.log(`URL: ${j.url}`);
    console.log(`Description preview:\n${(j.description || "").slice(0, 300)}\n---`);
  }
}

inspectSampleRows();
