import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.prod' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const updates = [
    { company: "Capita", provider: "custom", url: "https://www.capita.com/careers/job-search" },
    { company: "Rakuten India", provider: "workday", url: "https://rakuten.wd1.myworkdayjobs.com/RakutenTech_Careers" },
    { company: "Qorvo Semiconductor Private Limited", provider: "workday", url: "https://qorvo.wd1.myworkdayjobs.com/qorvocareers" },
    { company: "Applause", provider: "workable", url: "https://apply.workable.com/applause/" },
    { company: "Cognizant Technology Solutions", provider: "phenom", url: "https://careers.cognizant.com/global/en/search-results" },
    { company: "McKinsey & Company", provider: "custom", url: "https://jobs.mckinsey.com/careers/SearchJobs/" },
    { company: "Opentext", provider: "phenom", url: "https://careers.opentext.com/us/en/search-results" },
    { company: "Persistent Systems", provider: "custom", url: "https://careers.persistent.com/search-jobs" },
    { company: "LSEG (London Stock Exchange Group)", provider: "workday", url: "https://lseglondonstockexchangegroup.wd3.myworkdayjobs.com/LseglondonstockexchangegroupCareers" },
    { company: "Optum", provider: "phenom", url: "https://careers.unitedhealthgroup.com/job-search-results/" },
    { company: "Fitsol", provider: "none", url: "" }
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from("company_ats_config")
      .update({ provider: update.provider, board_token_or_url: update.url })
      .eq("company_name", update.company);
      
    if (error) {
      console.error(`Failed to update ${update.company}:`, error);
    } else {
      console.log(`Updated ${update.company} to deep link ${update.url}`);
    }
  }
}

main().catch(console.error);
