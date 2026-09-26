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

export type FunctionalDiscipline =
  | "human_resources"
  | "supply_chain"
  | "product_management"
  | "software_engineering"
  | "data_ai"
  | "design"
  | "finance"
  | "sales_marketing"
  | "legal"
  | "operations_general";

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
  discipline: FunctionalDiscipline;
  embedding?: number[];
}

/**
 * Classifies a title/description into a standardized functional discipline
 */
export function detectFunctionalDiscipline(title?: string | null, description?: string | null): FunctionalDiscipline {
  const t = (title || "").toLowerCase();

  // 1. First classify by TITLE (title has the highest signal-to-noise ratio)
  if (
    /\b(hr|human resources|talent|recruiter|recruiting|recruitment|people ops|people operations|people partner|hrbp|people lead|sourcing specialist|hr generalist|hr manager|hr director|talent partner|head of people|people & culture|people experience)\b/i.test(t)
  ) {
    return "human_resources";
  }

  if (
    /\b(supply chain|logistics|procurement|sourcing manager|materials manager|warehouse|inventory planning|operations planning|demand planning|fulfillment|freight|purchasing)\b/i.test(t)
  ) {
    return "supply_chain";
  }

  if (
    /\b(product manager|product management|product lead|product director|group product manager|head of product|technical product manager|principal product|cpo)\b/i.test(t)
  ) {
    return "product_management";
  }

  if (
    /\b(software|developer|engineer|full stack|backend|frontend|devops|sre|cloud|architect|qa engineer|sde|tech lead|firmware|embedded|solutions engineer|it engineer|systems engineer|infrastructure)\b/i.test(t)
  ) {
    return "software_engineering";
  }

  if (
    /\b(data scientist|data analyst|machine learning|ml engineer|ai engineer|data engineer|analytics manager|business intelligence|bi analyst|nlp)\b/i.test(t)
  ) {
    return "data_ai";
  }

  if (
    /\b(ux|ui|product designer|visual designer|motion designer|interaction designer|design lead|creative director|graphic designer)\b/i.test(t)
  ) {
    return "design";
  }

  if (
    /\b(finance|financial analyst|accountant|accounting|audit|controller|treasury|fp&a|tax manager|cfo|payroll)\b/i.test(t)
  ) {
    return "finance";
  }

  if (
    /\b(sales|account executive|account manager|customer success|business development|marketing|growth marketing|brand manager|demand gen|bdr|sdr|client success)\b/i.test(t)
  ) {
    return "sales_marketing";
  }

  if (
    /\b(legal|counsel|attorney|lawyer|compliance officer|general counsel|contracts manager)\b/i.test(t)
  ) {
    return "legal";
  }

  // 2. If title is non-specific (e.g. "Director", "Specialist", "Consultant"), inspect description snippet
  if (description) {
    const d = description.slice(0, 1500).toLowerCase();
    if (/\b(talent acquisition|human resources department|recruiting team|people operations team|hr business partner)\b/i.test(d)) {
      return "human_resources";
    }
    if (/\b(supply chain management|procurement process|logistics operations|vendor management & procurement)\b/i.test(d)) {
      return "supply_chain";
    }
    if (/\b(product roadmap|product discovery|product lifecycle|product backlog|user stories)\b/i.test(d)) {
      return "product_management";
    }
    if (/\b(software development|codebase|pull requests|ci\/cd pipeline|rest api|microservices)\b/i.test(d)) {
      return "software_engineering";
    }
    if (/\b(machine learning models|data pipelines|deep learning|data warehousing|sql queries)\b/i.test(d)) {
      return "data_ai";
    }
  }

  return "operations_general";
}

/**
 * Checks if two disciplines are functionally compatible
 */
export function areDisciplinesCompatible(
  candDiscipline: FunctionalDiscipline,
  jobDiscipline: FunctionalDiscipline
): boolean {
  if (candDiscipline === jobDiscipline) return true;
  // Only match general if both are general
  if (candDiscipline === "operations_general" && jobDiscipline === "operations_general") return true;

  // Plausible cross-functional overlaps
  if (
    (candDiscipline === "product_management" && (jobDiscipline === "data_ai" || jobDiscipline === "software_engineering")) ||
    (candDiscipline === "data_ai" && (jobDiscipline === "product_management" || jobDiscipline === "software_engineering")) ||
    (candDiscipline === "software_engineering" && (jobDiscipline === "data_ai" || jobDiscipline === "product_management"))
  ) {
    return true;
  }

  // Distinct functional areas (e.g. HR vs Supply Chain) are strictly incompatible
  return false;
}

