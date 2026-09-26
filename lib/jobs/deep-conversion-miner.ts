import { createAdminClient } from "@/lib/supabase/admin";
import { discoverCompetitorsForCompany } from "@/lib/competitors/discover-competitors";
import { isSameCompany } from "@/lib/jobs/job-filters";

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
  education: string;
  location: string;
  societyName: string;
  resumeText: string;
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

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    currentRole: user.job_title || "Consultant, Product Management",
    currentCompany: user.company || "Dell Technologies",
    targetCompanies: Array.isArray(digest.target_companies) && digest.target_companies.length > 0
      ? digest.target_companies
      : ["Hp", "Hewlett Packard Enterprise", "Lenovo", "Google", "Microsoft", "Oracle"],
    education: user.email?.includes("iiml") ? "IIM Lucknow" : "Tier 1 Business School",
    location: user.location_name || user.city || "Bengaluru, Karnataka, India",
    societyName: digest.society_name || "L&T South City",
    resumeText: user.resume_text || "",
  };
}

export async function fetchLiveHpOpportunities(): Promise<any[]> {
  const hpApi = "https://hp.wd5.myworkdayjobs.com/wday/cxs/hp/ExternalCareerSite/jobs";
  const searchTerms = ["Artificial Intelligence", "Product", "Strategy", "Consultant"];
  const foundMap = new Map<string, any>();

  for (const term of searchTerms) {
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
        signal: AbortSignal.timeout(10000)
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
    } catch (err: any) {
      console.warn(`[fetchLiveHpOpportunities] Error querying "${term}":`, err.message);
    }
  }

  // Fetch full details for the top HP roles
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
        signal: AbortSignal.timeout(10000)
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

export async function fetchMatchingNetworkJobs(candidateCompany: string): Promise<any[]> {
  const supabase = createAdminClient();
  const peers = ["Lenovo", "Google", "Microsoft", "Oracle Corporation", "ServiceNow", "Amazon", "Datadog", "Zscaler"];
  
  const { data: jobs, error } = await supabase
    .from("scraped_jobs")
    .select("id, title, company, location, url, description, posted_at")
    .in("company", peers)
    .neq("company", candidateCompany)
    .neq("company", "Dell");

  if (error || !jobs) return [];

  return jobs.filter(j => {
    const t = (j.title || "").toLowerCase();
    const isTarget = t.includes("product") || t.includes("consultant") || t.includes("solution") || t.includes("architect") || t.includes("strategy") || t.includes("director") || t.includes("manager") || t.includes("lead");
    const isExcluded = t.includes("technician") || t.includes("support associate") || t.includes("rop-software") || t.includes("sales specialist");
    return isTarget && !isExcluded;
  });
}

export async function resolveConnector(
  companyName: string,
  candidateInstitute: string,
  targetJobTitle: string,
  reqId?: string
): Promise<ConversionBlueprint["connector"]> {
  const supabase = createAdminClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, company, job_title, email")
    .eq("is_active", true);

  const cleanTarget = companyName.toLowerCase();
  const insider = (users || []).find(u => {
    const c = (u.company || "").toLowerCase();
    return c.includes(cleanTarget) || (cleanTarget.includes("lenovo") && c.includes("lenovo")) || (cleanTarget.includes("oracle") && c.includes("oracle")) || (cleanTarget.includes("google") && c.includes("google")) || (cleanTarget.includes("microsoft") && c.includes("microsoft"));
  });

  const encodedAlum = encodeURIComponent(`${companyName} "${candidateInstitute}"`);
  const encodedLead = encodeURIComponent(`${companyName} (Director OR Head OR VP) (Product OR "AI" OR "Technology")`);

  const linkedinAlumniUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedAlum}`;
  const linkedinSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedLead}`;

  if (insider) {
    const note = `Hi ${insider.full_name.split(" ")[0]}, fellow ProxNet member here! I noticed the ${targetJobTitle} opening at ${insider.company}. With my background in product strategy and enterprise consulting, I'd value your insider perspective or quick advice on the team.`;
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
  const note = `Hi [Name], I lead product management consulting at Dell and noticed ${companyName}'s ${targetJobTitle}${jobRef}. With my background in enterprise AI transformation & ${candidateInstitute} alum network, I'd love to connect and learn about the team's roadmap.`;

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
    "objectionHandler": "<How to proactively address potential gaps, e.g. hardware-to-cloud transition or specific domain nuances>"
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

  const connector = await resolveConnector(job.company, candidate.education, job.title, job.reqId);

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
  const hpJobs = await fetchLiveHpOpportunities();
  const networkJobs = await fetchMatchingNetworkJobs(candidate.currentCompany);

  const prioritizedJobs: any[] = [];

  const topHp = hpJobs.find(j => j.title.toLowerCase().includes("artificial intelligence") || j.title.toLowerCase().includes("business architect")) || hpJobs[0];
  if (topHp) prioritizedJobs.push(topHp);

  const secondHp = hpJobs.find(j => j !== topHp && (j.title.toLowerCase().includes("chief of staff") || j.title.toLowerCase().includes("architect") || j.title.toLowerCase().includes("consultant")));
  if (secondHp) prioritizedJobs.push(secondHp);

  const googleJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("google") && j.title.toLowerCase().includes("lead product manager"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("google") && j.title.toLowerCase().includes("product manager"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("google"));
  if (googleJob) prioritizedJobs.push(googleJob);

  const msftJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("microsoft") && j.title.toLowerCase().includes("cloud infra & ai"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("microsoft") && j.title.toLowerCase().includes("cloud & ai"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("microsoft") && j.title.toLowerCase().includes("consultant"));
  if (msftJob) prioritizedJobs.push(msftJob);

  const lenovoJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("lenovo"));
  if (lenovoJob) prioritizedJobs.push(lenovoJob);

  const serviceNowJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("servicenow") && (j.title.toLowerCase().includes("consultant") || j.title.toLowerCase().includes("director")));
  if (serviceNowJob) prioritizedJobs.push(serviceNowJob);

  const oracleJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("oracle"));
  if (oracleJob) prioritizedJobs.push(oracleJob);

  // Filter out candidate's own company
  const eligibleJobs = prioritizedJobs.filter(
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
