import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createAdminClient } from "../lib/supabase/admin";

async function backfillJobEmbeddings() {
  console.log("================================================================================");
  console.log("⚡ BACKFILLING OPENAI EMBEDDINGS FOR ALL SCRAPED JOBS");
  console.log("================================================================================\n");

  const supabase = createAdminClient();
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_KEY) {
    console.error("❌ Missing OPENAI_API_KEY in environment!");
    process.exit(1);
  }

  // 1. Fetch all jobs where embedding is null
  const { data: jobs, error } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, location, description")
    .is("embedding", null);

  if (error) {
    console.error("Failed to query scraped_jobs:", error);
    process.exit(1);
  }

  const totalToProcess = jobs?.length || 0;
  console.log(`Found ${totalToProcess} jobs without embeddings.\n`);

  if (totalToProcess === 0) {
    console.log("✅ All scraped jobs already have embeddings!");
    return;
  }

  const BATCH_SIZE = 50;
  let processedCount = 0;
  let successCount = 0;

  for (let i = 0; i < totalToProcess; i += BATCH_SIZE) {
    const chunk = jobs.slice(i, i + BATCH_SIZE);
    const inputs = chunk.map((job) => {
      const descSnippet = (job.description || "").replace(/<[^>]*>?/gm, " ").slice(0, 800);
      return `Company: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location || "India / Remote"}\nDetails: ${descSnippet}`.trim();
    });

    try {
      const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: inputs,
          model: "text-embedding-3-small",
        }),
      });

      if (!oaiRes.ok) {
        const errText = await oaiRes.text();
        console.error(`❌ OpenAI API Error on batch ${i / BATCH_SIZE + 1}: ${oaiRes.status} ${errText}`);
        continue;
      }

      const oaiData = await oaiRes.json();
      const embeddingList = oaiData.data;

      // Update chunk in DB
      for (let j = 0; j < chunk.length; j++) {
        const job = chunk[j];
        const embedding = embeddingList[j]?.embedding;
        if (embedding) {
          const { error: updateErr } = await supabase
            .from("scraped_jobs")
            .update({ embedding })
            .eq("id", job.id);

          if (!updateErr) {
            successCount++;
          } else {
            console.error(`   Failed to update job ${job.id}:`, updateErr.message);
          }
        }
      }

      processedCount += chunk.length;
      console.log(`  Processed ${processedCount}/${totalToProcess} jobs (${successCount} updated successfully)`);
    } catch (err: any) {
      console.error(`Error on batch ${i}:`, err.message);
    }
  }

  console.log("\n================================================================================");
  console.log(`✅ COMPLETED: Successfully embedded ${successCount}/${totalToProcess} jobs.`);
  console.log("================================================================================\n");
}

backfillJobEmbeddings().catch((err) => {
  console.error("Backfill script error:", err);
  process.exit(1);
});
