import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TARGET_USER_ID = "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!url || !key) {
    console.error("Missing Supabase URL or key");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Fetch user
  const { data: user } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, about, resume_text, embedding, profile_digest")
    .eq("id", TARGET_USER_ID)
    .single();

  console.log(`Candidate: ${user.full_name}`);
  console.log(`Role: ${user.job_title} @ ${user.company}`);
  console.log(`Target Companies: ${(user.profile_digest?.target_companies || []).join(", ")}`);

  // Ensure user embedding exists
  let userEmbedding = user.embedding;
  if (typeof userEmbedding === "string") {
    try { userEmbedding = JSON.parse(userEmbedding); } catch (e) {}
  }

  if (!userEmbedding && openaiKey) {
    console.log("Generating user embedding...");
    const denseContext = user.resume_text ? `Resume: ${user.resume_text}` : `About: ${user.about || ""}`;
    const textToEmbed = `Company: ${user.company || ""}\nRole: ${user.job_title || ""}\n${denseContext}`.slice(0, 8000);

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: textToEmbed,
        model: "text-embedding-3-small",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      userEmbedding = data.data[0].embedding;
      await supabase.from("users").update({ embedding: userEmbedding }).eq("id", TARGET_USER_ID);
    }
  }

  if (!Array.isArray(userEmbedding)) {
    console.error("No embedding array for user");
    process.exit(1);
  }

  // 2. Fetch all scraped jobs in DB
  const { data: jobs } = await supabase
    .from("scraped_jobs")
    .select("id, company, title, location, url, description, embedding, posted_at")
    .not("embedding", "is", null);

  console.log(`\nFound ${jobs?.length || 0} jobs with embeddings in scraped_jobs table.`);

  if (!jobs || jobs.length === 0) {
    console.log("No jobs found in scraped_jobs table.");
    process.exit(0);
  }

  // 3. Compute cosine similarity for all jobs
  const matches: Array<{
    id: string;
    company: string;
    title: string;
    location: string;
    url: string;
    similarity: number;
    matchRate: number;
  }> = [];

  for (const job of jobs) {
    let emb = job.embedding;
    if (typeof emb === "string") {
      try { emb = JSON.parse(emb); } catch (e) {}
    }
    if (Array.isArray(emb) && emb.length === userEmbedding.length) {
      const sim = cosineSimilarity(userEmbedding, emb);
      // Normalized match rate: OpenAI text-embedding-3-small similarity of ~0.35-0.65 maps to 40-100% match rate
      const matchRate = Math.min(99, Math.max(0, Math.round(((sim - 0.25) / 0.35) * 100)));
      matches.push({
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location || "Remote",
        url: job.url || "",
        similarity: sim,
        matchRate,
      });
    }
  }

  matches.sort((a, b) => b.matchRate - a.matchRate);

  console.log(`\n${"═".repeat(100)}`);
  console.log("TOP 20 JOB MATCHES FOR VAIBHAV SRIVASTAVA (NORMALIZED MATCH RATES)");
  console.log(`${"═".repeat(100)}`);
  console.log(
    "Match Rate".padEnd(12) +
    "Cos Sim".padEnd(10) +
    "Company".padEnd(25) +
    "Title".padEnd(40) +
    "Location"
  );
  console.log("─".repeat(100));

  matches.slice(0, 20).forEach(m => {
    console.log(
      `${m.matchRate}%`.padEnd(12) +
      `${(m.similarity).toFixed(2)}`.padEnd(10) +
      m.company.substring(0, 23).padEnd(25) +
      m.title.substring(0, 38).padEnd(40) +
      m.location.substring(0, 18)
    );
  });

  console.log("─".repeat(100));

  const highMatches = matches.filter(m => m.matchRate >= 60);
  console.log(`\n🎉 Summary: Out of ${matches.length} jobs evaluated, ${highMatches.length} have ≥60% match rate for Vaibhav Srivastava!`);

  if (highMatches.length > 0) {
    console.log(`\nHigh Match Roles (≥60%):`);
    highMatches.slice(0, 10).forEach(m => {
      console.log(`  🔥 ${m.matchRate}% match (sim: ${m.similarity.toFixed(2)}): ${m.title} at ${m.company}`);
      if (m.url) console.log(`     URL: ${m.url}`);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
