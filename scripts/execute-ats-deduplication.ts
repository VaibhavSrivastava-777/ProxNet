import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createAdminClient } from "../lib/supabase/admin";

interface DeduplicationTarget {
  canonicalName: string;
  provider?: string;
  boardTokenOrUrl?: string;
  duplicateNames: string[];
  reason: string;
}

const DEDUPLICATION_TARGETS: DeduplicationTarget[] = [
  {
    canonicalName: "Dell Technologies",
    provider: "oracle",
    boardTokenOrUrl: "https://iawmqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/careers/requisitions",
    duplicateNames: ["Dell", "dell", "dell technologies"],
    reason: "De-duplicate Dell variants to canonical 'Dell Technologies' [oracle]",
  },
  {
    canonicalName: "Microsoft",
    provider: "custom",
    boardTokenOrUrl: "https://jobs.careers.microsoft.com/global/en/search?lc=India",
    duplicateNames: ["Microsoft Corporation", "Microsoft (Last Company)"],
    reason: "De-duplicate Microsoft variants to canonical 'Microsoft' [custom]",
  },
  {
    canonicalName: "Amazon",
    provider: "amazon",
    boardTokenOrUrl: "https://www.amazon.jobs/en/search?loc_query=India",
    duplicateNames: ["amazon", "Amazon India"],
    reason: "De-duplicate Amazon variants to canonical title-cased 'Amazon' [amazon]",
  },
  {
    canonicalName: "Wipro",
    provider: "custom",
    boardTokenOrUrl: "https://careers.wipro.com/",
    duplicateNames: ["Wipro Limited", "Wipro Technologies"],
    reason: "De-duplicate Wipro variants to canonical 'Wipro' [custom]",
  },
  {
    canonicalName: "Tata Consultancy Services (TCS)",
    provider: "custom",
    boardTokenOrUrl: "https://careers.tcs.com/",
    duplicateNames: ["Tcs", "TCS", "Tata Consultancy Services", "TCS (Tata Consultancy Services)"],
    reason: "De-duplicate TCS variants to working 'Tata Consultancy Services (TCS)' [custom]",
  },
  {
    canonicalName: "PricewaterhouseCoopers (PwC)",
    provider: "custom",
    boardTokenOrUrl: "https://www.pwc.in/careers.html",
    duplicateNames: ["PwC", "PwC (PricewaterhouseCoopers)", "PricewaterhouseCoopers (PwC) India"],
    reason: "De-duplicate PwC variants to canonical 'PricewaterhouseCoopers (PwC)' [custom]",
  },
  {
    canonicalName: "Infosys Ltd.",
    provider: "custom",
    boardTokenOrUrl: "https://career.infosys.com/",
    duplicateNames: ["Infosys"],
    reason: "De-duplicate Infosys variants to 'Infosys Ltd.' [custom]",
  },
  {
    canonicalName: "IBM",
    provider: "custom",
    boardTokenOrUrl: "https://www.ibm.com/in-en/careers/search",
    duplicateNames: ["Ibm", "IBM Corporation", "Ibm India Pvt LLimited."],
    reason: "De-duplicate IBM variants to canonical 'IBM' [custom]",
  },
  {
    canonicalName: "Google",
    provider: "custom",
    boardTokenOrUrl: "https://careers.google.com/jobs/results/?location=India",
    duplicateNames: ["Google Inc."],
    reason: "De-duplicate Google variants to canonical 'Google' [custom]",
  },
  {
    canonicalName: "Deloitte",
    provider: "custom",
    boardTokenOrUrl: "https://www2.deloitte.com/global/en/pages/careers/topics/careers.html",
    duplicateNames: ["Deloitte Consulting", "Deloitte Touché Tohmatsu India LLP"],
    reason: "De-duplicate Deloitte variants to canonical 'Deloitte' [custom]",
  },
  {
    canonicalName: "Ernst & Young (EY)",
    provider: "custom",
    boardTokenOrUrl: "https://careers.ey.com/search/?q=&locationsearch=India",
    duplicateNames: ["EY", "EY (Ernst & Young)", "Ernst & Young (EY) India"],
    reason: "De-duplicate EY variants to canonical 'Ernst & Young (EY)' [custom]",
  },
  {
    canonicalName: "Kotak Mahindra Bank Ltd",
    provider: "oracle",
    boardTokenOrUrl: "https://hcbt.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions",
    duplicateNames: ["Kotak Mahindra Bank"],
    reason: "De-duplicate Kotak Mahindra Bank to 'Kotak Mahindra Bank Ltd' [oracle]",
  },
  {
    canonicalName: "Cognizant Technology Solutions",
    provider: "custom",
    boardTokenOrUrl: "https://careers.cognizant.com/",
    duplicateNames: ["Cognizant"],
    reason: "De-duplicate Cognizant to 'Cognizant Technology Solutions' [custom]",
  },
  {
    canonicalName: "Verint Systems",
    provider: "oracle",
    boardTokenOrUrl: "https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions",
    duplicateNames: ["Verint systems Pvt Ltd"],
    reason: "De-duplicate Verint systems Pvt Ltd to 'Verint Systems' [oracle]",
  },
  {
    canonicalName: "Wells Fargo",
    provider: "custom",
    boardTokenOrUrl: "https://www.wellsfargo.com/about/careers/",
    duplicateNames: ["Wellsfargo"],
    reason: "De-duplicate Wellsfargo to canonical 'Wells Fargo' [custom]",
  },
  {
    canonicalName: "State Bank of India (SBI)",
    provider: "custom",
    boardTokenOrUrl: "https://bank.sbi/careers",
    duplicateNames: ["State Bank of India"],
    reason: "De-duplicate State Bank of India to 'State Bank of India (SBI)' [custom]",
  },
  {
    canonicalName: "Zoho Corporation",
    provider: "custom",
    boardTokenOrUrl: "https://www.zoho.com/careers/",
    duplicateNames: ["Zoho"],
    reason: "De-duplicate Zoho to 'Zoho Corporation' [custom]",
  },
  {
    canonicalName: "Boston Consulting Group (BCG)",
    provider: "custom",
    boardTokenOrUrl: "https://www.bcg.com/careers",
    duplicateNames: ["Boston Consulting Group"],
    reason: "De-duplicate BCG variants to 'Boston Consulting Group (BCG)' [custom]",
  },
  {
    canonicalName: "Grant Thornton India",
    provider: "custom",
    boardTokenOrUrl: "https://www.grantthornton.in/careers/",
    duplicateNames: ["Grant Thornton"],
    reason: "De-duplicate Grant Thornton to 'Grant Thornton India' [custom]",
  },
  {
    canonicalName: "Hewlett Packard Enterprise (HPE)",
    provider: "custom",
    boardTokenOrUrl: "https://careers.hpe.com/",
    duplicateNames: ["Hewlett Packard Enterprise"],
    reason: "De-duplicate HPE variants to 'Hewlett Packard Enterprise (HPE)' [custom]",
  },
  {
    canonicalName: "HP Inc.",
    provider: "custom",
    boardTokenOrUrl: "https://jobs.hp.com/",
    duplicateNames: ["Hp"],
    reason: "De-duplicate Hp to 'HP Inc.' [custom]",
  },
  {
    canonicalName: "KPMG India",
    provider: "custom",
    boardTokenOrUrl: "https://home.kpmg/in/en/home/careers.html",
    duplicateNames: ["KPMG"],
    reason: "De-duplicate KPMG to 'KPMG India' [custom]",
  },
  {
    canonicalName: "Oracle",
    provider: "oracle",
    boardTokenOrUrl: "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch/requisitions",
    duplicateNames: ["Oracle Corporation"],
    reason: "De-duplicate Oracle Corporation to canonical 'Oracle' [oracle]",
  },
  {
    canonicalName: "Apple",
    provider: "custom",
    boardTokenOrUrl: "https://jobs.apple.com/en-in/search",
    duplicateNames: ["Apple Inc."],
    reason: "De-duplicate Apple Inc. to canonical 'Apple' [custom]",
  },
  {
    canonicalName: "BDO India",
    provider: "custom",
    boardTokenOrUrl: "https://www.bdo.in/en-gb/careers",
    duplicateNames: ["BDO"],
    reason: "De-duplicate BDO to 'BDO India' [custom]",
  },
  {
    canonicalName: "Bureau Veritas",
    provider: "custom",
    boardTokenOrUrl: "https://www.bureauveritas.com/careers",
    duplicateNames: ["Bureau Veritas (via Wrocus Technologies)"],
    reason: "Clean up informal Bureau Veritas user note to 'Bureau Veritas'",
  },
];

