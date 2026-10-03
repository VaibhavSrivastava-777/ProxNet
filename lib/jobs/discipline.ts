/**
 * Functional discipline classification & compatibility.
 *
 * Used as a deterministic guard-rail around LLM match scoring so that
 * cross-functional pairs (e.g. Finance candidate vs Operations job) can never
 * surface as high matches, regardless of what the LLM or vector search says.
 */

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
  | "consulting_strategy"
  | "operations"
  // Could not determine a discipline with confidence
  | "operations_general";

export type DisciplineRelation = "same" | "adjacent" | "incompatible" | "unknown";

export const DISCIPLINE_LABELS: Record<FunctionalDiscipline, string> = {
  human_resources: "HR / Talent",
  supply_chain: "Supply Chain",
  product_management: "Product Management",
  software_engineering: "Engineering",
  data_ai: "Data / AI",
  design: "Design",
  finance: "Finance / Accounting",
  sales_marketing: "Sales / Marketing",
  legal: "Legal",
  consulting_strategy: "Consulting / Strategy",
  operations: "Operations",
  operations_general: "General",
};

// Ordered: first match wins. More specific functions are checked before broad ones
// (e.g. "Finance Operations Manager" is Finance, "Sales Operations" is Sales).
const TITLE_RULES: Array<[FunctionalDiscipline, RegExp]> = [
  ["human_resources", /\b(hr|hrbp|hris|human resources?|talent acquisition|talent management|talent partner|recruiter|recruiting|recruitment|people ops|people operations|people partner|people lead|people & culture|people experience|head of people|payroll & benefits|compensation & benefits|learning & development|l&d)\b/i],
  ["legal", /\b(legal|counsel|attorney|lawyer|advocate|paralegal|compliance officer|company secretary|contracts manager)\b/i],
  // Sales-flavoured "accounts" must win over finance "accounts"
  ["sales_marketing", /\b(key|strategic|enterprise|named|global|major|national|corporate|large) accounts?\b/i],
  ["finance", /\b(finance|financial|fp ?& ?a|fpa|accountant|accounting|accounts|audit|auditor|auditing|controller|comptroller|controllership|treasury|tax|taxation|gst|cfo|payroll|chartered accountant|cost accountant|bookkeep\w*|billing|invoic\w*|reconciliation|credit analyst|credit risk|underwriter|underwriting|investment bank\w*|equity research|valuation|actuar\w*|ledger|accounts payable|accounts receivable|r2r|p2p|o2c|fico)\b/i],
  ["supply_chain", /\b(supply chain|scm|logistics|procurement|sourcing|buyer|purchasing|materials manager|warehouse|inventory|demand planning|supply planning|fulfil?ment|freight|vendor management)\b/i],
  ["product_management", /\b(product manager|product management|product lead|product director|product owner|group product manager|head of product|technical product manager|principal product|cpo|technical program manager)\b/i],
  ["data_ai", /\b(data scien\w*|data analyst|data analytics|machine learning|ml engineer|ai engineer|data engineer|analytics manager|analytics lead|business intelligence|bi analyst|bi developer|nlp|computer vision|deep learning|mlops|statistician)\b/i],
  ["software_engineering", /\b(software|developer|engineer|engineering|full ?stack|backend|back-end|frontend|front-end|devops|sre|cloud|architect|qa|sdet|test automation|sde|tech lead|firmware|embedded|programmer|mobile|android|ios|infrastructure|network|cyber ?security|security analyst|sap abap|salesforce developer|administrator|dba)\b/i],
  ["design", /\b(ux|ui|product designer|visual designer|motion designer|interaction designer|design lead|creative director|graphic designer|designer)\b/i],
  ["sales_marketing", /\b(sales|account executive|account manager|account director|customer success|business development|bdm|bde|marketing|growth|brand|demand gen|bdr|sdr|client success|client partner|pre-?sales|inside sales|territory|channel partner|partnerships|seo|sem|content strategist|communications|pr manager|public relations)\b/i],
  ["consulting_strategy", /\b(consultant|consulting|strategy|strategic|advisory|business analyst|management associate|chief of staff|corporate development|m&a|mergers|transformation)\b/i],
  ["operations", /\b(operations|ops|delivery manager|delivery lead|service delivery|program manager|project manager|programme manager|pmo|process excellence|six sigma|lean|facility|facilities|administration|admin|office manager|back office|process associate|process executive|process specialist|customer support|customer service|customer care|call cent(?:er|re)|bpo|service desk|workforce management|quality analyst)\b/i],
];

