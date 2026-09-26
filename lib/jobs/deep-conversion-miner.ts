import { createAdminClient } from "@/lib/supabase/admin";
import { discoverCompetitorsForCompany } from "@/lib/competitors/discover-competitors";
import { isSameCompany, isJobEligible, cleanJobTitle, normalizeJobTitle, normalizeJobUrl } from "@/lib/jobs/job-filters";
import { STRATEGIES, stripHtml } from "@/lib/scrape-strategies";

export interface ConversionBlueprint {
  jobId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  reqId?: string;
  matchScore: number;
  fitVerdict: string;
  whyThisOpportunity: string;
  focusX: {
    title: string;
    description: string;
  };
  focusY: {
    title: string;
    keywordsToAdd: string[];
    description: string;
  };
  focusZ: {
    title: string;
    interviewPitch: string;
    objectionHandler: string;
  };
  connector: {
    type: "proxnet" | "linkedin";
    name?: string;
    role?: string;
    proxnetUserId?: string;
    linkedinSearchUrl?: string;
    linkedinAlumniUrl?: string;
    outreachMessage: string;
    connectionPath: string;
  };
}

export interface CandidateContext {
  id: string;
  fullName: string;
  email: string;
  currentRole: string;
  currentCompany: string;
  targetCompanies: string[];
  discoveredCompetitors: string[];
  education: string;
  location: string;
  societyName: string;
  resumeText: string;
  embedding?: number[];
}

export async function fetchCandidateContext(candidateId?: string): Promise<CandidateContext> {
  const supabase = createAdminClient();
  let query = supabase.from("users").select("*");
  if (candidateId) {
    query = query.eq("id", candidateId);
  } else {
    query = query.ilike("full_name", "%vaibhav%");
  }

  const { data: users, error } = await query;
  if (error || !users || users.length === 0) {
    throw new Error(`Candidate not found: ${error?.message}`);
  }

  const user = users[0];
  const digest = user.profile_digest || {};

  // 1. Fetch user's explicit target companies from database table
  const { data: targetRows } = await supabase
    .from("user_target_companies")
    .select("company_name, ats_provider, ats_board_token, careers_url")
    .eq("user_id", user.id);

  const targetsFromDb = (targetRows || [])
    .map(r => r.company_name?.trim())
    .filter(Boolean) as string[];

  const digestTargets = Array.isArray(digest.target_companies)
    ? (digest.target_companies as string[]).map(t => t.trim()).filter(Boolean)
    : [];

  const combinedTargets = Array.from(new Set([...targetsFromDb, ...digestTargets]))
    .filter(c => !isSameCompany(c, user.company));

  // 2. Discover authentic industry competitors dynamically based on candidate's employer
  let discoveredCompetitors: string[] = [];
  if (user.company) {
    try {
      const compResult = await discoverCompetitorsForCompany(user.company);
      discoveredCompetitors = (compResult.competitors || [])
        .map(c => c.name.trim())
        .filter(c => Boolean(c) && !isSameCompany(c, user.company));
    } catch (compErr: any) {
      console.warn("[deep-conversion-miner] Competitor discovery warning:", compErr.message);
    }
  }

  // Combine targets prioritizing explicit user targets, then discovered competitors
  const targetCompanies = combinedTargets.length > 0
    ? combinedTargets
    : (discoveredCompetitors.length > 0 ? discoveredCompetitors : []);

  return {
    id: user.id,
    fullName: user.full_name || "Member",
    email: user.email || "",
    currentRole: user.job_title || "Professional",
    currentCompany: user.company || "",
    targetCompanies,
    discoveredCompetitors,
    education: user.email?.includes("iiml") ? "IIM Lucknow" : (digest.education || "University Alumni"),
    location: user.location_name || user.city || "Bengaluru, Karnataka, India",
    societyName: digest.society_name || "ProxNet Community",
    resumeText: user.resume_text || "",
    embedding: Array.isArray(user.embedding) ? user.embedding : undefined,
  };
}

/**
 * Live Workday CXS scraper for specific enterprise companies (like HP) when relevant
 */
