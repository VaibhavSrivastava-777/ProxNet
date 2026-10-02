import { useMemo } from "react";
import type { CompanyJobBundle } from "@/app/api/jobs/discover-company-jobs/route";
import { calculateProfileMatchScore } from "@/lib/matching/profile-similarity";

export interface MatchReason {
  label: string;
  icon: string;
  category: "company" | "education" | "society" | "role" | "scrapbook" | "jobs" | "proximity";
}

export interface RankedProfile {
  person: any;
  score: number;
  reasons: MatchReason[];
  primaryReason: string;
  jobsBundle?: CompanyJobBundle | null;
}

const HIGH_SIGNAL_ROLE_KEYWORDS = [
  "developer", "engineer", "frontend", "backend", "fullstack", "devops",
  "architect", "product", "manager", "designer", "ui", "ux",
  "analyst", "founder", "cto", "ceo", "consultant", "marketer",
  "recruiter", "sales", "ai", "ml", "data", "lead"
];

function normalize(str?: any): string {
  if (!str) return "";
  if (typeof str === "string") return str.trim().toLowerCase();
  if (Array.isArray(str) && str.length > 0) {
    const first = str[0];
    if (typeof first === "string") return first.trim().toLowerCase();
    if (first?.short_code) return String(first.short_code).trim().toLowerCase();
    if (first?.name) return String(first.name).trim().toLowerCase();
  }
  if (typeof str === "object") {
    if (str.short_code) return String(str.short_code).trim().toLowerCase();
    if (str.name) return String(str.name).trim().toLowerCase();
  }
  try {
    return String(str).trim().toLowerCase();
  } catch {
    return "";
  }
}

function wordMatchOverlap(titleA?: string | null, titleB?: string | null): boolean {
  if (!titleA || !titleB) return false;
  const a = normalize(titleA);
  const b = normalize(titleB);
  for (const kw of HIGH_SIGNAL_ROLE_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(a) && regex.test(b)) {
      return true;
    }
  }
  return false;
}

function arrayOverlap(arrA?: string[] | null, arrB?: string[] | null): boolean {
  if (!arrA || !arrB || !arrA.length || !arrB.length) return false;
  const setB = new Set(arrB.map(s => normalize(s)));
  for (const item of arrA) {
    const norm = normalize(item);
    if (!norm) continue;
    for (const bItem of setB) {
      if (bItem.includes(norm) || norm.includes(bItem)) {
        return true;
      }
    }
  }
  return false;
}

