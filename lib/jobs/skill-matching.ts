import { FunctionalDiscipline, detectFunctionalDiscipline } from "./discipline";

export interface SkillAlignmentResult {
  matchedSkills: string[];
  missingSkills: string[];
  coveragePercent: number; // 0 to 100
  totalRequiredSkills: number;
}

// Canonical skills grouped by discipline for accurate entity extraction
const DISCIPLINE_SKILLS: Record<FunctionalDiscipline, Array<{ name: string; regex: RegExp }>> = {
  finance: [
    { name: "Financial Modeling", regex: /\b(financial model(?:l?ing)?|dcf|discounted cash flow)\b/i },
    { name: "FP&A", regex: /\b(fp ?& ?a|financial planning (?:and|&) analysis)\b/i },
    { name: "SAP FICO", regex: /\b(sap fico|sap fi|sap co|sap erp|fico)\b/i },
    { name: "P&L Management", regex: /\b(p ?& ?l|profit and loss|pnl)\b/i },
    { name: "Budgeting & Forecasting", regex: /\b(budgeting|forecasting|variance analysis|annual budget)\b/i },
    { name: "IFRS / GAAP", regex: /\b(ifrs|gaap|us gaap|ind as|accounting standards?)\b/i },
    { name: "Internal Audit & Risk", regex: /\b(internal audit|statutory audit|risk assessment|sox|internal controls?)\b/i },
    { name: "Taxation & GST", regex: /\b(direct tax|indirect tax|gst|transfer pricing|tds|corporate tax)\b/i },
    { name: "General Ledger / R2R", regex: /\b(general ledger|month[- ]end close|reconciliations?|r2r|record to report)\b/i },
    { name: "Accounts Payable / P2P", regex: /\b(accounts payable|ap|p2p|procure to pay|invoice processing)\b/i },
    { name: "Accounts Receivable / O2C", regex: /\b(accounts receivable|ar|o2c|order to cash|credit control)\b/i },
    { name: "Treasury & Cash Flow", regex: /\b(treasury|cash flow management|liquidity|working capital)\b/i },
    { name: "Advanced Excel", regex: /\b(advanced excel|vba|macro|power pivot|pivot tables?)\b/i },
    { name: "Chartered Accountant (CA)", regex: /\b(chartered accountant|ca certified|icai|cpa|cfa)\b/i },
    { name: "NetSuite / Oracle ERP", regex: /\b(netsuite|oracle erp|oracle financial|hyperion)\b/i },
  ],
  software_engineering: [
    { name: "React", regex: /\b(react|react\.js|reactjs)\b/i },
    { name: "Node.js", regex: /\b(node|node\.js|nodejs|express\.js|nest\.js|nestjs)\b/i },
    { name: "TypeScript", regex: /\b(typescript|ts)\b/i },
    { name: "Python", regex: /\b(python|django|fastapi|flask)\b/i },
    { name: "Java", regex: /\b(java|spring boot|spring)\b/i },
    { name: "Go / Golang", regex: /\b(golang|go language)\b/i },
    { name: "AWS", regex: /\b(aws|amazon web services|ec2|s3|lambda)\b/i },
    { name: "Docker & Kubernetes", regex: /\b(docker|kubernetes|k8s|containers?)\b/i },
    { name: "PostgreSQL / SQL", regex: /\b(postgres|postgresql|mysql|sql|rdbms)\b/i },
    { name: "MongoDB / NoSQL", regex: /\b(mongodb|nosql|dynamodb|cassandra|redis)\b/i },
    { name: "Microservices & REST APIs", regex: /\b(microservices?|rest api|restful|graphql|grpc)\b/i },
    { name: "CI/CD & DevOps", regex: /\b(ci\/cd|github actions|jenkins|terraform|helm)\b/i },
    { name: "System Architecture", regex: /\b(system design|high availability|scalability|distributed systems?)\b/i },
    { name: "Next.js", regex: /\b(next\.js|nextjs)\b/i },
  ],
  data_ai: [
    { name: "Machine Learning", regex: /\b(machine learning|ml|supervised learning|unsupervised learning)\b/i },
    { name: "Deep Learning", regex: /\b(deep learning|pytorch|tensorflow|keras|neural networks?)\b/i },
    { name: "Generative AI / LLMs", regex: /\b(llm|generative ai|langchain|rag|transformers|openai|huggingface)\b/i },
    { name: "Data Pipelines / ETL", regex: /\b(etl|data pipelines?|airflow|spark|pyspark|dbt)\b/i },
    { name: "SQL & Analytics", regex: /\b(advanced sql|data analytics|statistical analysis)\b/i },
    { name: "Data Warehousing", regex: /\b(snowflake|bigquery|redshift|data lake)\b/i },
    { name: "Tableau / Power BI", regex: /\b(tableau|power bi|looker|data visualization)\b/i },
    { name: "NLP / Computer Vision", regex: /\b(nlp|natural language processing|computer vision|opencv)\b/i },
  ],
  product_management: [
    { name: "Product Roadmap", regex: /\b(product roadmap|product vision|strategic planning)\b/i },
    { name: "PRDs & User Stories", regex: /\b(prd|product requirements?|user stories|epics|backlog)\b/i },
    { name: "Product Discovery", regex: /\b(product discovery|user research|customer interviews|usability testing)\b/i },
    { name: "Agile / Scrum", regex: /\b(scrum|agile|sprint planning|jira)\b/i },
    { name: "Data-Driven Analytics", regex: /\b(a\/b testing|product analytics|mixpanel|amplitude|funnel analysis)\b/i },
    { name: "Go-To-Market (GTM)", regex: /\b(go[- ]to[- ]market|gtm|product launch|market adoption)\b/i },
    { name: "B2B SaaS / Enterprise", regex: /\b(b2b saas|enterprise product|platform product)\b/i },
  ],
  design: [
    { name: "Figma", regex: /\b(figma|sketch|adobe xd)\b/i },
    { name: "UI/UX Design", regex: /\b(ui\/ux|user interface|user experience|interaction design)\b/i },
    { name: "Design Systems", regex: /\b(design systems?|component library|tokens|wireframing)\b/i },
    { name: "User Research", regex: /\b(user research|heuristic evaluation|prototyping)\b/i },
  ],
  operations: [
    { name: "Process Improvement", regex: /\b(process improvement|six sigma|lean|kaizen|operational excellence)\b/i },
    { name: "SLA & KPI Management", regex: /\b(sla|slas|service level|kpis|tat|turnaround time)\b/i },
    { name: "Service Delivery", regex: /\b(service delivery|delivery management|client operations)\b/i },
    { name: "Workforce Management", regex: /\b(workforce management|wfm|roster|resource allocation|capacity planning)\b/i },
    { name: "Vendor Management", regex: /\b(vendor management|third party|partner management)\b/i },
    { name: "Incident & Escalation Handling", regex: /\b(escalation management|incident management|root cause analysis|rca)\b/i },
  ],
  sales_marketing: [
    { name: "B2B Sales / Enterprise", regex: /\b(enterprise sales|b2b sales|solution selling|deal closing)\b/i },
    { name: "Lead Generation & Pipeline", regex: /\b(pipeline generation|lead gen|inbound|outbound|prospecting)\b/i },
    { name: "Account Management", regex: /\b(account management|client relationship|retention|upsell|cross-sell)\b/i },
    { name: "CRM / Salesforce", regex: /\b(salesforce|sfdc|hubspot|crm)\b/i },
    { name: "Performance Marketing", regex: /\b(performance marketing|paid ads|sem|google ads|meta ads|cac|roas)\b/i },
    { name: "SEO & Content Strategy", regex: /\b(seo|search engine optimization|content strategy|inbound marketing)\b/i },
  ],
  human_resources: [
    { name: "Talent Acquisition", regex: /\b(talent acquisition|tech recruiting|sourcing|headhunting|ats)\b/i },
    { name: "HR Business Partnering", regex: /\b(hrbp|business partnering|employee relations|performance management)\b/i },
    { name: "Payroll & Benefits", regex: /\b(payroll processing|compensation & benefits|c&b|statutory compliance)\b/i },
    { name: "HRIS Systems", regex: /\b(hris|workday|darwinbox|successfactors|peoplesoft)\b/i },
  ],
  supply_chain: [
    { name: "Procurement & Sourcing", regex: /\b(procurement|strategic sourcing|vendor negotiation|purchasing)\b/i },
    { name: "Logistics & Freight", regex: /\b(logistics|freight|3pl|transportation management)\b/i },
    { name: "Inventory Management", regex: /\b(inventory management|stock control|warehouse management|wms)\b/i },
    { name: "Demand & Supply Planning", regex: /\b(demand planning|supply planning|s&op|forecasting)\b/i },
  ],
  legal: [
    { name: "Contract Negotiation", regex: /\b(contract drafting|contract negotiation|msa|sow|nda)\b/i },
    { name: "Corporate Compliance", regex: /\b(regulatory compliance|statutory compliance|gdpr|data privacy)\b/i },
    { name: "Intellectual Property (IP)", regex: /\b(intellectual property|trademarks?|patents?|copyright)\b/i },
  ],
  consulting_strategy: [
    { name: "Management Consulting", regex: /\b(management consulting|strategy consulting|client advisory)\b/i },
    { name: "Business Analysis", regex: /\b(business analysis|requirement gathering|gap analysis|stakeholder management)\b/i },
    { name: "Financial & Market Due Diligence", regex: /\b(due diligence|market research|competitive benchmarking|m&a)\b/i },
  ],
  operations_general: [],
};

