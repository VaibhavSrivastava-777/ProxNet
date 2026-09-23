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
  console.log("COLLECTING ALL COMPANIES AVAILABLE IN PROXNET");
  console.log("================================================================================\n");

  // 1. Fetch from company_ats_config
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("*");

  // 2. Fetch from users.company
  const { data: users } = await supabase
    .from("users")
    .select("company")
    .eq("is_active", true)
    .not("company", "is", null);

  const invalidStrings = ["retired", "student", "freelance", "self-employed", "n/a", "none", "independent advisory", "cron_status"];
  const userCompanies = new Set(
    (users || [])
      .map((u) => u.company?.trim())
      .filter((c): c is string => Boolean(c) && !invalidStrings.some((inv) => c.toLowerCase().includes(inv)))
  );

  // 3. Fetch from user_target_companies
  const { data: targetRows } = await supabase
    .from("user_target_companies")
    .select("company_name, ats_provider, ats_board_token, careers_url");

  // 4. Fetch scraped_jobs counts
  const { data: scrapedJobs } = await supabase
    .from("scraped_jobs")
    .select("company");

  const jobsCountByCompany = new Map<string, number>();
  for (const j of scrapedJobs || []) {
    if (!j.company) continue;
    const k = j.company.toLowerCase().trim();
    jobsCountByCompany.set(k, (jobsCountByCompany.get(k) || 0) + 1);
  }

  // Build master company list
  const masterCompanies = new Map<string, {
    displayName: string;
    provider?: string;
    boardTokenOrUrl?: string;
    jobsInDb: number;
    source: string[];
  }>();

  for (const c of configs || []) {
    if (invalidStrings.some((inv) => c.company_name.toLowerCase().includes(inv))) continue;
    const k = c.company_name.toLowerCase().trim();
    masterCompanies.set(k, {
      displayName: c.company_name,
      provider: c.provider,
      boardTokenOrUrl: c.board_token_or_url,
      jobsInDb: jobsCountByCompany.get(k) || 0,
      source: ["company_ats_config"],
    });
  }

  for (const comp of userCompanies) {
    const k = comp.toLowerCase().trim();
    if (masterCompanies.has(k)) {
      masterCompanies.get(k)!.source.push("user_company");
    } else {
      masterCompanies.set(k, {
        displayName: comp,
        jobsInDb: jobsCountByCompany.get(k) || 0,
        source: ["user_company"],
      });
    }
  }

  for (const t of targetRows || []) {
    const k = t.company_name.toLowerCase().trim();
    if (masterCompanies.has(k)) {
      masterCompanies.get(k)!.source.push("user_target_companies");
    } else {
      masterCompanies.set(k, {
        displayName: t.company_name,
        provider: t.ats_provider,
        boardTokenOrUrl: t.ats_board_token || t.careers_url,
        jobsInDb: jobsCountByCompany.get(k) || 0,
        source: ["user_target_companies"],
      });
    }
  }

  console.log(`Total Master Companies: ${masterCompanies.size}\n`);

  const list = Array.from(masterCompanies.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));

  console.log("| # | Company | Provider | Board / Token | Jobs in DB | Sources |");
  console.log("|---|---|---|---|---|---|");
  list.forEach((c, i) => {
    console.log(`| ${i + 1} | ${c.displayName} | ${c.provider || "none"} | ${c.boardTokenOrUrl ? (c.boardTokenOrUrl.length > 40 ? c.boardTokenOrUrl.slice(0, 37) + "..." : c.boardTokenOrUrl) : "none"} | ${c.jobsInDb} | ${c.source.join(", ")} |`);
  });
}

main().catch(console.error);
