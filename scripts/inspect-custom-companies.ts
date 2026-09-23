import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectCustom() {
  const { data: configs } = await supabase.from("company_ats_config").select("*");
  const { data: targetRows } = await supabase.from("user_target_companies").select("*");
  const { data: existingJobs } = await supabase.from("scraped_jobs").select("company");

  const countInDb = new Map<string, number>();
  (existingJobs || []).forEach(j => {
    if (!j.company) return;
    const k = j.company.toLowerCase().trim();
    countInDb.set(k, (countInDb.get(k) || 0) + 1);
  });

  const customProviders = ["custom", "workday", "phenom", "ibm", "oracle", "eightfold", "icims", "successfactors", "myworkdayjobs", "successfactors_sitemap"];

  const list: Array<{ name: string; provider: string; url: string; jobsInDb: number; notes?: string }> = [];

  for (const c of configs || []) {
    if (customProviders.includes(c.provider)) {
      list.push({
        name: c.company_name,
        provider: c.provider,
        url: c.board_token_or_url || "",
        jobsInDb: countInDb.get(c.company_name.toLowerCase().trim()) || 0,
        notes: c.scrape_notes,
      });
    }
  }

  for (const t of targetRows || []) {
    if (customProviders.includes(t.ats_provider) && !list.some(x => x.name.toLowerCase() === t.company_name.toLowerCase())) {
      list.push({
        name: t.company_name,
        provider: t.ats_provider,
        url: t.ats_board_token || t.careers_url || "",
        jobsInDb: countInDb.get(t.company_name.toLowerCase().trim()) || 0,
        notes: t.scrape_notes,
      });
    }
  }

  list.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Total Custom / Firecrawl Companies: ${list.length}`);
  console.log("| # | Company | Provider | Jobs in DB | URL |");
  console.log("|---|---|---|---|---|");
  list.forEach((c, idx) => {
    console.log(`| ${idx + 1} | ${c.name} | ${c.provider} | ${c.jobsInDb} | ${c.url} |`);
  });
}

inspectCustom().catch(console.error);