/**
 * Extracts recognized skills from arbitrary text (resume, bio, or job description).
 */
export function extractSkillsFromText(text: string, discipline?: FunctionalDiscipline): string[] {
  if (!text || text.trim().length === 0) return [];

  const found = new Set<string>();
  const discToScan = discipline && DISCIPLINE_SKILLS[discipline]?.length > 0
    ? [discipline]
    : (Object.keys(DISCIPLINE_SKILLS) as FunctionalDiscipline[]);

  for (const d of discToScan) {
    const skillRules = DISCIPLINE_SKILLS[d] || [];
    for (const rule of skillRules) {
      if (rule.regex.test(text)) {
        found.add(rule.name);
      }
    }
  }

  return Array.from(found);
}

/**
 * Aggregates all skills from a candidate's profile, resume, and tags.
 */
export function extractCandidateSkills(candidate: {
  profile_digest?: { skills?: string[] } | null;
  tags?: string[] | null;
  resume_text?: string | null;
  about?: string | null;
  job_title?: string | null;
}): Set<string> {
  const skills = new Set<string>();

  // Explicit structured skills
  for (const s of candidate.profile_digest?.skills || []) {
    if (s && s.trim()) skills.add(s.trim());
  }
  for (const t of candidate.tags || []) {
    if (t && t.trim()) skills.add(t.trim());
  }

  // Scan free-text resume and bio
  const textContext = `${candidate.job_title || ""} ${candidate.about || ""} ${candidate.resume_text || ""}`;
  const extracted = extractSkillsFromText(textContext);
  for (const s of extracted) {
    skills.add(s);
  }

  return skills;
}

