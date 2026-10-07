import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  const supabase = createAdminClient();

  const { data: configs } = await supabase.from("company_ats_config").select("*");
  const { data: jobs } = await supabase.from("scraped_jobs").select("company");
  const { data: users } = await supabase.from("users").select("company");

  const jobCounts: Record<string, number> = {};
  for (const j of jobs || []) {
    if (!j.company) continue;
    jobCounts[j.company] = (jobCounts[j.company] || 0) + 1;
  }

  const userCounts: Record<string, number> = {};
  for (const u of users || []) {
    if (!u.company) continue;
    userCounts[u.company] = (userCounts[u.company] || 0) + 1;
  }

  console.log(`Total configs: ${configs?.length}`);
  console.log(`Total scraped jobs: ${jobs?.length}`);
  console.log(`Total users: ${users?.length}`);

  // Check specific test cases mentioned by user:
  const testCompanies = [
    "Dell", "dell", "Dell Technologies", "dell technologies",
    "Microsoft", "Microsoft Corporation", "Microsoft (Last Company)",
    "Wipro", "Wipro Limited", "Wipro Technologies",
    "Amazon", "amazon",
    "TCS", "Tcs", "Tata Consultancy Services", "Tata Consultancy Services (TCS)", "TCS (Tata Consultancy Services)",
    "PwC", "PricewaterhouseCoopers (PwC)", "PwC (PricewaterhouseCoopers)", "PricewaterhouseCoopers (PwC) India",
    "Infosys", "Infosys Ltd.", "Infosys Ltd",
    "IBM", "Ibm", "IBM Corporation", "Ibm India Pvt LLimited.",
    "Google", "Google Inc.",
    "Deloitte", "Deloitte Consulting", "Deloitte Touché Tohmatsu India LLP",
    "Wells Fargo", "Wellsfargo",
    "Kotak Mahindra Bank", "Kotak Mahindra Bank Ltd",
    "Cognizant", "Cognizant Technology Solutions",
    "Verint Systems", "Verint systems Pvt Ltd",
    "State Bank of India", "State Bank of India (SBI)",
    "Zoho", "Zoho Corporation"
  ];

  console.log("\n--- Specific Duplicate Candidates Audit ---");
  for (const name of testCompanies) {
    const cfg = (configs || []).find(c => c.company_name.toLowerCase() === name.toLowerCase());
    if (cfg) {
      console.log(`• Config: "${cfg.company_name}" [${cfg.provider}] | Board: "${cfg.board_token_or_url}" | DB jobs_found: ${cfg.total_jobs_found} | Actual scraped_jobs: ${jobCounts[cfg.company_name] || 0} | Users: ${userCounts[cfg.company_name] || 0}`);
    }
  }
}

main().catch(console.error);
