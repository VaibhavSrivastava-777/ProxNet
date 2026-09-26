import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import fs from "fs";
import path from "path";
import { createAdminClient } from "../lib/supabase/admin";
import { discoverCompetitorsForCompany } from "../lib/competitors/discover-competitors";

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

  // Filter for high relevance product / strategy roles
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

  const encodedComp = encodeURIComponent(companyName);
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

  // LinkedIn Fallback
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

export async function runDeepCareerConversionMiner(candidateId?: string): Promise<{
  candidate: CandidateContext;
  blueprints: ConversionBlueprint[];
  dossierPath: string;
}> {
  console.log("=====================================================");
  console.log("🚀 STARTING AUTONOMOUS DEEP CAREER CONVERSION MINER");
  console.log("=====================================================");
  const startTime = Date.now();

  // 1. Load Candidate Context
  console.log("🔍 [Step 1/5] Loading candidate profile & resume from Supabase...");
  const candidate = await fetchCandidateContext(candidateId);
  console.log(`✅ Loaded profile for: ${candidate.fullName} (${candidate.currentRole} @ ${candidate.currentCompany})`);
  console.log(`   Location: ${candidate.societyName}, ${candidate.location} | Alum: ${candidate.education}`);
  console.log(`   Target Companies: ${candidate.targetCompanies.join(", ")}`);

  // 2. Discover Competitors & Recursive Opportunities
  console.log("\n🌐 [Step 2/5] Recursively mining opportunities across target & peer tech companies...");
  const discoveredPeers = await discoverCompetitorsForCompany(candidate.currentCompany);
  const peerNames = discoveredPeers.competitors.map(c => c.name).filter(n => n.toLowerCase() !== candidate.currentCompany.toLowerCase());
  console.log(`✅ Discovered enterprise peers: ${peerNames.join(", ")}`);

  // 3. Fetch Live HP Opportunities & Network Jobs
  console.log("\n⚡ [Step 3/5] Scraping live HP Workday career board & querying network opportunities...");
  const hpJobs = await fetchLiveHpOpportunities();
  console.log(`✅ Retrieved ${hpJobs.length} live openings directly from HP Workday.`);

  const networkJobs = await fetchMatchingNetworkJobs(candidate.currentCompany);
  console.log(`✅ Filtered ${networkJobs.length} high-relevance product/strategy jobs from database.`);

  // Prioritize top opportunities for deep conversion blueprint
  const prioritizedJobs: any[] = [];

  // Top HP roles
  const topHp = hpJobs.find(j => j.title.toLowerCase().includes("artificial intelligence") || j.title.toLowerCase().includes("business architect")) || hpJobs[0];
  if (topHp) prioritizedJobs.push(topHp);

  const secondHp = hpJobs.find(j => j !== topHp && (j.title.toLowerCase().includes("chief of staff") || j.title.toLowerCase().includes("architect") || j.title.toLowerCase().includes("consultant")));
  if (secondHp) prioritizedJobs.push(secondHp);

  // Top Google role (Sumit Kishore connector)
  const googleJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("google") && j.title.toLowerCase().includes("lead product manager"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("google") && j.title.toLowerCase().includes("product manager"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("google"));
  if (googleJob) prioritizedJobs.push(googleJob);

  // Top Microsoft role (Gaurav Mukherjee connector)
  const msftJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("microsoft") && j.title.toLowerCase().includes("cloud infra & ai"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("microsoft") && j.title.toLowerCase().includes("cloud & ai"))
    || networkJobs.find(j => (j.company || "").toLowerCase().includes("microsoft") && j.title.toLowerCase().includes("consultant"));
  if (msftJob) prioritizedJobs.push(msftJob);


  // Top Lenovo role (Harsh Pranav connector)
  const lenovoJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("lenovo"));
  if (lenovoJob) prioritizedJobs.push(lenovoJob);

  // Top ServiceNow role
  const serviceNowJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("servicenow") && (j.title.toLowerCase().includes("consultant") || j.title.toLowerCase().includes("director")));
  if (serviceNowJob) prioritizedJobs.push(serviceNowJob);

  // Top Oracle role (Smaran Mudbidri & Deepthi B connectors)
  const oracleJob = networkJobs.find(j => (j.company || "").toLowerCase().includes("oracle"));
  if (oracleJob) prioritizedJobs.push(oracleJob);



  console.log(`\n🎯 Prioritized ${prioritizedJobs.length} standout opportunities for deep conversion analysis:`);
  for (const pj of prioritizedJobs) {
    console.log(`   - [${pj.company}] ${pj.title} (${pj.location || "India"})`);
  }

  // 4. Generate Deep Conversion Blueprints
  console.log("\n🧠 [Step 4/5] Running OpenAI deep conversion synthesis (Focus X, Y, Z & Connector Mapping)...");
  const blueprints: ConversionBlueprint[] = [];

  for (let i = 0; i < prioritizedJobs.length; i++) {
    const job = prioritizedJobs[i];
    console.log(`   (${i + 1}/${prioritizedJobs.length}) Analyzing: [${job.company}] ${job.title}...`);
    try {
      const blueprint = await generateConversionBlueprint(candidate, job);
      blueprints.push(blueprint);
      console.log(`      ⭐ Match Score: ${blueprint.matchScore}% | Verdict: ${blueprint.fitVerdict}`);
      console.log(`      🔗 Connector: ${blueprint.connector.connectionPath}`);
    } catch (err: any) {
      console.error(`      ❌ Failed analyzing ${job.title}:`, err.message);
    }
  }

  // 5. Persist to Supabase & Generate Executive Dossier
  console.log("\n💾 [Step 5/5] Persisting conversion blueprints into Supabase and drafting Executive Dossier...");
  const supabase = createAdminClient();
  const { data: currentUser } = await supabase.from("users").select("profile_digest").eq("id", candidate.id).single();
  const updatedDigest = {
    ...(currentUser?.profile_digest || {}),
    deep_career_blueprints: blueprints,
    deep_career_miner_last_run: new Date().toISOString()
  };

  await supabase.from("users").update({ profile_digest: updatedDigest }).eq("id", candidate.id);
  console.log("✅ Successfully updated users.profile_digest with fresh deep conversion blueprints.");

  // Generate Executive Markdown Dossier Artifact
  const dossierPath = path.resolve("C:/Users/Swati/.gemini/antigravity-ide/brain/add90d74-b19b-4230-a7ac-17a357740fe2/career_conversion_dossier.md");
  const markdown = generateDossierMarkdown(candidate, blueprints);
  fs.writeFileSync(dossierPath, markdown, "utf-8");
  console.log(`✅ Saved Executive Career Conversion Dossier to: ${dossierPath}`);

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n🎉 Autonomous Career Conversion Miner complete in ${durationSec}s!`);

  return { candidate, blueprints, dossierPath };
}

function generateDossierMarkdown(candidate: CandidateContext, blueprints: ConversionBlueprint[]): string {
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  let md = `# 🎯 Executive Career Conversion Dossier
**Prepared for:** ${candidate.fullName} (${candidate.currentRole} @ ${candidate.currentCompany})  
**Date:** ${dateStr} | **Target Scope:** Enterprise Technology, AI Transformation & Senior Product Management  
**Affiliations:** ${candidate.education} | Location: ${candidate.societyName}, Bengaluru  