export async function fetchLiveWorkdayOpportunities(companyName: string = "HP", searchTerms: string[] = []): Promise<any[]> {
  if (companyName.toLowerCase() !== "hp") return [];

  const hpApi = "https://hp.wd5.myworkdayjobs.com/wday/cxs/hp/ExternalCareerSite/jobs";
  const terms = searchTerms.length > 0 ? searchTerms : ["Product", "Strategy", "Consultant", "Director"];
  const foundMap = new Map<string, any>();

  for (const term of terms) {
    try {
      const res = await fetch(hpApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: 10,
          offset: 0,
          searchText: `${term} India`
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const data = await res.json();
        for (const j of data.jobPostings || []) {
          const reqId = j.bulletFields?.[0] || j.externalPath;
          if (!foundMap.has(reqId)) {
            foundMap.set(reqId, {
              title: j.title,
              company: "HP",
              location: j.locationsText || "Bengaluru, Karnataka, India",
              url: `https://hp.wd5.myworkdayjobs.com/en-US/ExternalCareerSite${j.externalPath}`,
              externalPath: j.externalPath,
              reqId: j.bulletFields?.[0],
              source: "hp_workday"
            });
          }
        }
      }
    } catch {
      // Graceful timeout
    }
  }

  const results: any[] = [];
  const items = Array.from(foundMap.values()).slice(0, 4);

  for (const item of items) {
    try {
      const detailUrl = `https://hp.wd5.myworkdayjobs.com/wday/cxs/hp/ExternalCareerSite${item.externalPath}`;
      const resDetail = await fetch(detailUrl, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(6000)
      });
      if (resDetail.ok) {
        const detailData = await resDetail.json();
        const info = detailData.jobPostingInfo || {};
        results.push({
          ...item,
          title: info.title || item.title,
          description: info.jobDescription || item.title,
          reqId: info.jobReqId || item.reqId,
          location: info.location || item.location,
        });
      } else {
        results.push({ ...item, description: item.title });
      }
    } catch {
      results.push({ ...item, description: item.title });
    }
  }

  return results;
}

/**
 * Dynamically queries live ATS boards for candidate's actual target and peer companies
 */
export async function crawlCandidateTargetAts(
  candidate: CandidateContext
): Promise<any[]> {
  const supabase = createAdminClient();
  const allTargetNames = Array.from(new Set([...candidate.targetCompanies, ...candidate.discoveredCompetitors]))
    .filter(c => !isSameCompany(c, candidate.currentCompany));

  if (allTargetNames.length === 0) return [];

  // Look for configured ATS boards for these specific companies
  const { data: atsConfigs } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url")
    .in("provider", ["greenhouse", "lever", "ashby", "workable", "smartrecruiters"]);

  if (!atsConfigs || atsConfigs.length === 0) return [];

  // Match configs to candidate's companies
  const relevantConfigs = atsConfigs.filter(cfg => {
    return allTargetNames.some(t => {
      const tNorm = t.toLowerCase().trim();
      const cNorm = cfg.company_name.toLowerCase().trim();
      return isSameCompany(tNorm, cNorm) || tNorm.includes(cNorm) || cNorm.includes(tNorm);
    });
  }).slice(0, 15);

  const liveJobs: any[] = [];
  const crawlPromises = relevantConfigs.map(async (board) => {
    const strategy = STRATEGIES[board.provider];
    if (!strategy) return;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 4000)
      );
      const jobs = await Promise.race([
        strategy(board.board_token_or_url, board.company_name),
        timeoutPromise,
      ]);

      if (Array.isArray(jobs)) {
        for (const j of jobs) {
          const cleanTitle = cleanJobTitle(normalizeJobTitle(j.title));
          const eligibility = isJobEligible({
            title: cleanTitle,
            location: j.location,
            description: j.description,
            posted_at: j.posted_at,
          });

          if (eligibility.eligible && !isSameCompany(board.company_name, candidate.currentCompany)) {
            liveJobs.push({
              title: cleanTitle,
              company: board.company_name,
              location: j.location || "Remote",
              url: normalizeJobUrl(j.url),
              description: stripHtml(j.description || cleanTitle),
              posted_at: j.posted_at || new Date().toISOString(),
              source: `live_${board.provider}`,
            });
          }
        }
      }
    } catch {
      // Graceful timeout
    }
  });

  await Promise.allSettled(crawlPromises);
  return liveJobs;
}

/**
 * Dynamically queries matching opportunities across:
 * 1. Live ATS crawls of candidate's target companies & competitors
 * 2. Semantic vector matches from `scraped_jobs` via `match_scraped_jobs`
 * 3. Exact target company matches in `scraped_jobs`
 * 
 * Strictly excludes candidate's own current employer.
 */
