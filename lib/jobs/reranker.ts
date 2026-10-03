import {
  detectCandidateDiscipline,
  detectFunctionalDiscipline,
  relateDisciplines,
  DISCIPLINE_LABELS,
  FunctionalDiscipline,
} from "./discipline";
import {
  hasSubstantiveDescription,
  isLikelyJobPostingUrl,
} from "./job-quality";
import {
  computeSkillAlignment,
  SkillAlignmentResult,
} from "./skill-matching";

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
  skillsAlignment?: SkillAlignmentResult;
}

// In-memory cache for rerank results (TTL: 1 hour)
interface CachedScore {
  score: number;
  label: "Strong Match" | "Good Match" | "Moderate Match" | "Low Match";
  reason: string;
  skillsAlignment?: SkillAlignmentResult;
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
 * Stage 2 Reranker: Evaluates candidate profile vs candidate jobs with deterministic
 * discipline, skill coverage (Method 1), and quality guardrails around gpt-4o-mini.
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

  // Deterministically classify candidate discipline
  const candDiscipline: FunctionalDiscipline = detectCandidateDiscipline(candidate);

  // 1. Check cache and pre-screen deterministic disqualifications
  const jobsToEvaluate: JobToRerank[] = [];

  for (const job of jobs) {
    const cacheKey = `${candidateKey}::${job.id}`;
    const cached = rerankCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      results.set(job.id, {
        id: job.id,
        score: cached.score,
        label: cached.label,
        reason: cached.reason,
        skillsAlignment: cached.skillsAlignment,
      });
      continue;
    }

    const jobDiscipline = detectFunctionalDiscipline(job.title, job.description);
    const relation = relateDisciplines(candDiscipline, jobDiscipline);
    const isSubstantive = hasSubstantiveDescription(job.description, job.title);
    const isLikelyPosting = isLikelyJobPostingUrl(job.url);
    const skillsAlignment = computeSkillAlignment(candidate, job);

    // Hard disqualification: Incompatible functional disciplines (e.g. Finance vs Operations)
    if (relation === "incompatible") {
      const candLabel = DISCIPLINE_LABELS[candDiscipline] || "Your Field";
      const jobLabel = DISCIPLINE_LABELS[jobDiscipline] || "Different Function";
      const score = 25;
      const label = "Low Match";
      const reason = `Candidate background in ${candLabel} does not match role discipline in ${jobLabel}.`;

      results.set(job.id, { id: job.id, score, label, reason, skillsAlignment });
      rerankCache.set(cacheKey, { score, label, reason, skillsAlignment, timestamp: now });
      continue;
    }

    // Hard disqualification: Invalid / Non-posting URL (search page, PDF, landing)
    if (!isLikelyPosting && job.url) {
      const score = 20;
      const label = "Low Match";
      const reason = "Link is not a direct job requisition (search or category page).";

      results.set(job.id, { id: job.id, score, label, reason, skillsAlignment });
      rerankCache.set(cacheKey, { score, label, reason, skillsAlignment, timestamp: now });
      continue;
    }

    // Weak / Thin Description: Cap at 35% without burning LLM tokens
    if (!isSubstantive) {
      const score = 35;
      const label = "Low Match";
      const reason = "Job description is missing or minimal; role requirements cannot be verified.";

      results.set(job.id, { id: job.id, score, label, reason, skillsAlignment });
      rerankCache.set(cacheKey, { score, label, reason, skillsAlignment, timestamp: now });
      continue;
    }