async function main() {
  const supabase = createAdminClient();
  console.log("======================================================");
  console.log("🧹 EXECUTING ATS BOARDS DE-DUPLICATION");
  console.log("======================================================\n");

  let totalDeleted = 0;
  let totalJobsUpdated = 0;
  let totalUsersUpdated = 0;

  for (const item of DEDUPLICATION_TARGETS) {
    console.log(`▶ Processing: ${item.canonicalName}`);

    // 1. Ensure canonical row exists in company_ats_config
    const { data: existingCanonical } = await supabase
      .from("company_ats_config")
      .select("*")
      .eq("company_name", item.canonicalName)
      .maybeSingle();

    if (!existingCanonical) {
      // If canonical doesn't exist yet, insert it or promote one of the duplicates
      console.log(`  + Creating canonical config for "${item.canonicalName}"...`);
      await supabase.from("company_ats_config").insert({
        company_name: item.canonicalName,
        provider: item.provider || "custom",
        board_token_or_url: item.boardTokenOrUrl || "",
        scrape_notes: `Created as canonical during de-duplication: ${item.reason}`,
      });
    } else if (item.provider && item.boardTokenOrUrl) {
      // Update with verified working provider/URL
      await supabase
        .from("company_ats_config")
        .update({
          provider: item.provider,
          board_token_or_url: item.boardTokenOrUrl,
        })
        .eq("company_name", item.canonicalName);
    }

    // 2. For each duplicate name, update scraped_jobs and users, then delete from company_ats_config
    for (const dup of item.duplicateNames) {
      if (dup === item.canonicalName) continue;

      // Update scraped_jobs
      const { data: updatedJobs, error: jobErr } = await supabase
        .from("scraped_jobs")
        .update({ company: item.canonicalName })
        .eq("company", dup)
        .select("id");

      if (updatedJobs && updatedJobs.length > 0) {
        totalJobsUpdated += updatedJobs.length;
        console.log(`    ↳ Migrated ${updatedJobs.length} scraped_jobs from "${dup}" to "${item.canonicalName}"`);
      }

      // Update users
      const { data: updatedUsers, error: userErr } = await supabase
        .from("users")
        .update({ company: item.canonicalName })
        .eq("company", dup)
        .select("id");

      if (updatedUsers && updatedUsers.length > 0) {
        totalUsersUpdated += updatedUsers.length;
        console.log(`    ↳ Migrated ${updatedUsers.length} users from "${dup}" to "${item.canonicalName}"`);
      }

      // Delete duplicate row from company_ats_config
      const { data: deletedRow, error: delErr } = await supabase
        .from("company_ats_config")
        .delete()
        .eq("company_name", dup)
        .select("company_name");

      if (deletedRow && deletedRow.length > 0) {
        totalDeleted += deletedRow.length;
        console.log(`    ❌ Deleted duplicate ATS config "${dup}"`);
      }
    }
    console.log("");
  }

  // Also remove purely junk entries where company_name is an activity rather than a company
  const junkNames = ["Retired", "Independent Advisory Practice", "CYB ENGINEER LLP", "Ex TCS n Tech Mahindra , Consulting"];
  for (const junk of junkNames) {
    const { data: del } = await supabase.from("company_ats_config").delete().eq("company_name", junk).select("company_name");
    if (del && del.length > 0) {
      totalDeleted += del.length;
      console.log(`❌ Deleted junk/non-company entry "${junk}"`);
    }
  }

  console.log("======================================================");
  console.log(`✅ DE-DUPLICATION COMPLETE`);
  console.log(`   • Duplicate ATS configs removed: ${totalDeleted}`);
  console.log(`   • Scraped jobs re-assigned to canonical companies: ${totalJobsUpdated}`);
  console.log(`   • Users aligned with canonical companies: ${totalUsersUpdated}`);
  console.log("======================================================");

  // Re-count active rows
  const { data: finalConfigs } = await supabase.from("company_ats_config").select("company_name");
  console.log(`Remaining unique ATS boards in company_ats_config: ${finalConfigs?.length}`);
}

main().catch(console.error);