export async function fetchDynamicCandidateOpportunities(
  candidate: CandidateContext
): Promise<any[]> {
  const supabase = createAdminClient();
  const allCandidateJobs: any[] = [];
  const seenJobKeys = new Set<string>();

  const addJobIfUnique = (job: any, sourceWeight: number = 0) => {
    if (!job || !job.title || !job.company) return;
    if (isSameCompany(job.company, candidate.currentCompany)) return;

    const key = `${job.company.toLowerCase().trim()}:::${job.title.toLowerCase().trim()}`;
    if (!seenJobKeys.has(key)) {
      seenJobKeys.add(key);
      allCandidateJobs.push({ ...job, _sourceWeight: sourceWeight });
    }
  };

  // 1. Live ATS Crawl of candidate's relevant target companies
  try {
    const liveAtsJobs = await crawlCandidateTargetAts(candidate);
    for (const j of liveAtsJobs) {
      addJobIfUnique(j, 40);
    }
  } catch (err: any) {
    console.warn("[deep-conversion-miner] Live ATS crawl warning:", err.message);
  }

  // 2. If candidate's targets/peers include HP (e.g. enterprise tech peer) and candidate is not at HP
  const includesHp = [...candidate.targetCompanies, ...candidate.discoveredCompetitors].some(
    c => c.toLowerCase() === "hp" || c.toLowerCase().includes("hewlett packard")
  );
  if (includesHp && !isSameCompany("HP", candidate.currentCompany)) {
    try {
      const hpTerms = candidate.currentRole.split(" ").filter(w => w.length > 3).slice(0, 3);
      const hpJobs = await fetchLiveWorkdayOpportunities("HP", hpTerms);
      for (const j of hpJobs) {
        addJobIfUnique(j, 35);
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] HP Workday query warning:", err.message);
    }
  }

  // 3. Semantic Vector Search across scraped_jobs using candidate's resume embedding
  if (candidate.embedding && candidate.embedding.length > 0) {
    try {
      const { data: matchedVectorJobs } = await supabase.rpc("match_scraped_jobs", {
        query_embedding: candidate.embedding,
        match_threshold: 0.18,
        match_count: 60,
      });

      if (Array.isArray(matchedVectorJobs)) {
        for (const vj of matchedVectorJobs) {
          if (isSameCompany(vj.company, candidate.currentCompany)) continue;
          const cleanTitle = cleanJobTitle(normalizeJobTitle(vj.title));
          const eligibility = isJobEligible({
            title: cleanTitle,
            location: vj.location,
            description: vj.description,
            posted_at: vj.posted_at,
          });
          if (eligibility.eligible) {
            addJobIfUnique({
              id: vj.id,
              title: cleanTitle,
              company: vj.company,
              location: vj.location || "Remote",
              url: vj.url,
              description: stripHtml(vj.description || cleanTitle),
              posted_at: vj.posted_at,
              source: "vector_match",
              _similarity: vj.similarity || 0.5,
            }, 30);
          }
        }
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] Vector search warning:", err.message);
    }
  }

  // 4. Direct Target & Competitor Query in scraped_jobs
  const targetCompanies = Array.from(new Set([...candidate.targetCompanies, ...candidate.discoveredCompetitors]))
    .filter(c => !isSameCompany(c, candidate.currentCompany));

  if (targetCompanies.length > 0) {
    try {
      const { data: dbJobs } = await supabase
        .from("scraped_jobs")
        .select("id, title, company, location, url, description, posted_at")
        .in("company", targetCompanies.slice(0, 20))
        .eq("is_active", true)
        .order("posted_at", { ascending: false })
        .limit(40);

      if (Array.isArray(dbJobs)) {
        for (const dj of dbJobs) {
          if (isSameCompany(dj.company, candidate.currentCompany)) continue;
          const cleanTitle = cleanJobTitle(normalizeJobTitle(dj.title));
          const eligibility = isJobEligible({
            title: cleanTitle,
            location: dj.location,
            description: dj.description,
            posted_at: dj.posted_at,
          });
          if (eligibility.eligible) {
            addJobIfUnique({
              id: dj.id,
              title: cleanTitle,
              company: dj.company,
              location: dj.location || "Remote",
              url: dj.url,
              description: stripHtml(dj.description || cleanTitle),
              posted_at: dj.posted_at,
              source: "target_peer_match",
            }, 25);
          }
        }
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] Database target query warning:", err.message);
    }
  }

  // 5. Intelligent Ranking
  const roleKeywords = candidate.currentRole.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const targetSet = new Set(candidate.targetCompanies.map(c => c.toLowerCase().trim()));
  const compSet = new Set(candidate.discoveredCompetitors.map(c => c.toLowerCase().trim()));

  const scoredJobs = allCandidateJobs.map((j) => {
    let score = j._sourceWeight || 10;
    const compLower = j.company.toLowerCase().trim();
    const titleLower = j.title.toLowerCase();

    // Bonus if company matches explicit user target
    if (targetSet.has(compLower)) score += 35;
    // Bonus if company matches discovered industry competitor
    else if (compSet.has(compLower)) score += 20;

    // Domain / Role keyword match
    for (const kw of roleKeywords) {
      if (titleLower.includes(kw)) score += 15;
    }

    // Vector similarity bonus
    if (j._similarity) score += Math.round(j._similarity * 30);

    return { job: j, score };
  });

  scoredJobs.sort((a, b) => b.score - a.score);

  // Return distinct companies first to give the candidate high-conviction diversity
  const selected: any[] = [];
  const pickedCompanies = new Set<string>();

  for (const item of scoredJobs) {
    const cKey = item.job.company.toLowerCase().trim();
    if (!pickedCompanies.has(cKey)) {
      pickedCompanies.add(cKey);
      selected.push(item.job);
    }
  }

  // If we need more, add remaining highest scored
  for (const item of scoredJobs) {
    if (!selected.includes(item.job)) {
      selected.push(item.job);
    }
  }

  return selected;
}

