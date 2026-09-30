import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: boards } = await supabase
    .from("company_ats_config")
    .select("*")
    .neq("provider", "cron_status")
    .order("company_name", { ascending: true });

  if (!boards) return;

  console.log(`Total boards in company_ats_config: ${boards.length}`);

  // Check 1: Provider counts
  const providerCounts: Record<string, number> = {};
  for (const b of boards) {
    providerCounts[b.provider] = (providerCounts[b.provider] || 0) + 1;
  }
  console.log("\nProvider distribution:", providerCounts);

  // Check 2: Any provider === 'none'?
  const noneBoards = boards.filter(b => b.provider === "none");
  console.log(`Boards with provider 'none': ${noneBoards.length}`);

  // Check 3: Any google search URLs?
  const googleSearchBoards = boards.filter(b => (b.board_token_or_url || "").includes("google.com/search"));
  console.log(`Boards with Google Search URLs: ${googleSearchBoards.length}`);

  // Check 4: Any empty board_token_or_url?
  const emptyTokenBoards = boards.filter(b => !(b.board_token_or_url || "").trim());
  console.log(`Boards with empty token or URL: ${emptyTokenBoards.length}`);

  // Check 5: Duplicate company names (case-insensitive)
  const nameMap = new Map<string, string[]>();
  for (const b of boards) {
    const key = b.company_name.toLowerCase().trim();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(b.company_name);
  }
  const duplicates = Array.from(nameMap.entries()).filter(([k, v]) => v.length > 1);
  console.log(`Duplicate company name clusters: ${duplicates.length}`);
  for (const [k, v] of duplicates) {
    console.log(`  - Duplicate cluster: ${JSON.stringify(v)}`);
  }
}

main();
