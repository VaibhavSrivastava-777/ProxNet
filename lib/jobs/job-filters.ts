/**
 * Centralized Job Filtering & Deduplication Utility
 * 
 * Enforces:
 * 1. India Location Filtering (positive Indian hubs, negative foreign disqualifiers)
 * 2. 30-Day Freshness Filter (jobs must not be older than 30 days)
 * 3. Junior Role Filtering (< 3 years experience / intern / fresher exclusion)
 * 4. URL Normalization & Duplicate Detection (prevent duplicate scraping & OpenAI token waste)
 */

export const INDIAN_TECH_HUBS = [
  "bangalore", "bengaluru", "mumbai", "pune", "delhi", "new delhi", "ncr",
  "gurugram", "gurgaon", "noida", "greater noida", "hyderabad", "chennai",
  "kolkata", "kochi", "cochin", "trivandrum", "thiruvananthapuram", "coimbatore",
  "chandigarh", "ahmedabad", "indore", "jaipur", "mysore", "mysuru", "mohali",
  "lucknow", "nagpur", "bhubaneswar", "visakhapatnam", "vizag", "vadodara",
  "surat", "gandhinagar", "bhopal", "patna", "ludhiana", "thane", "navi mumbai"
];

export const INDIAN_STATES = [
  "karnataka", "maharashtra", "tamil nadu", "telangana", "andhra pradesh",
  "gujarat", "haryana", "uttar pradesh", "west bengal", "kerala", "punjab",
  "rajasthan", "madhya pradesh", "odisha", "orissa", "assam", "bihar",
  "jharkhand", "chhattisgarh", "goa", "uttarakhand", "himachal pradesh"
];

export const FOREIGN_DISQUALIFIERS = [
  "united states", "usa", "u.s.", "u.s.a.", "us", "san francisco", "seattle", "new york",
  "austin", "chicago", "boston", "los angeles", "california", "texas",
  "united kingdom", "uk", "london", "emea", "latam", "apac", "canada",
  "toronto", "vancouver", "europe", "germany", "berlin", "munich",
  "france", "paris", "australia", "sydney", "melbourne", "singapore",
  "netherlands", "amsterdam", "ireland", "dublin", "israel", "tel aviv",
  "brazil", "mexico", "philippines", "poland", "spain", "madrid", "barcelona",
  "sweden", "stockholm", "switzerland", "zurich", "geneva", "japan", "tokyo"
];

/**
 * Checks if a job location represents an Indian position or an acceptable India-friendly remote position.
 * Disqualifies foreign locations, US-only remote jobs, and omitted locations with no India context.
 */
export function isIndiaLocation(location?: string | null, description?: string | null): boolean {
  if (!location || !location.trim()) {
    // If location is omitted, verify if the description explicitly mentions India or an Indian tech city
    if (!description) return false;
    const descLower = description.toLowerCase();
    const hasIndiaCity = INDIAN_TECH_HUBS.some(city => descLower.includes(city));
    const hasIndiaWord = /\bindia\b/i.test(descLower);
    return hasIndiaCity || hasIndiaWord;
  }

  const loc = location.toLowerCase().trim();

  // 1. Check for explicit foreign disqualifiers first
  const isForeign = FOREIGN_DISQUALIFIERS.some(foreign => {
    // Exact word boundary or substring depending on length
    if (foreign.length <= 4) {
      const escaped = foreign.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
      return regex.test(loc);
    }
    return loc.includes(foreign);
  });

  // If explicitly foreign and doesn't mention India, reject immediately
  const mentionsIndiaExplicitly = loc.includes("india") || loc === "in" || loc === "ind" || loc.includes("pan india");
  if (isForeign && !mentionsIndiaExplicitly) {
    return false;
  }

  // 2. Check if it's an Indian city or state
  const isIndianCity = INDIAN_TECH_HUBS.some(city => loc.includes(city));
  const isIndianState = INDIAN_STATES.some(state => loc.includes(state));
  if (isIndianCity || isIndianState || mentionsIndiaExplicitly) {
    return true;
  }

  // 3. Handle remote designations
  const isRemote = loc.includes("remote") || loc.includes("anywhere") || loc.includes("work from home") || loc.includes("wfh");
  if (isRemote) {
    // If it mentions foreign regions, reject
    if (isForeign) return false;

    // Check description for US-only / foreign-only eligibility restrictions
    if (description) {
      const descLower = description.toLowerCase();
      const usOnlyPhrases = [
        "must be located in the us",
        "must be located in the united states",
        "us citizenship",
        "us work authorization",
        "authorized to work in the us without",
        "us only",
        "north america only",
        "eligible to work in the united states",
      ];
      if (usOnlyPhrases.some(phrase => descLower.includes(phrase))) {
        return false;
      }
    }

    // Generic remote without foreign disqualifiers is allowed
    return true;
  }

  return false;
}

