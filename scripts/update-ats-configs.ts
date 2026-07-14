import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const UPDATES = [
  // 1. Working Workday Scrapers
  { company_name: "LSEG (London Stock Exchange Group)", provider: "workday", board_token_or_url: "lseg.wd3.myworkdayjobs.com/wday/cxs/lseg/Careers/jobs" },
  { company_name: "Dell Technologies", provider: "workday", board_token_or_url: "dell.wd1.myworkdayjobs.com/wday/cxs/dell/External/jobs" },
  { company_name: "Accenture", provider: "workday", board_token_or_url: "accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs" },
  { company_name: "Diageo", provider: "workday", board_token_or_url: "diageo.wd3.myworkdayjobs.com/wday/cxs/diageo/Diageo_Careers/jobs" },
  { company_name: "Wellsfargo", provider: "workday", board_token_or_url: "wf.wd1.myworkdayjobs.com/wday/cxs/wf/WellsFargoJobs/jobs" },
  { company_name: "Vodafone India Services", provider: "workday", board_token_or_url: "vodafoneindiaservices.wd3.myworkdayjobs.com/wday/cxs/vodafoneindiaservices/VodafoneindiaservicesCareers/jobs" },

  // 2. Working Custom/Greenhouse Scrapers
  { company_name: "TCS", provider: "custom", board_token_or_url: "https://ibegin.tcsapps.com/iBegin/" },
  { company_name: "Tcs", provider: "custom", board_token_or_url: "https://ibegin.tcsapps.com/iBegin/" },
  { company_name: "Amazon", provider: "custom", board_token_or_url: "https://www.amazon.jobs/en/search" },
  { company_name: "Wipro", provider: "custom", board_token_or_url: "https://careers.wipro.com/" },
  { company_name: "Zscaler", provider: "greenhouse", board_token_or_url: "zscaler" },
  { company_name: "Microsoft", provider: "custom", board_token_or_url: "https://careers.microsoft.com/us/en/search-results" },
  { company_name: "Oracle", provider: "custom", board_token_or_url: "https://careers.oracle.com/jobs/" },

  // 3. Qorvo SuccessFactors Sitemap
  { company_name: "Qorvo Semiconductor Private Limited", provider: "successfactors_sitemap", board_token_or_url: "https://careers.qorvo.com/sitemap-jobs.xml" },

  // 4. Custom Scrapers and fallbacks for other companies
  { company_name: "Kotak Mahindra Bank Ltd", provider: "custom", board_token_or_url: "https://www.kotak.com/en/about-us/careers.html" },
  { company_name: "Opentext", provider: "custom", board_token_or_url: "https://careers.opentext.com" },
  { company_name: "Foradian technologies Pvt Ltd", provider: "custom", board_token_or_url: "https://www.foradian.com/" },
  { company_name: "Hera", provider: "custom", board_token_or_url: "https://www.gruppohera.it/en/group/career" },
  { company_name: "Verint systems Pvt Ltd", provider: "custom", board_token_or_url: "https://www.verint.com/about-verint/careers/" },
  { company_name: "Coverself", provider: "custom", board_token_or_url: "https://www.coverself.com/careers" },
  { company_name: "Capita", provider: "custom", board_token_or_url: "https://www.capita.com/careers" },
  { company_name: "Fitsol", provider: "custom", board_token_or_url: "https://fitsol.in/" },
  { company_name: "ECGC LIMITED", provider: "custom", board_token_or_url: "https://www.ecgc.in/" },
  { company_name: "Cognizant Technology Solutions", provider: "custom", board_token_or_url: "https://careers.cognizant.com/" },
  { company_name: "Persistent Systems", provider: "custom", board_token_or_url: "https://www.persistent.com/careers/" },
  { company_name: "Farcast Biosciences", provider: "custom", board_token_or_url: "https://farcastbio.com/" },
  { company_name: "Optum", provider: "custom", board_token_or_url: "https://careers.unitedhealthgroup.com/" },
  { company_name: "Rakuten India", provider: "custom", board_token_or_url: "https://rakuten-india.zwayam.com/" },
  { company_name: "Applause", provider: "custom", board_token_or_url: "https://www.applause.com/careers" },
  { company_name: "IBM", provider: "custom", board_token_or_url: "https://www.ibm.com/careers/" },
  { company_name: "EY", provider: "custom", board_token_or_url: "https://www.ey.com/en_gl/careers" },
  { company_name: "Independent Advisory Practice", provider: "custom", board_token_or_url: "https://careers.independentadvisorypractice.com" },
  { company_name: "MediaTek", provider: "custom", board_token_or_url: "https://www.mediatek.com/careers" },
  { company_name: "Ujjivan Small Finance Bank", provider: "custom", board_token_or_url: "https://www.ujjivansfb.in/careers" },
  { company_name: "TNIFMC", provider: "custom", board_token_or_url: "https://tnifmc.com/" },
  { company_name: "ProxNet", provider: "custom", board_token_or_url: "https://proxnet.io/careers" },
  { company_name: "NPS HSR", provider: "custom", board_token_or_url: "http://npshsr.com/" },
  { company_name: "Retired", provider: "custom", board_token_or_url: "https://careers.retired.com" },
  { company_name: "ThirdAct Labs Private Limited", provider: "custom", board_token_or_url: "https://thirdact.in/" },
  { company_name: "McKinsey and company", provider: "custom", board_token_or_url: "https://www.mckinsey.com/careers" }
];

async function main() {
  console.log(`Starting to update ${UPDATES.length} ATS configurations in Supabase...`);
  
  for (const item of UPDATES) {
    const { error } = await supabase
      .from("company_ats_config")
      .upsert(item, { onConflict: "company_name" });

    if (error) {
      console.error(`  ❌ Failed to update ${item.company_name}:`, error.message);
    } else {
      console.log(`  ✅ Updated ${item.company_name} -> provider: ${item.provider}`);
    }
  }

  console.log("\nDone updating ATS configurations!");
}

main();
