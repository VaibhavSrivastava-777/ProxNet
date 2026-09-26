const WORDS = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff", "associate", "director", "manager", "head", "vp",
  "vice", "president", "consultant", "advisory", "architect", "engineer", "engineering", "developer", "specialist",
  "analyst", "administrator", "admin", "executive", "representative", "officer", "coordinator", "intern", "trainee",
  "founder", "general", "chief", "product", "program", "project", "technical", "technology", "data", "software",
  "hardware", "cloud", "security", "devops", "platform", "infrastructure", "systems", "network", "qa", "quality",
  "test", "testing", "automation", "frontend", "front", "end", "backend", "back", "fullstack", "full", "stack",
  "mobile", "ios", "android", "ai", "ml", "machine", "learning", "deep", "nlp", "llm", "genai", "computer",
  "vision", "research", "scientist", "science", "analytics", "business", "operations", "ops", "sales", "marketing",
  "growth", "customer", "success", "support", "service", "services", "experience", "gtm", "commercial", "enterprise",
  "strategic", "strategy", "account", "partner", "partnerships", "finance", "financial", "accounting", "talent",
  "people", "hr", "human", "resources", "recruiter", "recruiting", "legal", "compliance", "procurement", "supply",
  "chain", "logistics", "warehouse", "brand", "creative", "design", "designer", "content", "writer", "communications",
  "relations", "pr", "merchandiser", "merchandising", "vendor", "retail", "solutions", "office", "ceo", "cto",
  "cfo", "coo", "cpo", "with", "and", "of", "for", "in", "at", "to", "the", "ii", "iii", "iv", "v",
  "contract", "contractor", "months", "month", "lead", "head", "specialist", "management"
]);

export function splitUnspacedTitle(str: string): string {
  if (!str) return str;
  const s = str.toLowerCase().trim();
  const n = s.length;

  // dp[i] holds array of words for prefix of length i, or null if unreachable
  const dp: Array<string[] | null> = new Array(n + 1).fill(null);
  dp[0] = [];

  for (let i = 0; i < n; i++) {
    if (dp[i] === null) continue;

    for (let j = i + 1; j <= n; j++) {
      const word = s.substring(i, j);
      if (WORDS.has(word)) {
        // prefer paths with fewer, longer words
        if (dp[j] === null || dp[j]!.length > dp[i]!.length + 1) {
          dp[j] = [...dp[i]!, word];
        }
      }
    }
  }

  if (dp[n] !== null) {
    return dp[n]!
      .map(w => {
        // acronyms or roman numerals uppercase
        if (["ai", "ml", "hr", "pr", "qa", "vp", "ceo", "cto", "cfo", "coo", "cpo", "gtm", "ii", "iii", "iv"].includes(w)) {
          return w.toUpperCase();
        }
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  // Fallback: greedy regex / original string
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const tests = [
  "enterprisecustomersuccessmanager",
  "businessoperationslead",
  "directorofcommercialsales",
  "managerbusinessfinance",
  "deputymanagerprocurement",
  "seniorconsultant",
  "advisoryconsultant",
  "technicalproductmarketingmanagerstaff"
];

for (const t of tests) {
  console.log(`"${t}" => "${splitUnspacedTitle(t)}"`);
}