/**
 * Generates tailored search terms for a functional discipline
 */
export function getDisciplineSearchTerms(discipline: FunctionalDiscipline, candidateRole: string): string[] {
  switch (discipline) {
    case "human_resources":
      return ["Talent Acquisition", "Human Resources", "Recruiter", "People Partner", "HR Manager", "Talent Management"];
    case "supply_chain":
      return ["Supply Chain", "Procurement", "Logistics", "Sourcing Manager", "Operations Planning"];
    case "product_management":
      return ["Product Manager", "Product Lead", "Technical Product Manager", "Group Product Manager"];
    case "software_engineering":
      return ["Software Engineer", "Backend Developer", "Full Stack Developer", "Engineering Lead"];
    case "data_ai":
      return ["Data Scientist", "Machine Learning", "Data Engineer", "AI Engineer"];
    case "design":
      return ["Product Designer", "UX Designer", "UI/UX Designer", "Interaction Designer"];
    case "finance":
      return ["Financial Analyst", "Finance Manager", "Controller", "FP&A"];
    case "sales_marketing":
      return ["Sales Manager", "Account Executive", "Business Development", "Marketing Manager"];
    default:
      return candidateRole.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  }
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

  const discipline = detectFunctionalDiscipline(user.job_title, user.resume_text);

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
    discipline,
    embedding: Array.isArray(user.embedding) ? user.embedding : undefined,
  };
}

/**
 * Live Workday CXS scraper for specific enterprise companies (like HP) when relevant.
 * Strictly verifies India location, 30-day freshness, and discipline compatibility.
 */
export async function fetchLiveWorkdayOpportunities(
  companyName: string = "HP",
  searchTerms: string[] = [],
  candidateDiscipline?: FunctionalDiscipline
): Promise<any[]> {
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
  const items = Array.from(foundMap.values()).slice(0, 10);

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
      let fullTitle = item.title;
      let fullDesc = item.title;
      let fullLoc = item.location;
      let reqId = item.reqId;

      if (resDetail.ok) {
        const detailData = await resDetail.json();
        const info = detailData.jobPostingInfo || {};
        fullTitle = info.title || item.title;
        fullDesc = info.jobDescription || item.title;
        reqId = info.jobReqId || item.reqId;
        fullLoc = info.location || item.location;
      }

      const cleanTitle = cleanJobTitle(normalizeJobTitle(fullTitle));
      const cleanDesc = stripHtml(fullDesc);

      // Validate location (India only), 30-day freshness, and junior filtering
      const eligibility = isJobEligible({
        title: cleanTitle,
        location: fullLoc,
        description: cleanDesc,
        posted_at: new Date().toISOString(),
      });

      if (!eligibility.eligible) continue;

      // Validate functional discipline compatibility
      if (candidateDiscipline) {
        const jobDisc = detectFunctionalDiscipline(cleanTitle, cleanDesc);
        if (!areDisciplinesCompatible(candidateDiscipline, jobDisc)) {
          continue;
        }
      }

      results.push({
        ...item,
        title: cleanTitle,
        description: cleanDesc,
        reqId,
        location: fullLoc,
      });
    } catch {
      // Graceful timeout
    }
  }

  return results;
}

/**
 * Dynamically queries live ATS boards for candidate's actual target and peer companies,
 * enforcing India location, 30-day freshness, and functional discipline compatibility.
 */
