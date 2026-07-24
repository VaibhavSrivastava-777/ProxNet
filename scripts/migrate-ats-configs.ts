import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.prod' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const updates = [
    { company: "EY", provider: "successfactors_sitemap", url: "https://careers.ey.com/sitemap.xml" },
    { company: "Wipro", provider: "successfactors_sitemap", url: "https://careers.wipro.com/sitemap.xml" },
    { company: "Microsoft", provider: "phenom", url: "https://jobs.careers.microsoft.com/global/en/search" },
    { company: "IBM", provider: "ibm", url: "https://careers.ibm.com/" },
    { company: "Oracle", provider: "oracle", url: "https://careers.oracle.com/jobs/" },
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from("company_ats_config")
      .update({ provider: update.provider, board_token_or_url: update.url })
      .eq("company_name", update.company);
      
    if (error) {
      console.error(`Failed to update ${update.company}:`, error);
    } else {
      console.log(`Updated ${update.company} to ${update.provider}`);
    }
  }

  // Update Workday ones
  const { data: configs } = await supabase.from("company_ats_config").select("*");
  if (configs) {
    for (const c of configs) {
      if (c.board_token_or_url?.includes("wd3.myworkdayjobs.com") && c.provider !== "workday") {
        await supabase
          .from("company_ats_config")
          .update({ provider: "workday" })
          .eq("company_name", c.company_name);
        console.log(`Updated ${c.company_name} to workday provider`);
      }
    }
  }
}

main().catch(console.error);
