import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Jobs created in last 24h, by company and source
  const counts = new Map<string, number>();
  let from = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("scraped_jobs")
      .select("company, ats_source")
      .gte("created_at", since)
      .range(from, from + page - 1);
    if (error) { console.error(error.message); break; }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const k = `${r.company} [${r.ats_source}]`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    if (data.length < page) break;
    from += page;
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  console.log(`\n=== Jobs created in last 24h: ${total} ===`);
  Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  ${k}`));

  // 2. company_ats_config scrape notes
  const { data: configs } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, last_scraped_at, total_jobs_found, scrape_notes")
    .order("last_scraped_at", { ascending: false, nullsFirst: false });

  console.log(`\n=== company_ats_config (${configs?.length}) ===`);
  const byProvider = new Map<string, number>();
  for (const c of configs || []) byProvider.set(c.provider, (byProvider.get(c.provider) || 0) + 1);
  console.log("Providers:", Object.fromEntries(byProvider));

  console.log("\nTop 25 by total_jobs_found:");
  [...(configs || [])]
    .sort((a, b) => (b.total_jobs_found || 0) - (a.total_jobs_found || 0))
    .slice(0, 25)
    .forEach((c) => console.log(`  ${String(c.total_jobs_found).padStart(6)}  ${c.company_name} [${c.provider}] last=${c.last_scraped_at}\n          ${c.scrape_notes}`));

  const recent = (configs || []).filter((c) => c.last_scraped_at && c.last_scraped_at >= since);
  console.log(`\nConfigs touched in last 24h: ${recent.length}`);
  const notesSummary = new Map<string, number>();
  for (const c of recent) {
    const n = (c.scrape_notes || "").replace(/\d+/g, "#").slice(0, 90);
    notesSummary.set(n, (notesSummary.get(n) || 0) + 1);
  }
  Array.from(notesSummary.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([n, v]) => console.log(`  ${v.toString().padStart(4)}  ${n}`));
}

main().catch(console.error);
