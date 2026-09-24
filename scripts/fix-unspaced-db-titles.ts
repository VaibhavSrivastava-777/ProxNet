import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function repairUnspacedTitles() {
  console.log("================================================================================");
  console.log("🛠️ REPAIRING UNSPACED JOB TITLES IN SCRAPED_JOBS");
  console.log("================================================================================\n");

  const supabase = createAdminClient();
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  // 1. Find all jobs with unspaced titles (length > 10 and no spaces)
  const { data: jobs, error } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, url");

  if (error || !jobs) {
    console.error("Failed to query scraped_jobs:", error);
    process.exit(1);
  }

  const unspacedJobs = jobs.filter(j => {
    const t = j.title || "";
    return t.length > 10 && !t.includes(" ");
  });

  console.log(`Found ${unspacedJobs.length} jobs with unspaced titles that need formatting.\n`);

  if (unspacedJobs.length === 0) {
    console.log("✅ No unspaced titles found!");
    return;
  }

  // Batch process in chunks of 50
  const BATCH_SIZE = 50;
  let totalFixed = 0;

  for (let i = 0; i < unspacedJobs.length; i += BATCH_SIZE) {
    const chunk = unspacedJobs.slice(i, i + BATCH_SIZE);
    const titleList = chunk.map(c => ({ id: c.id, company: c.company, rawTitle: c.title, url: c.url }));

    const prompt = `You are a job board data hygiene engine.
You are given a JSON array of job records whose titles were accidentally stripped of word spaces (e.g. "enterprisecustomersuccessmanager" -> "Enterprise Customer Success Manager", "seniormanagerceosoffice" -> "Senior Manager - CEO's Office", "managerbusinessfinance" -> "Manager - Business Finance").

Records:
${JSON.stringify(titleList.map(t => ({ id: t.id, company: t.company, rawTitle: t.rawTitle, url: t.url })))}

Instructions:
1. Return a JSON object with a "results" array.
2. For each item, provide { "id": string, "cleanTitle": string }.
3. "cleanTitle" MUST be the natural English job title with correct spaces, title capitalization, and hyphens/parentheses where appropriate.
4. Do NOT include company name in cleanTitle unless it's part of the actual team/role name (e.g. "Meesho AI Services").

Return ONLY valid JSON format:
{
  "results": [
    { "id": "...", "cleanTitle": "..." }
  ]
}`;

    try {
      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!oaiRes.ok) {
        console.error(`OpenAI error on batch ${i}: ${oaiRes.status}`);
        continue;
      }

      const oaiData = await oaiRes.json();
      const content = oaiData.choices[0]?.message?.content;
      const parsed = JSON.parse(content);
      const results: Array<{ id: string; cleanTitle: string }> = parsed.results || [];

      for (const res of results) {
        if (res.id && res.cleanTitle && res.cleanTitle.includes(" ")) {
          const { error: updateErr } = await supabase
            .from("scraped_jobs")
            .update({ title: res.cleanTitle.trim() })
            .eq("id", res.id);

          if (!updateErr) {
            totalFixed++;
          }
        }
      }

      console.log(`  Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(unspacedJobs.length / BATCH_SIZE)} (Repaired ${totalFixed} titles so far)`);
    } catch (err: any) {
      console.error(`Error on batch ${i}:`, err.message);
    }
  }

  console.log("\n================================================================================");
  console.log(`✅ COMPLETED: Successfully repaired ${totalFixed}/${unspacedJobs.length} job titles in database!`);
  console.log("================================================================================\n");
}

repairUnspacedTitles().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
