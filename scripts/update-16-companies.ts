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
    { company: "Wells Fargo", provider: "workday", url: "https://wd1.myworkdaysite.com/recruiting/wf/WellsFargoJobs" },
    { company: "Capita", provider: "custom", url: "https://www.capita.com/careers" },
    { company: "Cognizant Technology Solutions", provider: "custom", url: "https://careers.cognizant.com/" },
    { company: "NPS HSR School", provider: "custom", url: "https://npshsr.com/careers.html" },
    { company: "McKinsey & Company", provider: "custom", url: "https://www.mckinsey.com/careers/search-jobs" },
    { company: "Rakuten India", provider: "custom", url: "https://corp.rakuten.co.in/careers/" },
    { company: "ThirdAct Labs Private Limited", provider: "custom", url: "https://thirdactlabs.ai/careers" },
    { company: "Applause", provider: "custom", url: "https://www.applause.com/jobs/" },
    { company: "Qorvo Semiconductor Private Limited", provider: "workday", url: "https://careers.qorvo.com/" },
    { company: "Opentext", provider: "phenom", url: "https://careers.opentext.com/us/en" },
    { company: "Fitsol", provider: "custom", url: "https://www.fitsol.co.uk/careers" },
    { company: "ECGC Limited", provider: "custom", url: "https://www.ecgc.in/" },
    { company: "Persistent Systems", provider: "custom", url: "https://careers.persistent.com/" },
    { company: "LSEG (London Stock Exchange Group)", provider: "workday", url: "https://www.lseg.com/en/careers" },
    { company: "Farcast Biosciences", provider: "none", url: "" },
    { company: "Optum", provider: "phenom", url: "https://www.optum.com/en/careers.html" },
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
}

main().catch(console.error);
