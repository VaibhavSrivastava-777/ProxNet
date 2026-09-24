import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";
import { discoverAts, detectAtsFromUrl } from "../lib/ats-discovery";

async function diagnose() {
  console.log("================================================================================");
  console.log("🔍 FAST CONCURRENT DIAGNOSIS OF ALL 268+ COMPANIES IN company_ats_config");
  console.log("================================================================================\n");

  const supabase = createAdminClient();
  const { data: configs, error } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status");

  if (error || !configs) {
    console.error("Database error:", error);
    return;
  }

  console.log(`Auditing ${configs.length} companies with 10 concurrent workers...\n`);

  const updates: Array<{ id: string; company: string; oldP: string; newP: string; newBoard: string }> = [];
  let processed = 0;

  async function processCompany(c: any) {
    const isApi = ["greenhouse", "lever", "ashby", "workday", "oracle", "amazon", "ibm"].includes(c.provider?.toLowerCase());
    
    // 1. Direct URL check
    const urlAts = detectAtsFromUrl(c.board_token_or_url);
    if (urlAts && (urlAts.provider !== c.provider || urlAts.board !== c.board_token_or_url)) {
      updates.push({
        id: c.id,
        company: c.company_name,
        oldP: c.provider,
        newP: urlAts.provider,
        newBoard: urlAts.board,
      });
      return;
    }

    // 2. If it's custom or has zero jobs, probe
    if (!isApi || c.total_jobs_found === 0) {
      const discovered = await discoverAts(c.company_name);
      if (discovered && discovered.provider !== "none" && (discovered.provider !== c.provider || discovered.board !== c.board_token_or_url)) {
        updates.push({
          id: c.id,
          company: c.company_name,
          oldP: c.provider,
          newP: discovered.provider,
          newBoard: discovered.board,
        });
      }
    }
  }

  // Run in chunks of 12 parallel requests
  const CHUNK_SIZE = 12;
  for (let i = 0; i < configs.length; i += CHUNK_SIZE) {
    const chunk = configs.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(c => processCompany(c)));
    processed += chunk.length;
    process.stdout.write(`\rAudited ${processed}/${configs.length} companies... (Found ${updates.length} ATS upgrades so far)`);
  }

  console.log(`\n\n================================================================================`);
  console.log(`✅ AUDIT COMPLETE: Found ${updates.length} companies that can be upgraded to live API ATS!`);
  console.log(`================================================================================\n`);

  for (const u of updates) {
    console.log(`  • ${u.company}: [${u.oldP}] -> [${u.newP}] (board: ${u.newBoard})`);
  }

  // Apply updates to DB
  if (updates.length > 0) {
    console.log(`\nWriting ${updates.length} upgrades to company_ats_config...`);
    for (const u of updates) {
      await supabase
        .from("company_ats_config")
        .update({
          provider: u.newP,
          board_token_or_url: u.newBoard,
          scrape_notes: `Upgraded to ${u.newP} [${u.newBoard}] via ATS auto-discovery`,
        })
        .eq("id", u.id);
    }
    console.log(`✅ Successfully updated ${updates.length} ATS configurations in database!`);
  }
}

diagnose().catch(console.error);
