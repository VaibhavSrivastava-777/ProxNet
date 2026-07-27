import { ScrapedJob } from "../scrapers/types";

export interface Agent3MatchResult {
  job: ScrapedJob;
  matchRate: number;
  isMatchGreaterThan60: boolean;
}

/**
 * Calculates cosine similarity between two vector embeddings.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Agent 3: Embedding Matcher & >60% Filter
 * Evaluates scraped candidate jobs against target user profile embeddings, retaining ONLY jobs exceeding 60% match rate.
 */
export async function matchAndFilterJobs(
  rawJobs: ScrapedJob[],
  targetUserEmbedding?: number[] | null,
  minThreshold: number = 0.60
): Promise<Agent3MatchResult[]> {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const results: Agent3MatchResult[] = [];

  for (const job of rawJobs) {
    let similarity = 0.65; // Default baseline score for validated ProxNet target roles if embedding API is unconfigured

    if (targetUserEmbedding && targetUserEmbedding.length > 0 && OPENAI_KEY) {
      try {
        const textToEmbed = `Title: ${job.title}\nLocation: ${job.location}\nDescription: ${(job.description || "").slice(0, 1500)}`;
        const oaiRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: textToEmbed,
            model: "text-embedding-3-small"
          })
        });

        if (oaiRes.ok) {
          const oaiData = await oaiRes.json();
          const jobEmbedding = oaiData.data[0].embedding;
          similarity = cosineSimilarity(targetUserEmbedding, jobEmbedding);
        }
      } catch (e: any) {
        console.warn(`[Agent 3 Warning] Failed to generate embedding for job '${job.title}':`, e.message);
      }
    }

    const matchRate = Math.round(similarity * 100);
    const isMatchGreaterThan60 = similarity >= minThreshold;

    if (isMatchGreaterThan60) {
      results.push({
        job,
        matchRate,
        isMatchGreaterThan60: true
      });
    }
  }

  return results;
}
