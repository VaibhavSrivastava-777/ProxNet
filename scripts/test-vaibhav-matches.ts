import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function testMatchForVaibhav() {
  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, full_name, embedding")
    .eq("id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .single();

  if (!user || !user.embedding) {
    console.log("User or embedding not found");
    return;
  }

  const { data: matches, error } = await supabase.rpc("match_scraped_jobs", {
    query_embedding: user.embedding,
    match_threshold: 0.25,
    match_count: 50
  });

  if (error) {
    console.error("Match error:", error);
    return;
  }

  console.log(`Found ${matches?.length || 0} matched jobs currently for Vaibhav:`);
  const companies = new Set();
  for (const m of matches || []) {
    companies.add(m.company);
    console.log(`  - [${m.company}] ${m.title} (similarity: ${m.similarity?.toFixed(3)})`);
  }
  console.log(`Companies in match results (${companies.size}):`, Array.from(companies));
}

testMatchForVaibhav();
