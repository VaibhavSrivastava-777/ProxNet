export interface CandidateProfile {
  id?: string;
  job_title?: string | null;
  company?: string | null;
  about?: string | null;
  professional_bio?: string | null;
  resume_text?: string | null;
  tags?: string[] | null;
  profile_digest?: {
    skills?: string[];
    summary?: string;
    experienceYears?: number;
  } | null;
}

export interface JobToRerank {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  posted_at?: string | null;
  url?: string | null;
  rawSimilarity?: number;
}

export interface RerankedJobResult {
  id: string;
  score: number; // 0 - 100
  label: "Strong Match" | "Good Match" | "Moderate Match" | "Low Match";
  reason: string;
}

// In-memory cache for rerank results (TTL: 1 hour)
interface CachedScore {
  score: number;
  label: "Strong Match" | "Good Match" | "Moderate Match" | "Low Match";
  reason: string;
  timestamp: number;
}

const rerankCache = new Map<string, CachedScore>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getMatchLabel(score: number): "Strong Match" | "Good Match" | "Moderate Match" | "Low Match" {
  if (score >= 85) return "Strong Match";
  if (score >= 70) return "Good Match";
  if (score >= 50) return "Moderate Match";
  return "Low Match";
}

/**
 * Stage 2 Reranker: Evaluates candidate profile vs candidate jobs using gpt-4o-mini
 */
export async function rerankJobsForCandidate(
  candidate: CandidateProfile,
  jobs: JobToRerank[]
): Promise<Map<string, RerankedJobResult>> {
  const results = new Map<string, RerankedJobResult>();
  if (!jobs || jobs.length === 0) return results;

  const openaiKey = process.env.OPENAI_API_KEY;
  const now = Date.now();
  const candidateKey = candidate.id || `${candidate.job_title}_${candidate.company}`;

  // 1. Check cache for already evaluated pairs
  const uncachedJobs: JobToRerank[] = [];
  for (const job of jobs) {
    const cacheKey = `${candidateKey}::${job.id}`;
    const cached = rerankCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      results.set(job.id, {
        id: job.id,
        score: cached.score,
        label: cached.label,
        reason: cached.reason,
      });
    } else {
      uncachedJobs.push(job);
    }
  }

  if (uncachedJobs.length === 0) {
    return results;
  }

  // If no OpenAI key, fall back to conservative estimate
  if (!openaiKey) {
    for (const job of uncachedJobs) {
      const fallbackScore = Math.min(45, Math.round((job.rawSimilarity || 0.35) * 100));
      const result: RerankedJobResult = {
        id: job.id,
        score: fallbackScore,
        label: getMatchLabel(fallbackScore),
        reason: "Evaluated using basic profile overlap (AI reranker unavailable).",
      };
      results.set(job.id, result);
    }
    return results;
  }

  // 2. Batch uncached jobs in chunks of 8 to keep prompt concise and within token limits
  const BATCH_SIZE = 8;
  for (let i = 0; i < uncachedJobs.length; i += BATCH_SIZE) {
    const batch = uncachedJobs.slice(i, i + BATCH_SIZE);

    const candidateContext = `
CANDIDATE PROFILE:
- Current Title: ${candidate.job_title || "Unknown"}
- Current/Recent Company: ${candidate.company || "Unknown"}
- Profile Summary: ${candidate.profile_digest?.summary || candidate.about || candidate.professional_bio || "None provided"}
- Core Skills: ${(candidate.profile_digest?.skills || candidate.tags || []).join(", ") || "General"}
- Total Experience: ${candidate.profile_digest?.experienceYears ? `${candidate.profile_digest.experienceYears} years` : "Experienced"}
${candidate.resume_text ? `- Resume Excerpt: ${candidate.resume_text.slice(0, 1500)}` : ""}
`.trim();

    const jobsPayload = batch.map((j, idx) => ({
      index: idx + 1,
      jobId: j.id,
      title: j.title,
      company: j.company,
      location: j.location || "Remote",
      keywords: j.keywords || [],
      descriptionSnippet: (j.description || "").replace(/<[^>]*>?/gm, " ").slice(0, 600).trim(),
    }));

    const systemPrompt = `You are an expert AI talent recruiter. Your task is to accurately score how well each job opening matches the candidate's professional profile.

SCORING CRITERIA:
1. FUNCTIONAL DISCIPLINE ALIGNMENT (CRITICAL):
   - Completely different functional areas MUST receive LOW scores (< 40%).
   - Examples of mismatches:
     * Product Manager vs Software Engineer / DevOps / SRE (< 35%)
     * Product Manager vs Financial Analyst / Accountant (< 30%)
     * Product Manager vs Sales AE / Business Development (< 40%)
     * Software Engineer vs Marketing / HR (< 30%)
2. SENIORITY & LEVEL FIT:
   - Match candidate's career level (e.g. Lead/Staff vs Consultant/Senior vs Director).
3. DOMAIN & SKILL RELEVANCE:
   - Look for specific technical, product, industry, or domain overlaps (e.g. Cloud, SaaS, AI, B2B, Fintech).

SCORE SCALE:
- 85-100: "Strong Match" — Direct role match in same function with strong skill & domain alignment.
- 70-84:  "Good Match" — Same functional area with transferable skills and good relevance.
- 50-69:  "Moderate Match" — Adjacent role or partial overlap, but with noticeable gaps.
- 0-49:   "Low Match" — Cross-functional mismatch, unrelated discipline, or major seniority mismatch.

Return a JSON object formatted strictly as:
{
  "evaluations": [
    {
      "jobId": "...",
      "score": 88,
      "reason": "Direct product management fit with strong alignment in cloud infrastructure and enterprise SaaS."
    }
  ]
}
Each reason MUST be 1 clear, punchy sentence explaining the key alignment or mismatch.`;

    try {
      const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${candidateContext}\n\nEVALUATE THESE JOBS:\n${JSON.stringify(jobsPayload, null, 2)}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (oaiRes.ok) {
        const oaiData = await oaiRes.json();
        const content = JSON.parse(oaiData.choices[0]?.message?.content || "{}");
        const evals = content.evaluations || [];

        for (const ev of evals) {
          const score = typeof ev.score === "number" ? Math.min(100, Math.max(0, Math.round(ev.score))) : 30;
          const label = getMatchLabel(score);
          const reason = ev.reason || "Evaluated based on profile relevance.";

          const result: RerankedJobResult = {
            id: ev.jobId,
            score,
            label,
            reason,
          };

          results.set(ev.jobId, result);

          // Save to cache
          rerankCache.set(`${candidateKey}::${ev.jobId}`, {
            score,
            label,
            reason,
            timestamp: now,
          });
        }
      }
    } catch (err: any) {
      console.error("[Reranker] Batch evaluation error:", err.message);
    }

    // Ensure all batch items have a result even if individual parsing missed one
    for (const job of batch) {
      if (!results.has(job.id)) {
        const fallbackScore = Math.min(45, Math.round((job.rawSimilarity || 0.35) * 100));
        const result: RerankedJobResult = {
          id: job.id,
          score: fallbackScore,
          label: getMatchLabel(fallbackScore),
          reason: "Evaluated using standard profile similarity.",
        };
        results.set(job.id, result);
      }
    }
  }

  return results;
}