// Description-level signals used only when the title is non-specific.
const DESCRIPTION_RULES: Array<[FunctionalDiscipline, RegExp]> = [
  ["human_resources", /\b(talent acquisition|human resources|recruiting team|people operations|hr business partner|employee relations)\b/gi],
  ["finance", /\b(financial planning|financial statements|general ledger|accounts payable|accounts receivable|month[- ]end close|reconciliations?|budgeting|forecasting|ifrs|gaap|ind as|taxation|audit|balance sheet|p&l|cash flow)\b/gi],
  ["supply_chain", /\b(supply chain|procurement|logistics|inventory management|vendor management|sourcing strategy|warehouse)\b/gi],
  ["product_management", /\b(product roadmap|product discovery|product lifecycle|product backlog|user stories|product strategy|prd)\b/gi],
  ["software_engineering", /\b(software development|codebase|pull requests|ci\/cd|rest api|microservices|kubernetes|java|python|typescript|react|node\.js)\b/gi],
  ["data_ai", /\b(machine learning|data pipelines|deep learning|data warehous\w*|sql|statistical model\w*|tableau|power bi)\b/gi],
  ["sales_marketing", /\b(sales targets|quota|pipeline generation|lead generation|go-to-market|campaigns|brand awareness|customer acquisition)\b/gi],
  ["operations", /\b(operational excellence|process improvement|sla|service delivery|operations management|back office|transaction processing)\b/gi],
  ["consulting_strategy", /\b(client engagements|strategy consulting|management consulting|business transformation|stakeholder workshops)\b/gi],
];

function classifyTitle(title: string): FunctionalDiscipline | null {
  const t = title.toLowerCase();
  if (!t.trim()) return null;
  for (const [disc, re] of TITLE_RULES) {
    if (re.test(t)) return disc;
  }
  return null;
}

/**
 * Picks the dominant discipline from free text by counting keyword hits.
 * Returns null unless one discipline clearly dominates.
 */
function classifyFreeText(text: string, minHits: number): FunctionalDiscipline | null {
  const sample = text.slice(0, 6000).toLowerCase();
  if (!sample.trim()) return null;
  const counts: Array<[FunctionalDiscipline, number]> = DESCRIPTION_RULES.map(([disc, re]) => {
    re.lastIndex = 0;
    return [disc, (sample.match(re) || []).length];
  });
  counts.sort((a, b) => b[1] - a[1]);
  const [top, second] = counts;
  if (!top || top[1] < minHits) return null;
  if (second && second[1] > 0 && top[1] < second[1] * 1.5) return null;
  return top[0];
}

/**
 * Classifies a title/description into a standardized functional discipline.
 * Title has the highest signal; description is only consulted for vague titles.
 */
export function detectFunctionalDiscipline(title?: string | null, description?: string | null): FunctionalDiscipline {
  const fromTitle = classifyTitle(title || "");
  if (fromTitle) return fromTitle;
  if (description) {
    const plain = description.replace(/<[^>]+>/g, " ");
    const fromDesc = classifyFreeText(plain, 2);
    if (fromDesc) return fromDesc;
  }
  return "operations_general";
}

/**
 * Classifies a candidate using title first, then skills / summary / resume.
 */
export function detectCandidateDiscipline(candidate: {
  job_title?: string | null;
  resume_text?: string | null;
  about?: string | null;
  profile_digest?: { skills?: string[]; summary?: string } | null;
}): FunctionalDiscipline {
  const fromTitle = classifyTitle(candidate.job_title || "");
  if (fromTitle) return fromTitle;

  const skills = (candidate.profile_digest?.skills || []).join(", ");
  const fromSkills = classifyTitle(skills) || classifyFreeText(`${skills} ${candidate.profile_digest?.summary || ""}`, 2);
  if (fromSkills) return fromSkills;

  const fromResume = classifyFreeText(`${candidate.resume_text || ""} ${candidate.about || ""}`, 3);
  return fromResume || "operations_general";
}

const ADJACENT: Partial<Record<FunctionalDiscipline, FunctionalDiscipline[]>> = {
  software_engineering: ["data_ai", "product_management"],
  data_ai: ["software_engineering", "product_management", "consulting_strategy"],
  product_management: ["software_engineering", "data_ai", "design", "consulting_strategy"],
  design: ["product_management"],
  finance: ["consulting_strategy"],
  consulting_strategy: ["finance", "operations", "product_management", "data_ai"],
  operations: ["supply_chain", "consulting_strategy"],
  supply_chain: ["operations"],
};

export function relateDisciplines(cand: FunctionalDiscipline, job: FunctionalDiscipline): DisciplineRelation {
  if (cand === "operations_general" || job === "operations_general") return "unknown";
  if (cand === job) return "same";
  if (ADJACENT[cand]?.includes(job) || ADJACENT[job]?.includes(cand)) return "adjacent";
  return "incompatible";
}

/**
 * Checks if two disciplines are functionally compatible (same or adjacent).
 * Unknown disciplines are treated as compatible so the LLM can decide.
 */
export function areDisciplinesCompatible(cand: FunctionalDiscipline, job: FunctionalDiscipline): boolean {
  return relateDisciplines(cand, job) !== "incompatible";
}