export function rankDiscoverProfiles({
  people,
  profile,
  companyJobsMap,
  excludedIds,
}: {
  people: any[];
  profile: any;
  companyJobsMap?: Record<string, CompanyJobBundle>;
  excludedIds?: Set<string>;
}): RankedProfile[] {
  if (!people || !people.length) return [];

    const currentUserId = profile?.id;
    const myCompany = normalize(profile?.company);
    const myInst = normalize(profile?.institute_name);
    const mySoc = normalize(profile?.society_name);
    const myRole = profile?.job_title;
    const myHelpOffers = profile?.help_offers || [];
    const myAskMeAbout = profile?.ask_me_about || [];
    const myTinkering = profile?.tinkering_with || [];

    const candidates: RankedProfile[] = [];

    for (const person of people) {
      if (!person || !person.id) continue;

      // Exclude self only
      if (currentUserId && person.id === currentUserId) continue;
      if (person.is_me) continue;

      // ── Hybrid Match Scoring Engine ──
      // Combines real-world structural affinities (Company, College, Society, Role, Skills, Proximity)
      // with semantic vector similarity, instead of relying entirely on vector cosine similarity.
      const { similarity } = calculateProfileMatchScore(profile, person);
      
      let hybridScore = 48; // Base confidence for verified network members

      const reasons: MatchReason[] = [];

      const targetCompany = normalize(person.company);
      const targetInst = normalize(person.institute_name);
      const targetSoc = normalize(person.society_name);
      const targetRole = person.job_title;
      const targetHelpOffers = person.help_offers || [];
      const targetAskMeAbout = person.ask_me_about || [];
      const targetTinkering = person.tinkering_with || [];

      // 1. Same Company badge (+25%)
      if (myCompany && targetCompany && myCompany === targetCompany && myCompany.length > 1) {
        hybridScore += 25;
        reasons.push({
          label: `Both of you work at ${person.company}`,
          icon: "🏢",
          category: "company",
        });
      }

      // 2. Same Alumni Network badge (+20%)
      if (myInst && targetInst && myInst === targetInst && myInst.length > 2) {
        hybridScore += 20;
        reasons.push({
          label: `Alumni of ${person.institute_name}`,
          icon: "🎓",
          category: "education",
        });
      }

      // 3. Same Residential Society badge (+20%)
      if (mySoc && targetSoc && mySoc === targetSoc && mySoc.length > 2) {
        hybridScore += 20;
        reasons.push({
          label: `Neighbour in ${person.society_name}`,
          icon: "🏡",
          category: "society",
        });
      }

      // 4. Role Match badge (+15%)
      if (wordMatchOverlap(myRole, targetRole)) {
        hybridScore += 15;
        reasons.push({
          label: `Both working in ${targetRole || "similar"} roles`,
          icon: "💼",
          category: "role",
        });
      }

      // 5. Scrapbook Synergy badge (+15%)
      const offersMatchNeeds = arrayOverlap(targetHelpOffers, [...myAskMeAbout, ...myTinkering]);
      const myOffersMatchNeeds = arrayOverlap(myHelpOffers, [...targetAskMeAbout, ...targetTinkering]);

      if (offersMatchNeeds || myOffersMatchNeeds) {
        hybridScore += 15;
        const offerSample = targetHelpOffers[0] || myHelpOffers[0];
        reasons.push({
          label: offerSample ? `Synergy: Can help with ${offerSample}` : "Complementary skills in scrapbook",
          icon: "🤝",
          category: "scrapbook",
        });
      }

      // 6. Job opportunities at company / competitors (+10% / +5%)
      let jobsBundle: CompanyJobBundle | null = null;
      if (companyJobsMap && targetCompany) {
        jobsBundle = companyJobsMap[targetCompany] || null;
        if (jobsBundle) {
          const exactCount = jobsBundle.exactJobs.length;
          const compCount = jobsBundle.competitorJobs.length;

          if (exactCount > 0) {
            hybridScore += 10;
            reasons.push({
              label: `${exactCount} open role${exactCount > 1 ? "s" : ""} at ${person.company}`,
              icon: "🔥",
              category: "jobs",
            });
          } else if (compCount > 0) {
            hybridScore += 5;
            reasons.push({
              label: `${compCount} role${compCount > 1 ? "s" : ""} at competitor companies`,
              icon: "⚔️",
              category: "jobs",
            });
          }
        }
      }

      // 7. Distance Proximity badge (+4% to +8%)
      if (person.distance != null) {
        if (person.distance <= 500) {
          hybridScore += 8;
          reasons.push({
            label: `Super close: within ${Math.round(person.distance)}m`,
            icon: "📍",
            category: "proximity",
          });
        } else if (person.distance <= 1500) {
          hybridScore += 5;
          reasons.push({
            label: `Nearby: ${(person.distance / 1000).toFixed(1)}km away`,
            icon: "📍",
            category: "proximity",
          });
        } else if (person.distance <= 3000) {
          hybridScore += 3;
        }
      }

      // 8. Semantic vector similarity contribution (up to +18%)
      if (similarity > 0.05) {
        hybridScore += Math.round(similarity * 20);
      }

      // Calibrate final score to realistic 48% - 98%
      const finalScore = Math.min(98, Math.max(48, hybridScore));

      // Choose most compelling primary reason
      let primaryReason = reasons[0]?.label || "Verified professional in your neighbourhood";
      if (reasons.some(r => r.category === "company")) {
        primaryReason = reasons.find(r => r.category === "company")!.label;
      } else if (reasons.some(r => r.category === "education")) {
        primaryReason = reasons.find(r => r.category === "education")!.label;
      } else if (reasons.some(r => r.category === "society")) {
        primaryReason = reasons.find(r => r.category === "society")!.label;
      }

      candidates.push({
        person,
        score: finalScore,
        reasons,
        primaryReason,
        jobsBundle,
      });
    }

    // Sort descending by score, then ascending by distance
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const distA = a.person.distance ?? 999999;
      const distB = b.person.distance ?? 999999;
      return distA - distB;
    });

    return candidates;
}

export function useDiscoverRanking({
  people,
  profile,
  companyJobsMap,
  excludedIds,
}: {
  people: any[];
  profile: any;
  companyJobsMap?: Record<string, CompanyJobBundle>;
  excludedIds?: Set<string>;
}): RankedProfile[] {
  return useMemo(
    () =>
      rankDiscoverProfiles({
        people,
        profile,
        companyJobsMap,
        excludedIds,
      }),
    [people, profile, companyJobsMap, excludedIds]
  );
}
