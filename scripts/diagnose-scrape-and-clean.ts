import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== 1. Checking company_ats_config for google.com links ===");
  const { data: configs, error: configErr } = await supabase
    .from("company_ats_config")
    .select("id, company_name, provider, board_token_or_url, last_scraped_at");

  if (configErr) {
    console.error("Config fetch error:", configErr);
    return;
  }

  const googleConfigs = (configs || []).filter(c =>
    (c.board_token_or_url || "").toLowerCase().includes("google")
  );
  console.log(`Configs with 'google': ${googleConfigs.length}`);
  for (const c of googleConfigs) {
    console.log(`  - ID: ${c.id} | [${c.company_name}] (${c.provider}): ${c.board_token_or_url}`);
  }

  console.log("\n=== 2. Checking user_target_companies for google.com links ===");
  const { data: targets, error: targetErr } = await supabase
    .from("user_target_companies")
    .select("id, company_name, ats_provider, ats_board_token, careers_url");

  if (targetErr) {
    console.error("Target fetch error:", targetErr);
  } else {
    const googleTargets = (targets || []).filter(t =>
      (t.ats_board_token || "").toLowerCase().includes("google") ||
      (t.careers_url || "").toLowerCase().includes("google")
    );
    console.log(`User targets with 'google': ${googleTargets.length}`);
    for (const t of googleTargets) {
      console.log(`  - ID: ${t.id} | [${t.company_name}]: token=${t.ats_board_token}, url=${t.careers_url}`);
    }
  }

  console.log("\n=== 3. Checking scraped_jobs with google.com for non-Google companies ===");
  const { data: nonGoogleJobs } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, url")
    .ilike("url", "%google.com%")
    .neq("company", "Google");

  console.log(`Non-Google jobs with google.com: ${nonGoogleJobs?.length}`);
  for (const j of nonGoogleJobs || []) {
    console.log(`  - [${j.company}] "${j.title}": ${j.url}`);
  }

  console.log("\n=== 4. Checking scraped_jobs breakdown ===");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: oldJobs } = await supabase.from('scraped_jobs').select('*', { count: 'exact', head: true }).lt('posted_at', thirtyDaysAgo);
  const { count: nullPosted } = await supabase.from('scraped_jobs').select('*', { count: 'exact', head: true }).is('posted_at', null);
  const { count: freshJobs } = await supabase.from('scraped_jobs').select('*', { count: 'exact', head: true }).gte('posted_at', thirtyDaysAgo);
  const { count: totalJobs } = await supabase.from('scraped_jobs').select('*', { count: 'exact', head: true });
  console.log('Total jobs:', totalJobs);
  console.log('Old jobs (<30d ago):', oldJobs);
  console.log('Null posted_at jobs:', nullPosted);
  console.log('Fresh jobs (>=30d):', freshJobs);

  console.log("\n=== 5. Grouping scraped_jobs by URL domain ===");
  // Fetch all URLs
  const { data: allJobUrls } = await supabase.from('scraped_jobs').select('id, url, company');
  const domains: Record<string, number> = {};
  for (const j of allJobUrls || []) {
    try {
      const u = new URL(j.url);
      domains[u.hostname] = (domains[u.hostname] || 0) + 1;
    } catch {
      domains['invalid_url'] = (domains['invalid_url'] || 0) + 1;
    }
  }
  const sortedDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]);
  console.log('Top 20 domains in scraped_jobs:');
  sortedDomains.slice(0, 20).forEach(([d, count]) => console.log(`  - ${d}: ${count}`));
}

main().catch(console.error);
