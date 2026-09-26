import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import fs from "fs";
import path from "path";
import { createAdminClient } from "../lib/supabase/admin";
import {
  fetchCandidateContext,
  fetchDynamicCandidateOpportunities,
  generateConversionBlueprint,
  ConversionBlueprint,
  CandidateContext,
} from "../lib/jobs/deep-conversion-miner";
import { isSameCompany } from "../lib/jobs/job-filters";

export async function executeDeepCareerConversionMining(candidateId?: string): Promise<{
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
  if (candidate.discoveredCompetitors?.length > 0) {
    console.log(`   Discovered Industry Peers: ${candidate.discoveredCompetitors.join(", ")}`);
  }

  // 2. Discover Competitors & Dynamic Candidate Opportunities
  console.log("\n🌐 [Step 2/5] Dynamically mining opportunities across target companies & domain peers...");
  const candidateOpportunities = await fetchDynamicCandidateOpportunities(candidate);

  // Filter out candidate's own company
  const eligibleJobs = candidateOpportunities.filter(
    j => !isSameCompany(j.company, candidate.currentCompany)
  );

  console.log(`✅ Retrieved ${eligibleJobs.length} eligible domain opportunities.`);

  // 3. Prioritize top 5 diverse opportunities
  const prioritizedJobs = eligibleJobs.slice(0, 5);

  console.log(`\n🎯 Prioritized ${prioritizedJobs.length} standout opportunities for deep conversion analysis:`);
  for (const pj of prioritizedJobs) {
    console.log(`   - [${pj.company}] ${pj.title} (${pj.location || "India"}) [${pj.source || "ats"}]`);
  }

  // 4. Generate Deep Conversion Blueprints
  console.log("\n🧠 [Step 4/5] Running OpenAI deep conversion synthesis (Action Plans & Connector Mapping)...");
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
**Autonomous Mining Run:** ${dateStr}  
**Candidate:** **${candidate.fullName}** (${candidate.currentRole} at ${candidate.currentCompany})  
**Alumni Network:** ${candidate.education} | **Geography:** ${candidate.location}  
**Target & Peer Companies:** ${candidate.targetCompanies.join(", ")}  

---

> [!IMPORTANT]
> **Core Strategy Principle:** Rather than shallow instant-crawling, this dossier provides an **end-to-end conversion path** for each opportunity:
> 1. **Resume Anchor (Hook):** The exact project on your resume that directly solves the hiring manager's biggest pain point.
> 2. **ATS Keyword Optimization:** High-impact ATS keywords, metrics, and domain nomenclature to immediately optimize your CV.
> 3. **Winning Interview Pitch & Strategy:** The winning interview narrative and objection handler to neutralize any perceived background gaps.
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

### 📐 Conversion Action Plan

| Dimension | Strategy & Actionable Implementation |
| :--- | :--- |
| **Resume Anchor (Hook)** | **${bp.focusX.title}**<br>${bp.focusX.description} |
| **ATS Keyword Optimization** | **${bp.focusY.title}**<br>**Keywords to embed:** ${bp.focusY.keywordsToAdd.map(k => `\`${k}\``).join(", ")}<br>${bp.focusY.description} |
| **Winning Interview Pitch & Strategy** | **${bp.focusZ.title}**<br>**Opening Pitch:** *"${bp.focusZ.interviewPitch}"*<br>**Objection Handler:** ${bp.focusZ.objectionHandler} |

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
1. **Target Outreach:** Prioritize sending the pre-drafted message to verified ProxNet insiders and ${candidate.education} alumni on LinkedIn.
2. **Resume Fine-Tuning:** Tailor the top section of your CV using the specific **Resume Anchor** project and **ATS Optimization** keywords before submitting the direct application.
3. **Interview Warm-Up:** Keep the 2-sentence opening pitch handy for initial recruiter screeners.
`;

  return md;
}

if (require.main === module) {
  executeDeepCareerConversionMining()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("FATAL Miner error:", err);
      process.exit(1);
    });
}