    // Role is compatible or adjacent and carries substantive description -> evaluate with LLM
    jobsToEvaluate.push(job);
  }

  if (jobsToEvaluate.length === 0) {
    return results;
  }

  // If no OpenAI key, fall back to conservative estimate based on skill coverage
  if (!openaiKey) {
    for (const job of jobsToEvaluate) {
      const skillsAlignment = computeSkillAlignment(candidate, job);
      const coverageBoost = Math.round(skillsAlignment.coveragePercent * 0.3);
      const fallbackScore = Math.min(65, 35 + coverageBoost);
      const result: RerankedJobResult = {
        id: job.id,
        score: fallbackScore,
        label: getMatchLabel(fallbackScore),
        reason: `Evaluated with skill coverage ratio (${skillsAlignment.coveragePercent}% tooling match).`,
        skillsAlignment,
      };
      results.set(job.id, result);
    }
    return results;
  }

  // 2. Batch qualifying jobs in chunks of 8
  const BATCH_SIZE = 8;
  for (let i = 0; i < jobsToEvaluate.length; i += BATCH_SIZE) {
    const batch = jobsToEvaluate.slice(i, i + BATCH_SIZE);

    const candidateContext = `
CANDIDATE PROFILE:
- Current Title: ${candidate.job_title || "Unknown"}
- Current/Recent Company: ${candidate.company || "Unknown"}
- Functional Discipline: ${DISCIPLINE_LABELS[candDiscipline] || "General"}
- Profile Summary: ${candidate.profile_digest?.summary || candidate.about || candidate.professional_bio || "None provided"}
- Core Skills: ${(candidate.profile_digest?.skills || candidate.tags || []).join(", ") || "General"}
- Total Experience: ${candidate.profile_digest?.experienceYears ? `${candidate.profile_digest.experienceYears} years` : "Experienced"}
${candidate.resume_text ? `- Resume Excerpt: ${candidate.resume_text.slice(0, 1500)}` : ""}
`.trim();

    const jobsPayload = batch.map((j, idx) => {
      const skillsAlignment = computeSkillAlignment(candidate, j);
      return {
        index: idx + 1,
        jobId: j.id,
        title: j.title,
        company: j.company,
        location: j.location || "Remote",
        keywords: j.keywords || [],
        skillCoverage: {
          coveragePercent: `${skillsAlignment.coveragePercent}%`,
          matchedSkills: skillsAlignment.matchedSkills,
          missingSkills: skillsAlignment.missingSkills,
          totalRequired: skillsAlignment.totalRequiredSkills,
        },
        descriptionSnippet: (j.description || "").replace(/<[^>]*>?/gm, " ").slice(0, 600).trim(),
      };
    });

    const systemPrompt = `You are an expert AI talent recruiter. Your task is to accurately score how well each job opening matches the candidate's professional profile.

SCORING CRITERIA:
1. FUNCTIONAL DISCIPLINE ALIGNMENT (CRITICAL):
   - Completely different functional areas MUST receive LOW scores (< 40%).
   - Examples of mismatches:
     * Product Manager vs Software Engineer / DevOps / SRE (< 35%)
     * Product Manager vs Financial Analyst / Accountant (< 30%)
     * Product Manager vs Sales AE / Business Development (< 40%)
     * Software Engineer vs Marketing / HR (< 30%)
     * Finance / Accounting vs Operations / Logistics (< 30%)
2. HARD SKILL & TOOLING COVERAGE RATIO (METHOD 1):
   - Candidate's matched vs missing technical skills and tools are provided.
   - High skill coverage (>70%) strongly supports a high match score.
   - Low skill coverage (<35% when the job explicitly requires key skills) must penalize the score and prevent a 'Strong Match' (>84%).
3. SENIORITY & LEVEL FIT:
   - Match candidate's career level (e.g. Lead/Staff vs Consultant/Senior vs Director).
4. DOMAIN RELEVANCE:
   - Look for specific technical, product, industry, or domain overlaps (e.g. Cloud, SaaS, AI, B2B, Fintech).

SCORE SCALE:
- 85-100: "Strong Match" — Direct role match in same function with strong skill & domain alignment.
- 70-84:  "Good Match" — Same functional area with transferable skills and good relevance.
- 50-69:  "Moderate Match" — Adjacent role or partial overlap, but with noticeable skill or seniority gaps.
- 0-49:   "Low Match" — Cross-functional mismatch, unrelated discipline, or major skill deficit.

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
          let score = typeof ev.score === "number" ? Math.min(100, Math.max(0, Math.round(ev.score))) : 30;
          const matchingJob = batch.find((j) => j.id === ev.jobId);
          let skillsAlignment: SkillAlignmentResult | undefined;

          // Apply post-evaluation discipline & skill guardrails against LLM hallucinations
          if (matchingJob) {
            const jobDiscipline = detectFunctionalDiscipline(matchingJob.title, matchingJob.description);
            const relation = relateDisciplines(candDiscipline, jobDiscipline);
            skillsAlignment = computeSkillAlignment(candidate, matchingJob);

            if (relation === "incompatible") {
              score = Math.min(30, score);
            } else if (relation === "adjacent") {
              score = Math.min(74, score); // Adjacent functions can be Good Match, but never 85%+ Strong Match
            }

            // Method 1 guardrail: if role requires at least 3 distinct skills and candidate has < 30% coverage, cap at 50%
            if (skillsAlignment.totalRequiredSkills >= 3 && skillsAlignment.coveragePercent < 30) {
              score = Math.min(50, score);
            }
          }

          const label = getMatchLabel(score);
          const reason = ev.reason || "Evaluated based on profile relevance.";

          const result: RerankedJobResult = {
            id: ev.jobId,
            score,
            label,
            reason,
            skillsAlignment,
          };

          results.set(ev.jobId, result);

          // Save to cache
          rerankCache.set(`${candidateKey}::${ev.jobId}`, {
            score,
            label,
            reason,
            skillsAlignment,
            timestamp: now,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Reranker] Batch evaluation error:", msg);
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
