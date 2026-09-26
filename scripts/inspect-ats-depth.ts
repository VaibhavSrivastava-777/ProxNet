import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { STRATEGIES } from "../lib/scrape-strategies";

async function main() {
  const supabase = createAdminClient();

  // 1. Company ATS configs in DB
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("provider, company_name, board_token_or_url");

  const providerCounts = new Map<string, number>();
  const sampleCompanies = new Map<string, string[]>();

  for (const c of configs || []) {
    providerCounts.set(c.provider, (providerCounts.get(c.provider) || 0) + 1);
    if (!sampleCompanies.has(c.provider)) {
      sampleCompanies.set(c.provider, []);
    }
    if (sampleCompanies.get(c.provider)!.length < 5) {
      sampleCompanies.get(c.provider)!.push(c.company_name);
    }
  }

  console.log("=== COMPANY ATS CONFIGURATIONS ===");
  console.log(`Total configured companies: ${configs?.length || 0}`);
  for (const [provider, count] of Array.from(providerCounts.entries()).sort((a, b) => b[1] - a[1])) {
    const samples = sampleCompanies.get(provider)?.join(", ");
    console.log(` • ${provider.padEnd(22)}: ${count.toString().padStart(3)} companies (e.g. ${samples})`);
  }

  // 2. User target companies
  const { data: targets } = await supabase
    .from("user_target_companies")
    .select("company_name, ats_provider, ats_board_token, careers_url");

  const targetProviderCounts = new Map<string, number>();
  for (const t of targets || []) {
    const p = t.ats_provider || "none";
    targetProviderCounts.set(p, (targetProviderCounts.get(p) || 0) + 1);
  }

  console.log("\n=== USER TARGET COMPANIES ===");
  console.log(`Total user targets: ${targets?.length || 0}`);
  for (const [provider, count] of Array.from(targetProviderCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(` • ${provider.padEnd(22)}: ${count.toString().padStart(3)} targets`);
  }

  // 3. Registered code strategies
  console.log("\n=== CODEBASE STRATEGIES REGISTERED ===");
  console.log(Object.keys(STRATEGIES).join(", "));
}

main().catch(console.error);