export async function resolveConnector(
  companyName: string,
  candidateInstitute: string,
  targetJobTitle: string,
  reqId?: string,
  candidateContext?: { currentRole?: string; currentCompany?: string }
): Promise<ConversionBlueprint["connector"]> {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, email")
    .eq("is_active", true);

  const cleanTarget = companyName.toLowerCase().trim();
  const insider = (users || []).find(u => {
    return isSameCompany(u.company, companyName) ||
      (u.company && cleanTarget.includes(u.company.toLowerCase().trim())) ||
      (u.company && u.company.toLowerCase().trim().includes(cleanTarget));
  });

  const encodedAlum = encodeURIComponent(`${companyName} "${candidateInstitute}"`);
  const encodedLead = encodeURIComponent(`${companyName} (Director OR Head OR VP) (${targetJobTitle.split(" ")[0] || "Hiring"})`);

  const linkedinAlumniUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedAlum}`;
  const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedLead}`;

  if (insider) {
    const roleRef = candidateContext?.currentRole ? `in ${candidateContext.currentRole}` : "in your domain";
    const note = `Hi ${insider.full_name.split(" ")[0]}, fellow ProxNet member here! I noticed the ${targetJobTitle} opening at ${insider.company}. With my background ${roleRef}, I'd value your insider perspective or quick advice on the team.`;
    return {
      type: "proxnet",
      name: insider.full_name,
      role: insider.job_title,
      proxnetUserId: insider.id,
      linkedinSearchUrl,
      linkedinAlumniUrl,
      outreachMessage: note,
      connectionPath: `ProxNet Verified Insider: ${insider.full_name} (${insider.job_title} @ ${insider.company})`
    };
  }

  const jobRef = reqId ? ` (Req #${reqId})` : "";
  const roleStr = candidateContext?.currentRole ? `${candidateContext.currentRole}` : "my field";
  const compStr = candidateContext?.currentCompany ? ` at ${candidateContext.currentCompany}` : "";
  const note = `Hi [Name], I work in ${roleStr}${compStr} and noticed ${companyName}'s ${targetJobTitle}${jobRef}. With my background in this domain & ${candidateInstitute} alum network, I'd love to connect and learn about the team's roadmap.`;

  return {
    type: "linkedin",
    linkedinSearchUrl,
    linkedinAlumniUrl,
    outreachMessage: note,
    connectionPath: `LinkedIn Direct: ${candidateInstitute} Alum or Functional Hiring Leader at ${companyName}`
  };
}