/**
 * Checks if a job posting is at most maxDays old (default: 30 days).
 * If posted_at is null or unparseable, returns true (defaults to fresh).
 */
export function isJobFresh(postedAt?: string | null, maxDays: number = 30): boolean {
  if (!postedAt || !postedAt.trim()) {
    return true; // No date provided, assume current
  }

  const jobDate = new Date(postedAt);
  if (isNaN(jobDate.getTime())) {
    return true; // Unparseable, accept
  }

  const now = Date.now();
  const jobTime = jobDate.getTime();
  const ageMs = now - jobTime;
  const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

  // Allow up to 1 day into future for timezone discrepancies
  if (jobTime > now + 24 * 60 * 60 * 1000) {
    return true;
  }

  return ageMs <= maxAgeMs;
}

/**
 * Checks if a job is a junior, intern, or fresher role (< 3 years experience).
 * Senior feed excludes these roles.
 */
export function isJuniorJob(title: string, description?: string | null): boolean {
  const t = title.toLowerCase();
  const d = (description || "").toLowerCase();

  const seniorKeywords = [
    "senior", "sr.", "sr ", "lead", "principal", "staff", "director",
    "manager", "architect", "head", "vp", "chief", "fellow", "founding"
  ];
  if (seniorKeywords.some(kw => t.includes(kw))) {
    return false;
  }

  const juniorTitles = [
    "junior", "jr.", "jr ", "intern", "internship", "trainee", "fresher",
    "entry-level", "entry level", "graduate trainee", "apprentice"
  ];
  if (juniorTitles.some(kw => t.includes(kw))) {
    return true;
  }

  const expRegexes = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*years?/gi,
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi,
    /min(?:imum)?\s*(\d+)\s*years?/gi,
  ];

  for (const regex of expRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(d)) !== null) {
      const val1 = parseInt(match[1], 10);
      const val2 = match[2] ? parseInt(match[2], 10) : null;
      if (!isNaN(val1)) {
        if (val2 !== null) {
          if (val2 < 3) return true;
        } else {
          if (val1 < 3) return true;
        }
      }
    }
  }

  return false;
}

/**
 * Normalizes a job URL by removing tracking query parameters, hash fragments,
 * and trailing slashes for reliable deduplication.
 */
export function normalizeJobUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl.trim());
    // Strip common tracking and session parameters
    const paramsToRemove = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "gh_jid", "gh_src", "ref", "source", "lever-source", "mode", "iis", "iisn",
      "fbclid", "gclid", "s", "trk"
    ];
    for (const p of paramsToRemove) {
      url.searchParams.delete(p);
    }
    url.hash = ""; // Strip fragment
    let clean = url.toString();
    if (clean.endsWith("/") && clean.length > url.origin.length + 1) {
      clean = clean.slice(0, -1);
    }
    return clean.toLowerCase();
  } catch {
    // Fallback: basic string cleanup
    return rawUrl.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase().trim();
  }
}

const TITLE_DICTIONARY_WORDS = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff", "associate", "director", "manager", "head", "vp",
  "vice", "president", "consultant", "advisory", "architect", "engineer", "engineering", "developer", "specialist",
  "analyst", "administrator", "admin", "executive", "representative", "officer", "coordinator", "intern", "trainee",
  "founder", "general", "chief", "deputy", "assistant", "product", "program", "project", "technical", "technology",
  "data", "software", "hardware", "cloud", "security", "devops", "platform", "infrastructure", "systems", "network",
  "qa", "quality", "test", "testing", "automation", "frontend", "front", "end", "backend", "back", "fullstack",
  "full", "stack", "mobile", "ios", "android", "ai", "ml", "machine", "learning", "deep", "nlp", "llm", "genai",
  "computer", "vision", "research", "scientist", "science", "analytics", "business", "operations", "ops", "sales",
  "marketing", "growth", "customer", "success", "support", "service", "services", "experience", "gtm", "commercial",
  "enterprise", "strategic", "strategy", "account", "partner", "partnerships", "finance", "financial", "accounting",
  "talent", "people", "hr", "human", "resources", "recruiter", "recruiting", "legal", "compliance", "procurement",
  "supply", "chain", "logistics", "warehouse", "brand", "creative", "design", "designer", "content", "writer",
  "communications", "relations", "pr", "merchandiser", "merchandising", "vendor", "retail", "solutions", "office",
  "ceo", "cto", "cfo", "coo", "cpo", "with", "and", "of", "for", "in", "at", "to", "the", "ii", "iii", "iv", "v",
  "1", "2", "3", "4", "5", "6", "contract", "contractor", "months", "month", "management", "digital", "global",
  "regional", "local", "core", "group", "team", "billing", "payments", "revenue", "inbound", "outbound", "field",
  "inside", "retention", "engagement", "lifecycle", "media", "social", "seo", "sem", "crm", "erp", "saas", "b2b",
  "b2c", "fintech", "edtech", "healthtech", "web", "app", "database", "dba", "site", "reliability", "sre", "secops",
  "infosec", "cyber", "systrack", "ahmedabad", "bangalore", "bengaluru", "hyderabad", "delhi", "mumbai", "pune",
  "spanish", "german", "french", "italian", "japanese", "mandarin", "chinese", "apac", "emea", "latam", "americas"
]);

