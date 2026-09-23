import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { STRATEGIES } from "../lib/scrape-strategies";
import { discoverAts } from "../lib/ats-discovery";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("================================================================================");
  console.log("PART 1: CHECKING ALL USER_TARGET_COMPANIES IN DATABASE");
  console.log("================================================================================\n");

  const { data: userTargets, error: utcErr } = await supabase
    .from("user_target_companies")
    .select("*");

  if (utcErr) {
    console.error("Failed to query user_target_companies:", utcErr);
  } else {
    console.log(`Total rows in user_target_companies: ${userTargets?.length || 0}`);
    for (const r of userTargets || []) {
      console.log(`- [${r.company_name}] User: ${r.user_id}`);
      console.log(`    Provider: ${r.ats_provider} | Board/Token: ${r.ats_board_token || "NONE"}`);
      console.log(`    Careers URL: ${r.careers_url || "NONE"}`);
      console.log(`    Status: ${r.scrape_status} | Jobs Found: ${r.total_jobs_found}`);
      console.log(`    Notes: ${r.scrape_notes}`);
      console.log(`    Last Scraped: ${r.last_scraped_at}`);
      console.log("");
    }
  }

  console.log("\n================================================================================");
  console.log("PART 2: CHECKING ALL PROXNET NETWORK COMPANIES (company_ats_config & users)");
  console.log("================================================================================\n");

  const { data: atsConfigs } = await supabase
    .from("company_ats_config")
    .select("*");

  console.log(`Total records in company_ats_config: ${atsConfigs?.length || 0}`);

  const { data: scrapedJobs } = await supabase
    .from("scraped_jobs")
    .select("company, id");

  const jobsByCompany: Record<string, number> = {};
  for (const j of scrapedJobs || []) {
    if (!j.company) continue;
    const key = j.company.trim().toLowerCase();
    jobsByCompany[key] = (jobsByCompany[key] || 0) + 1;
  }

  console.log(`Total jobs in scraped_jobs table: ${scrapedJobs?.length || 0}`);

  const { data: usersWithCompany } = await supabase
    .from("users")
    .select("company")
    .not("company", "is", null);

  const invalidStrings = ["retired", "student", "freelance", "self-employed", "n/a", "none", "independent"];
  const userCompanies = Array.from(
    new Set(
      (usersWithCompany || [])
        .map((u) => u.company?.trim())
        .filter((c): c is string => Boolean(c) && !invalidStrings.some((inv) => c.toLowerCase().includes(inv)))
    )
  );

  console.log(`Total distinct user companies: ${userCompanies.length}`);

  // Combine all known companies
  const allCompaniesMap = new Map<string, {
    name: string;
    provider?: string;
    boardToken?: string;
    dbJobs: number;
    source: string[];
  }>();

  for (const config of atsConfigs || []) {
    const key = config.company_name.trim().toLowerCase();
    allCompaniesMap.set(key, {
      name: config.company_name,
      provider: config.provider,
      boardToken: config.board_token_or_url,
      dbJobs: jobsByCompany[key] || 0,
      source: ["company_ats_config"],
    });
  }

  for (const comp of userCompanies) {
    const key = comp.toLowerCase();
    if (allCompaniesMap.has(key)) {
      allCompaniesMap.get(key)!.source.push("user_company");
    } else {
      allCompaniesMap.set(key, {
        name: comp,
        dbJobs: jobsByCompany[key] || 0,
        source: ["user_company"],
      });
    }
  }

  for (const target of userTargets || []) {
    const key = target.company_name.trim().toLowerCase();
    if (allCompaniesMap.has(key)) {
      allCompaniesMap.get(key)!.source.push("user_target_companies");
    } else {
      allCompaniesMap.set(key, {
        name: target.company_name,
        provider: target.ats_provider,
        boardToken: target.ats_board_token || target.careers_url,
        dbJobs: jobsByCompany[key] || 0,
        source: ["user_target_companies"],
      });
    }
  }

  console.log(`\nTotal unique companies across ProxNet: ${allCompaniesMap.size}`);

  const zeroJobCompanies = Array.from(allCompaniesMap.values()).filter((c) => c.dbJobs === 0);
  const positiveJobCompanies = Array.from(allCompaniesMap.values()).filter((c) => c.dbJobs > 0);

  console.log(`Companies with >0 jobs in DB: ${positiveJobCompanies.length}`);
  console.log(`Companies with 0 jobs in DB: ${zeroJobCompanies.length}\n`);

  console.log("Sample of companies with 0 jobs:");
  for (const c of zeroJobCompanies.slice(0, 15)) {
    console.log(` - ${c.name} (Provider: ${c.provider || "unconfigured"}, Sources: ${c.source.join(", ")})`);
  }
}

main().catch(console.error);