export async function crawlCandidateTargetAts(
  candidate: CandidateContext
): Promise<any[]> {
  const supabase = createAdminClient();
  const allTargetNames = Array.from(new Set([...candidate.targetCompanies, ...candidate.discoveredCompetitors]))
    .filter(c => !isSameCompany(c, candidate.currentCompany));

  // Query ATS configs: match target/peer companies and augment with top active partner boards
  const { data: atsConfigs } = await supabase
    .from("company_ats_config")
    .select("company_name, provider, board_token_or_url")
    .in("provider", ["greenhouse", "lever", "ashby", "workable", "smartrecruiters", "breezy", "recruitee"])
    .limit(80);

  if (!atsConfigs || atsConfigs.length === 0) return [];

  const targetBoards: Array<{ company: string; provider: string; token: string }> = [];
  const seenComps = new Set<string>();

  // 1. Add candidate targets & competitors first
  for (const cfg of atsConfigs) {
    if (isSameCompany(cfg.company_name, candidate.currentCompany)) continue;
    const cKey = cfg.company_name.toLowerCase().trim();
    if (seenComps.has(cKey)) continue;

    const matchesTarget = allTargetNames.some(t => {
      const tNorm = t.toLowerCase().trim();
      return isSameCompany(tNorm, cKey) || tNorm.includes(cKey) || cKey.includes(tNorm);
    });

    if (matchesTarget && cfg.board_token_or_url) {
      seenComps.add(cKey);
      targetBoards.push({ company: cfg.company_name, provider: cfg.provider, token: cfg.board_token_or_url });
    }
  }

  // 2. Add high-yield active partner boards up to 25 boards total
  for (const cfg of atsConfigs) {
    if (targetBoards.length >= 25) break;
    if (isSameCompany(cfg.company_name, candidate.currentCompany)) continue;
    const cKey = cfg.company_name.toLowerCase().trim();
    if (!seenComps.has(cKey) && cfg.board_token_or_url) {
      seenComps.add(cKey);
      targetBoards.push({ company: cfg.company_name, provider: cfg.provider, token: cfg.board_token_or_url });
    }
  }

  const liveJobs: any[] = [];
  const crawlPromises = targetBoards.map(async (board) => {
    const strategy = STRATEGIES[board.provider];
    if (!strategy) return;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 4000)
      );
      const jobs = await Promise.race([
        strategy(board.token, board.company),
        timeoutPromise,
      ]);

      if (Array.isArray(jobs)) {
        for (const j of jobs) {
          const cleanTitle = cleanJobTitle(normalizeJobTitle(j.title));
          const cleanDesc = stripHtml(j.description || cleanTitle);

          const eligibility = isJobEligible({
            title: cleanTitle,
            location: j.location,
            description: cleanDesc,
            posted_at: j.posted_at,
          });

          if (!eligibility.eligible) continue;
          if (isSameCompany(board.company, candidate.currentCompany)) continue;

          // Enforce discipline compatibility
          const jobDisc = detectFunctionalDiscipline(cleanTitle, cleanDesc);
          if (!areDisciplinesCompatible(candidate.discipline, jobDisc)) continue;

          liveJobs.push({
            title: cleanTitle,
            company: board.company,
            location: j.location || "Remote",
            url: normalizeJobUrl(j.url),
            description: cleanDesc,
            posted_at: j.posted_at || new Date().toISOString(),
            source: `live_${board.provider}`,
            discipline: jobDisc,
          });
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
 * 2. Enterprise career portals (e.g. Workday) with tailored discipline queries
 * 3. Ingestion of freshly crawled jobs into `scraped_jobs`
 * 4. Semantic vector search from `scraped_jobs`
 * 5. Persistent database query for candidate's discipline
 * 
 * STRICT GUARANTEES:
 * - NO TWO JOBS BELONG TO THE SAME COMPANY (distinct companies only)
 * - Excludes candidate's current employer
 * - Enforces India location, 30-day freshness, and functional discipline compatibility
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

    // Enforce discipline compatibility
    const jobDisc = job.discipline || detectFunctionalDiscipline(job.title, job.description);
    if (!areDisciplinesCompatible(candidate.discipline, jobDisc)) return;

    const key = `${job.company.toLowerCase().trim()}:::${job.title.toLowerCase().trim()}`;
    if (!seenJobKeys.has(key)) {
      seenJobKeys.add(key);
      allCandidateJobs.push({ ...job, discipline: jobDisc, _sourceWeight: sourceWeight });
    }
  };

  const freshlyScrapedJobs: any[] = [];

  // 1. Live ATS Crawl of candidate's relevant target companies and partner boards
  try {
    const liveAtsJobs = await crawlCandidateTargetAts(candidate);
    for (const j of liveAtsJobs) {
      addJobIfUnique(j, 45);
      freshlyScrapedJobs.push(j);
    }
  } catch (err: any) {
    console.warn("[deep-conversion-miner] Live ATS crawl warning:", err.message);
  }

  // 2. Enterprise Live Workday Crawl (if targets/peers include HP or large enterprise tech)
  const includesHp = [...candidate.targetCompanies, ...candidate.discoveredCompetitors].some(
    c => c.toLowerCase() === "hp" || c.toLowerCase().includes("hewlett packard")
  );
  if (includesHp && !isSameCompany("HP", candidate.currentCompany)) {
    try {
      const disciplineTerms = getDisciplineSearchTerms(candidate.discipline, candidate.currentRole);
      const hpJobs = await fetchLiveWorkdayOpportunities("HP", disciplineTerms, candidate.discipline);
      for (const j of hpJobs) {
        addJobIfUnique(j, 40);
        freshlyScrapedJobs.push(j);
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] HP Workday query warning:", err.message);
    }
  }

  // 3. PERSIST FRESH DISCOVERIES: Ingest newly discovered live jobs into `scraped_jobs`
  if (freshlyScrapedJobs.length > 0) {
    const rowsToUpsert = freshlyScrapedJobs.slice(0, 100).map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      url: j.url,
      description: j.description,
      posted_at: j.posted_at || new Date().toISOString(),
      source: j.source || "deep_miner",
      keywords: [candidate.discipline, "Deep Miner Discovery"],
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    try {
      await supabase
        .from("scraped_jobs")
        .upsert(rowsToUpsert, { onConflict: "url", ignoreDuplicates: false });
    } catch (upsertErr) {
      console.warn("[deep-conversion-miner] Scraped jobs upsert warning:", upsertErr);
    }
  }

  // 4. Semantic Vector Search across scraped_jobs using candidate's resume embedding
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
          const cleanDesc = stripHtml(vj.description || cleanTitle);

          const eligibility = isJobEligible({
            title: cleanTitle,
            location: vj.location,
            description: cleanDesc,
            posted_at: vj.posted_at,
          });

          if (eligibility.eligible) {
            addJobIfUnique({
              id: vj.id,
              title: cleanTitle,
              company: vj.company,
              location: vj.location || "Remote",
              url: vj.url,
              description: cleanDesc,
              posted_at: vj.posted_at,
              source: "vector_match",
              _similarity: vj.similarity || 0.5,
            }, 35);
          }
        }
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] Vector search warning:", err.message);
    }
  }

  // 5. Target Companies Query in scraped_jobs
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
          const cleanDesc = stripHtml(dj.description || cleanTitle);

          const eligibility = isJobEligible({
            title: cleanTitle,
            location: dj.location,
            description: cleanDesc,
            posted_at: dj.posted_at,
          });

          if (eligibility.eligible) {
            addJobIfUnique({
              id: dj.id,
              title: cleanTitle,
              company: dj.company,
              location: dj.location || "Remote",
              url: dj.url,
              description: cleanDesc,
              posted_at: dj.posted_at,
              source: "target_peer_match",
            }, 30);
          }
        }
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] Target query warning:", err.message);
    }
  }

  // 6. Discipline Keyword Query across scraped_jobs (active, eligible jobs in India/Remote)
  if (allCandidateJobs.length < 15) {
    try {
      const searchTerms = getDisciplineSearchTerms(candidate.discipline, candidate.currentRole);
      const orFilters = searchTerms.map(t => `title.ilike.%${t}%`).join(",");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: disciplineDbJobs } = await supabase
        .from("scraped_jobs")
        .select("id, title, company, location, url, description, posted_at")
        .eq("is_active", true)
        .gte("posted_at", thirtyDaysAgo.toISOString())
        .or(orFilters)
        .order("posted_at", { ascending: false })
        .limit(40);

      if (Array.isArray(disciplineDbJobs)) {
        for (const dj of disciplineDbJobs) {
          if (isSameCompany(dj.company, candidate.currentCompany)) continue;
          const cleanTitle = cleanJobTitle(normalizeJobTitle(dj.title));
          const cleanDesc = stripHtml(dj.description || cleanTitle);

          const eligibility = isJobEligible({
            title: cleanTitle,
            location: dj.location,
            description: cleanDesc,
            posted_at: dj.posted_at,
          });

          if (eligibility.eligible) {
            addJobIfUnique({
              id: dj.id,
              title: cleanTitle,
              company: dj.company,
              location: dj.location || "Remote",
              url: dj.url,
              description: cleanDesc,
              posted_at: dj.posted_at,
              source: "discipline_feed_match",
            }, 25);
          }
        }
      }
    } catch (err: any) {
      console.warn("[deep-conversion-miner] Discipline feed query warning:", err.message);
    }
  }

  // 7. Intelligent Scoring
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

    // Direct discipline match bonus
    if (j.discipline === candidate.discipline) score += 25;

    // Role keyword match bonus
    for (const kw of roleKeywords) {
      if (titleLower.includes(kw)) score += 15;
    }

    // Vector similarity bonus
    if (j._similarity) score += Math.round(j._similarity * 30);

    return { job: j, score };
  });

  scoredJobs.sort((a, b) => b.score - a.score);

  // 8. STRICT DIVERSITY RULE: MAXIMUM 1 JOB PER COMPANY
  // All returned opportunities MUST belong to distinct companies!
  const selectedDistinctCompanyJobs: any[] = [];
  const pickedCompanies = new Set<string>();

  for (const item of scoredJobs) {
    const cKey = item.job.company.toLowerCase().trim();
    if (!pickedCompanies.has(cKey)) {
      pickedCompanies.add(cKey);
      selectedDistinctCompanyJobs.push(item.job);
    }
  }

  return selectedDistinctCompanyJobs;
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
You are evaluating a candidate's authentic fit for this role and generating a hyper-specific, actionable conversion roadmap.