/**
 * Splits concatenated unspaced titles like "enterprisecustomersuccessmanager" into clean English words.
 */
export function splitUnspacedTitle(str: string): string {
  if (!str) return str;
  const s = str.toLowerCase().trim();
  const n = s.length;

  const dp: Array<string[] | null> = new Array(n + 1).fill(null);
  dp[0] = [];

  for (let i = 0; i < n; i++) {
    if (dp[i] === null) continue;

    for (let j = i + 1; j <= n; j++) {
      const word = s.substring(i, j);
      if (TITLE_DICTIONARY_WORDS.has(word)) {
        if (dp[j] === null || dp[j]!.length > dp[i]!.length + 1) {
          dp[j] = [...dp[i]!, word];
        }
      }
    }
  }

  if (dp[n] !== null) {
    return dp[n]!
      .map(w => {
        if (["ai", "ml", "hr", "pr", "qa", "vp", "ceo", "cto", "cfo", "coo", "cpo", "gtm", "ii", "iii", "iv", "sre", "dba", "erp", "crm", "seo", "sem", "apac", "emea", "latam"].includes(w)) {
          return w.toUpperCase();
        }
        if (["of", "and", "in", "at", "to", "for", "with", "the"].includes(w)) {
          return w.toLowerCase();
        }
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Normalizes a job title for display with proper spacing and title casing,
 * while automatically repairing unspaced titles.
 */
export function cleanJobTitle(title: string): string {
  if (!title) return "Job Opening";

  // 1. Separate camelCase / PascalCase transitions (e.g. "CustomerSuccess" -> "Customer Success")
  let cleaned = title
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 2. If title was stripped of spaces (like 'enterprisecustomersuccessmanager'), segment words
  if (cleaned.length > 10 && !cleaned.includes(" ")) {
    cleaned = splitUnspacedTitle(cleaned);
  }

  // 3. If all lowercase or all uppercase (and > 4 chars), title-case appropriately
  const isAllLower = cleaned === cleaned.toLowerCase();
  const isAllUpper = cleaned === cleaned.toUpperCase() && cleaned.length > 4;
  if ((isAllLower || isAllUpper) && cleaned.includes(" ")) {
    cleaned = cleaned
      .split(" ")
      .map(w => {
        const lower = w.toLowerCase();
        if (["ai", "ml", "hr", "pr", "qa", "vp", "ceo", "cto", "cfo", "coo", "cpo", "gtm", "ii", "iii", "iv", "sre", "dba", "erp", "crm", "seo", "sem", "apac", "emea", "latam"].includes(lower)) {
          return lower.toUpperCase();
        }
        if (["of", "and", "in", "at", "to", "for", "with", "the"].includes(lower)) {
          return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
  }

  return cleaned.trim();
}

/**
 * Normalizes a job title for display with proper word spacing.
 */
export function normalizeJobTitle(title: string): string {
  return cleanJobTitle(title);
}

/**
 * Generates an alphanumeric fingerprint solely for duplicate detection.
 */
export function getJobTitleFingerprint(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Evaluates whether a scraped job meets all eligibility criteria for ProxNet:
 * 1. Valid title and description length
 * 2. Posted within the last 30 days
 * 3. Located in India or valid India-friendly remote
 * 4. Not a junior / intern role (< 3 years exp)
 */
export function isJobEligible(job: {
  title: string;
  location?: string | null;
  description?: string | null;
  posted_at?: string | null;
}): { eligible: boolean; reason?: string } {
  if (!job.title || job.title.trim().length < 3 || job.title === "Unknown Title") {
    return { eligible: false, reason: "Invalid or empty job title" };
  }

  // 30-Day Freshness Filter
  if (!isJobFresh(job.posted_at, 30)) {
    return { eligible: false, reason: `Posted more than 30 days ago (${job.posted_at})` };
  }

  // India Location Filter
  if (!isIndiaLocation(job.location, job.description)) {
    return { eligible: false, reason: `Location '${job.location || "unspecified"}' does not match India criteria` };
  }

  // Junior Role Filter
  if (isJuniorJob(job.title, job.description)) {
    return { eligible: false, reason: "Junior or intern role (< 3 years exp)" };
  }

  return { eligible: true };
}