export async function generateConversionBlueprint(
  candidate: CandidateContext,
  job: { id?: string; title: string; company: string; location: string; url: string; description: string; reqId?: string }
): Promise<ConversionBlueprint> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const prompt = `You are an elite executive career strategist and talent conversion architect.
You are generating a hyper-specific, actionable conversion roadmap for a top candidate applying to a high-priority opportunity.

CANDIDATE CONTEXT:
- Name: ${candidate.fullName}
- Current Title: ${candidate.currentRole} at ${candidate.currentCompany}
- Alma Mater: ${candidate.education}
- Location: ${candidate.location}
- Resume Highlights & Experience:
${candidate.resumeText.slice(0, 3500)}

OPPORTUNITY CONTEXT:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Job Description / Requirements:
${job.description.slice(0, 3500)}

YOUR TASK:
Generate a rigorous, tailored conversion blueprint structured strictly as JSON:
{
  "matchScore": <number between 75 and 96 reflecting genuine alignment>,
  "fitVerdict": "<e.g. Strong Strategic Fit / Exceptional Product Match>",
  "whyThisOpportunity": "<2-3 sentences explaining exactly why this is a high-yield pivot for the candidate>",
  "focusX": {
    "title": "Resume Anchor: <Name of candidate project/achievement to lead with>",
    "description": "<Exact guidance on which bullet points from the candidate's resume to highlight at the top of their CV to directly solve the hiring manager's core problem>"
  },
  "focusY": {
    "title": "ATS Keyword & Metric Optimization",
    "keywordsToAdd": ["<specific keyword 1>", "<specific keyword 2>", "<specific keyword 3>", "<specific keyword 4>"],
    "description": "<Specific terminology, frameworks, or quantification metrics to insert into the resume to achieve 95%+ ATS parsing accuracy>"
  },
  "focusZ": {
    "title": "Winning Interview Narrative & Objection Handler",
    "interviewPitch": "<A compelling 2-sentence opening hook the candidate should deliver when asked 'Tell me about yourself and why this role'>",
    "objectionHandler": "<How to proactively address potential gaps or domain nuances>"
  }
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a world-class executive career coach. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");

  const connector = await resolveConnector(
    job.company,
    candidate.education,
    job.title,
    job.reqId,
    { currentRole: candidate.currentRole, currentCompany: candidate.currentCompany }
  );

  return {
    jobId: job.id || `live_${job.company.toLowerCase()}_${(job.reqId || job.title).replace(/[^a-zA-Z0-9]/g, "")}`,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    reqId: job.reqId,
    matchScore: parsed.matchScore || 85,
    fitVerdict: parsed.fitVerdict || "Strong Strategic Fit",
    whyThisOpportunity: parsed.whyThisOpportunity || "",
    focusX: parsed.focusX || { title: "Resume Alignment", description: "Tailor experience to JD requirements." },
    focusY: parsed.focusY || { title: "ATS Optimization", keywordsToAdd: [], description: "Include key skills from the job description." },
    focusZ: parsed.focusZ || { title: "Interview Strategy", interviewPitch: "", objectionHandler: "" },
    connector
  };
}

export async function runDeepCareerConversionMiner(candidateId?: string, limit: number = 1): Promise<{
  candidate: CandidateContext;
  blueprints: ConversionBlueprint[];
}> {
  const candidate = await fetchCandidateContext(candidateId);
  const candidateOpportunities = await fetchDynamicCandidateOpportunities(candidate);

  // Filter out candidate's own company
  const eligibleJobs = candidateOpportunities.filter(
    j => !isSameCompany(j.company, candidate.currentCompany)
  );

  const blueprints: ConversionBlueprint[] = [];
  const countToMine = Math.max(1, Math.min(5, limit));
  const selectedJobs = eligibleJobs.slice(0, countToMine);

  for (const job of selectedJobs) {
    try {
      const blueprint = await generateConversionBlueprint(candidate, job);
      blueprints.push(blueprint);
    } catch (err: any) {
      console.error(`Failed analyzing ${job.title}:`, err.message);
    }
  }

  // Persist to Supabase
  const supabase = createAdminClient();
  const { data: currentUser } = await supabase.from("users").select("profile_digest").eq("id", candidate.id).single();
  const updatedDigest = {
    ...(currentUser?.profile_digest || {}),
    deep_career_blueprints: blueprints,
    deep_career_miner_last_run: new Date().toISOString()
  };

  await supabase.from("users").update({ profile_digest: updatedDigest }).eq("id", candidate.id);

  return { candidate, blueprints };
}