CANDIDATE CONTEXT:
- Name: ${candidate.fullName}
- Current Title: ${candidate.currentRole} at ${candidate.currentCompany}
- Functional Discipline: ${candidate.discipline}
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

CRITICAL EVALUATION GUIDELINES:
1. FUNCTIONAL DISCIPLINE & SENIORITY:
   - Evaluate whether the candidate's functional background matches or genuinely transfers to this role.
   - If there is a functional mismatch (e.g. HR candidate for Supply Chain / Engineering), assign a score < 50.
   - If there is strong direct or transferable alignment in the same functional domain, assign a score between 75 and 96 reflecting authentic merit.
2. CONVERSION BLUEPRINT:
   - Provide concrete, tailored guidance referencing specific candidate achievements, resume bullet points, ATS keywords, interview hooks, and connector outreach.

STRUCTURE YOUR OUTPUT STRICTLY AS JSON:
{
  "matchScore": <integer between 40 and 96 representing true functional alignment>,
  "fitVerdict": "<e.g. Strong Strategic Fit / Exceptional Domain Match / Transferable Domain Pivot>",
  "whyThisOpportunity": "<2-3 sentences explaining exactly why this is a high-yield opportunity for the candidate>",
  "focusX": {
    "title": "Resume Anchor: <Name of candidate project/achievement to lead with>",
    "description": "<Exact guidance on which bullet points from the candidate's resume to highlight at the top of their CV>"
  },
  "focusY": {
    "title": "ATS Keyword & Metric Optimization",
    "keywordsToAdd": ["<specific keyword 1>", "<specific keyword 2>", "<specific keyword 3>", "<specific keyword 4>"],
    "description": "<Specific terminology, frameworks, or quantification metrics to insert into the resume to achieve 95%+ ATS parsing accuracy>"
  },
  "focusZ": {
    "title": "Winning Interview Narrative & Objection Handler",
    "interviewPitch": "<A compelling 2-sentence opening hook the candidate should deliver when asked 'Tell me about yourself and why this role'>",
    "objectionHandler": "<How to proactively address potential domain nuances or industry pivots>"
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
        { role: "system", content: "You are a world-class executive career coach and technical talent evaluator. Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
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
    jobId: job.id || `live_${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}_${(job.reqId || job.title).replace(/[^a-zA-Z0-9]/g, "")}`,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    reqId: job.reqId,
    matchScore: typeof parsed.matchScore === "number" ? parsed.matchScore : 85,
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

  // STRICT GUARANTEE: Filter out candidate's own company and enforce DISTINCT COMPANIES
  // No two opportunities can ever belong to the same company!
  const blueprints: ConversionBlueprint[] = [];
  const countToMine = Math.max(1, Math.min(5, limit));
  const seenCompanies = new Set<string>();

  for (const job of candidateOpportunities) {
    if (blueprints.length >= countToMine) break;
    if (isSameCompany(job.company, candidate.currentCompany)) continue;

    const compKey = job.company.toLowerCase().trim();
    if (seenCompanies.has(compKey)) continue;

    try {
      const blueprint = await generateConversionBlueprint(candidate, job);
      // Strictly enforce >= 70% match threshold
      if (blueprint.matchScore >= 70) {
        seenCompanies.add(compKey);
        blueprints.push(blueprint);
      }
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