---

> [!IMPORTANT]
> **Core Strategy Principle:** Rather than shallow instant-crawling, this dossier provides an **end-to-end conversion path** for each opportunity:
> 1. **Focus X:** The exact project on your resume that directly solves the hiring manager's biggest pain point.
> 2. **Focus Y:** High-impact ATS keywords, metrics, and domain nomenclature to immediately optimize your CV.
> 3. **Focus Z:** The winning interview narrative and objection handler to neutralize any perceived background gaps.
> 4. **Connector (Mr. A):** Direct warm bridge via verified **ProxNet community insiders** or 1-click **LinkedIn alumni/hiring leaders** with a pre-crafted high-conversion outreach note.

---

`;

  blueprints.forEach((bp, idx) => {
    const isProxNet = bp.connector.type === "proxnet";
    const connectorBadge = isProxNet
      ? `🟢 **ProxNet Insider:** [${bp.connector.name}](file:///c:/Personal%20Docs/Vaibhav/Projects/ProxNet) (${bp.connector.role} @ ${bp.company})`
      : `🔵 **LinkedIn Bridge:** [Search ${candidate.education} Alumni](${bp.connector.linkedinAlumniUrl}) | [Search Hiring Leaders](${bp.connector.linkedinSearchUrl})`;

    md += `## ${idx + 1}. [${bp.company}] ${bp.title}
- **Location:** ${bp.location}  
- **Direct Portal Link:** [Apply / View Job Listing](${bp.url})${bp.reqId ? ` | **Req ID:** \`${bp.reqId}\`` : ""}  
- **Match Score:** **${bp.matchScore}%** (${bp.fitVerdict})  

### 💡 Why This Opportunity
${bp.whyThisOpportunity}

### 📐 Conversion Blueprint (Focus X, Y, Z)

| Dimension | Strategy & Actionable Implementation |
| :--- | :--- |
| **Focus X: Resume Hook** | **${bp.focusX.title}**<br>${bp.focusX.description} |
| **Focus Y: ATS Optimization** | **${bp.focusY.title}**<br>**Keywords to embed:** ${bp.focusY.keywordsToAdd.map(k => `\`${k}\``).join(", ")}<br>${bp.focusY.description} |
| **Focus Z: Winning Interview Pitch** | **${bp.focusZ.title}**<br>**Opening Pitch:** *"${bp.focusZ.interviewPitch}"*<br>**Objection Handler:** ${bp.focusZ.objectionHandler} |

### 🤝 Connection Path to Mr. A (${bp.company})
- **Connector Type:** ${connectorBadge}
- **Connection Strategy:** ${bp.connector.connectionPath}

> [!TIP]
> **Pre-Drafted Outreach Note (Ready to Send):**  
> \`\`\`text
> ${bp.connector.outreachMessage}
> \`\`\`

---

`;
  });

  md += `## 🚀 Next Steps & Execution Plan
1. **Target Outreach:** Prioritize sending the pre-drafted message to the verified ProxNet insiders (Lenovo, Microsoft, Google, Oracle) and the ${candidate.education} alumni on LinkedIn for HP.
2. **Resume Fine-Tuning:** Tailor the top section of your CV using the specific **Focus X** project anchor and **Focus Y** keywords before submitting the direct application.
3. **Interview Warm-Up:** Keep the **Focus Z** 2-sentence opening pitch handy for initial recruiter screeners.
`;

  return md;
}

if (require.main === module) {
  runDeepCareerConversionMiner().catch(console.error);
}