/**
 * Aggregates all skills required by a job posting from its keywords and description.
 */
export function extractJobRequiredSkills(job: {
  title: string;
  description?: string | null;
  keywords?: string[] | null;
}): string[] {
  const discipline = detectFunctionalDiscipline(job.title, job.description);
  const detected = new Set<string>();

  // Incorporate explicit keywords if present
  for (const kw of job.keywords || []) {
    if (kw && kw.trim().length > 1) {
      detected.add(kw.trim());
    }
  }

  // Extract discipline-relevant skills from job description & title
  const jobText = `${job.title}\n${job.description || ""}`;
  const extracted = extractSkillsFromText(jobText, discipline);
  for (const s of extracted) {
    detected.add(s);
  }

  return Array.from(detected);
}

/**
 * Normalizes a skill token for fuzzy matching.
 */
function normalizeSkill(s: string): string {
  return s
    .toLowerCase()
    .replace(/[._\-/\s]+/g, "")
    .replace(/\b(management|certified|specialist|lead|skills?)\b/g, "");
}

/**
 * Computes the exact and fuzzy skill alignment ratio between candidate and job.
 */
export function computeSkillAlignment(
  candidate: {
    profile_digest?: { skills?: string[] } | null;
    tags?: string[] | null;
    resume_text?: string | null;
    about?: string | null;
    job_title?: string | null;
  },
  job: {
    title: string;
    description?: string | null;
    keywords?: string[] | null;
  }
): SkillAlignmentResult {
  const candidateSkills = extractCandidateSkills(candidate);
  const jobSkills = extractJobRequiredSkills(job);

  if (jobSkills.length === 0) {
    // If no explicit skills identified in job, neutral 65% baseline
    return {
      matchedSkills: [],
      missingSkills: [],
      coveragePercent: 65,
      totalRequiredSkills: 0,
    };
  }

  const candidateNorms = Array.from(candidateSkills).map(normalizeSkill);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const req of jobSkills) {
    const normReq = normalizeSkill(req);
    const hasDirectMatch = Array.from(candidateSkills).some(cs => cs.toLowerCase() === req.toLowerCase());
    const hasNormMatch = candidateNorms.some(cn => cn === normReq || cn.includes(normReq) || normReq.includes(cn));

    if (hasDirectMatch || hasNormMatch) {
      matched.push(req);
    } else {
      missing.push(req);
    }
  }

  const coveragePercent = Math.round((matched.length / jobSkills.length) * 100);

  return {
    matchedSkills: matched,
    missingSkills: missing,
    coveragePercent,
    totalRequiredSkills: jobSkills.length,
  };
}
