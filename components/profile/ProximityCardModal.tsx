"use client";

import React, { useState } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";

export interface ProximityCardModalProps {
  person: any;
  currentUserProfile?: any;
  onClose: () => void;
  onStartChat?: (person: any) => void;
  onFollowToggle?: (e: React.MouseEvent, person: any) => void;
  onJoinBeacon?: (beacon: any, person: any) => void;
  userBeacon?: any;
}

const CHAT_PREF_LABELS: Record<string, { label: string; icon: string }> = {
  chai: { label: "Down for a 15-min chai", icon: "☕" },
  walk: { label: "Evening walk & talk", icon: "🚶" },
  weekend_coffee: { label: "Weekend coffee friendly", icon: "🥐" },
  dm_only: { label: "Direct messages preferred", icon: "💬" },
};

function formatDistance(meters?: number | null): string {
  if (meters == null || meters === undefined) return "Within 2km";
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

function getInitials(name?: string): string {
  if (!name) return "N";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function computeReasonToEngage(myProfile: any, targetPerson: any): { reason: string; category: string } | null {
  if (!myProfile || !targetPerson) return null;

  const myCompany = (myProfile.company || "").trim().toLowerCase();
  const targetCompany = (targetPerson.company || "").trim().toLowerCase();

  // 1. Same Company
  if (myCompany && targetCompany && myCompany === targetCompany && myCompany.length > 1) {
    return {
      reason: `Both of you work at ${targetPerson.company}`,
      category: "company",
    };
  }

  // 2. Shared Institute / Alumni Network
  const myInst = (myProfile.institute_name || "").trim().toLowerCase();
  const targetInst = (targetPerson.institute_name || "").trim().toLowerCase();
  if (myInst && targetInst && myInst === targetInst) {
    return {
      reason: `Both of you are alumni of ${targetPerson.institute_name}`,
      category: "education",
    };
  }

  // 3. Shared Residential Society / Complex
  const mySoc = (myProfile.society_name || "").trim().toLowerCase();
  const targetSoc = (targetPerson.society_name || "").trim().toLowerCase();
  if (mySoc && targetSoc && mySoc === targetSoc) {
    return {
      reason: `Both of you live in ${targetPerson.society_name}`,
      category: "society",
    };
  }

  // 4. Same Role / Occupation
  const myRole = (myProfile.job_title || "").trim().toLowerCase();
  const targetRole = (targetPerson.job_title || "").trim().toLowerCase();
  if (myRole && targetRole) {
    const roleKeywords = ["developer", "engineer", "designer", "product", "manager", "architect", "consultant", "analyst", "founder", "director", "marketer", "recruiter"];
    for (const kw of roleKeywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, "i");
      if (kwRegex.test(myRole) && kwRegex.test(targetRole)) {
        return {
          reason: `Both of you work in ${targetPerson.job_title} roles`,
          category: "occupation",
        };
      }
    }
  }

  return null;
}

function extractActionableCommunityProfile(person: any): {
  askMeAbout: string[];
  helpOffers: string[];
  tinkeringWith: string[];
} {
  if (!person) return { askMeAbout: [], helpOffers: [], tinkeringWith: [] };

  const digest = person.profile_digest || {};
  const skills: string[] = Array.isArray(digest.skills)
    ? digest.skills.filter((s: any) => typeof s === "string" && !s.toLowerCase().startsWith("skill"))
    : [];
  const rawTags: string[] = (person.tags || [])
    .map((t: string) => t.replace(/^#+/, "").trim())
    .filter(Boolean);

  const bio: string = (person.professional_bio || person.about || digest.summary || "").trim();
  const resume: string = (person.resume_text || "").trim();
  const combinedText = `${person.job_title || ""} ${person.company || ""} ${bio} ${resume} ${rawTags.join(" ")}`.toLowerCase();
  const company = (person.company || "").trim();
  const title = (person.job_title || "").trim();
  const inst = (person.institute_name || person.institute_affiliation || "").trim();
  const society = (person.society_name || "").trim();

  // Parse years of experience
  let expYears: number | null = typeof digest.experienceYears === "number" ? digest.experienceYears : null;
  if (!expYears) {
    const yrMatch = bio.match(/(\d{1,2})\+?\s*(?:years|yrs)/i) || resume.match(/(\d{1,2})\+?\s*(?:years|yrs)/i);
    if (yrMatch) {
      expYears = parseInt(yrMatch[1], 10);
    }
  }

  const isSeniorLeader = /manager|director|vp|head|founder|principal|architect|lead/i.test(title) || (expYears !== null && expYears >= 8);
  const isTechRole = /developer|engineer|architect|tech|software|devops|data|ai|ml|fullstack|frontend|backend/i.test(title) || combinedText.includes("software") || combinedText.includes("engineering");
  const isProductRole = /product|pm|ui\/ux|design/i.test(title);
  const isSalesRole = /sales|business development|b2b|account executive|gtm/i.test(title);
  const isFinanceRole = /finance|financial|consultant|consulting|audit|fp&a|analyst/i.test(title);
  const isCsRole = /customer success|client success|retention|support/i.test(title);

  // --- 1. ASK ME ABOUT ---
  const askList: string[] = [];
  const genericTokens = ["tech & product", "bangalore tech scene", "best practices", "skill1", "skill2"];

  if (Array.isArray(person.ask_me_about)) {
    for (const item of person.ask_me_about) {
      if (typeof item === "string" && item.trim()) {
        const clean = item.trim();
        if (!genericTokens.some((tok) => clean.toLowerCase().includes(tok))) {
          askList.push(clean);
        }
      }
    }
  }

  // Tags
  for (const tag of rawTags) {
    if (tag.length > 2 && !genericTokens.some((tok) => tag.toLowerCase().includes(tok))) {
      askList.push(tag);
    }
  }

  // Skills mapping
  for (const sk of skills) {
    const sLower = sk.toLowerCase();
    if (sLower.includes("software development") || sLower.includes("software engineering")) {
      askList.push("Software Architecture & Scalable Systems");
    } else if (sLower.includes("project management") || sLower.includes("agile")) {
      askList.push("Project Management & Agile Delivery");
    } else if (sLower.includes("problem-solving")) {
      askList.push("Technical Problem Solving & System Design");
    } else if (sLower.includes("team collaboration") || sLower.includes("leadership")) {
      askList.push("Engineering Collaboration & Team Culture");
    } else if (sLower.length >= 2 && !askList.includes(sk)) {
      askList.push(sk);
    }
  }

  // Deep domain detection
  if (combinedText.includes("financial technology") || combinedText.includes("trading") || combinedText.includes("fintech") || combinedText.includes("capital market")) {
    askList.push("FinTech & Capital Markets Architecture");
  }
  if (combinedText.includes("ai") || combinedText.includes("machine learning") || combinedText.includes("llm") || combinedText.includes("data science")) {
    askList.push("AI/ML Integration & Emerging Tech");
  }
  if (combinedText.includes("cloud") || combinedText.includes("devops") || combinedText.includes("kubernetes") || combinedText.includes("distributed")) {
    askList.push("Cloud Infrastructure & Distributed Systems");
  }
  if (combinedText.includes("security") || combinedText.includes("zero trust") || combinedText.includes("cyber") || combinedText.includes("zscaler")) {
    askList.push("Zero Trust Architecture & Enterprise Security");
  }
  if (isProductRole || combinedText.includes("product strategy") || combinedText.includes("roadmap")) {
    askList.push("Product Strategy & Roadmap Prioritization");
  }
  if (isSalesRole || combinedText.includes("enterprise sales")) {
    askList.push("Enterprise B2B Sales & GTM Execution");
  }
  if (isFinanceRole) {
    askList.push("Corporate Finance & Strategic Analysis");
  }
  if (isCsRole) {
    askList.push("Customer Success & Retention Metrics");
  }

  // Seniority & Leadership Guidance
  if (isSeniorLeader) {
    if (expYears && expYears >= 10) {
      askList.push(`Senior Leadership & Org Scaling (${expYears}+ Years)`);
    } else {
      askList.push("Tech Leadership & Cross-Functional Execution");
    }
  }

  // Company Culture & Interview Insights
  if (company && company.toLowerCase() !== "independent / startup" && company.toLowerCase() !== "nearby company") {
    const culturePhrase = isTechRole ? `Engineering culture & teams at ${company}` : `Work culture & team dynamics at ${company}`;
    askList.push(culturePhrase);
    if (isSeniorLeader || /google|mckinsey|lseg|zscaler|wipro|nagarro|persistent|microsoft|amazon/i.test(company)) {
      askList.push(`Hiring loops & interview expectations at ${company}`);
    }
  }

  // Alumni & Institute
  if (inst) {
    askList.push(`${inst} alumni network & career journey`);
  }
  // Local society
  if (society) {
    askList.push(`Neighborhood community & life in ${society}`);
  }

  // Deduplicate and select top 4
  const uniqueAsk = Array.from(new Set(askList)).slice(0, 4);
  if (uniqueAsk.length === 0) {
    if (title) uniqueAsk.push(`${title} Strategy & Tooling`);
    if (company) uniqueAsk.push(`Working culture at ${company}`);
    uniqueAsk.push("Tech Ecosystem & Career Navigation");
  }

  // --- 2. I CAN HELP WITH ---
  const helpList: string[] = [];
  const genericHelpTokens = ["tech advice & peer connection", "resume review & career navigation"];

  if (Array.isArray(person.help_offers)) {
    for (const item of person.help_offers) {
      if (typeof item === "string" && item.trim()) {
        const clean = item.trim();
        if (!genericHelpTokens.some((tok) => clean.toLowerCase().includes(tok))) {
          helpList.push(clean);
        }
      }
    }
  }

  // Company referrals
  if (company && company.toLowerCase() !== "independent / startup" && company.toLowerCase() !== "nearby company") {
    helpList.push(`Internal referrals & team navigation at ${company}`);
    helpList.push(`Interview prep & insider guidance for ${company}`);
  }

  // Role-specific help
  if (isSeniorLeader) {
    helpList.push("Mentorship for professionals stepping into Leadership");
    helpList.push("Team scaling, hiring playbooks & org design");
  }

  if (isTechRole) {
    helpList.push("System design reviews & architectural sounding board");
    helpList.push("Technical resume review & coding prep");
  } else if (isProductRole) {
    helpList.push("PRD breakdowns, MVP scoping & user discovery");
    helpList.push("Product interview prep & case studies");
  } else if (isSalesRole) {
    helpList.push("Enterprise deal closing & B2B pipeline strategy");
  } else if (isFinanceRole) {
    helpList.push("Financial modeling & consulting interview prep");
  } else if (isCsRole) {
    helpList.push("Customer onboarding playbooks & churn reduction");
  }

  if (inst) {
    helpList.push(`Mentoring fellow ${inst} graduates`);
  }

  helpList.push("Cross-domain peer networking & career navigation");

  const uniqueHelp = Array.from(new Set(helpList)).slice(0, 4);

  // --- 3. TINKERING WITH ---
  const tinkerList: string[] = [];
  if (Array.isArray(person.tinkering_with)) {
    for (const item of person.tinkering_with) {
      if (typeof item === "string" && item.trim()) {
        tinkerList.push(item.trim());
      }
    }
  }

  if (tinkerList.length === 0) {
    if (isTechRole) {
      tinkerList.push("Autonomous AI Agents & Local LLMs");
      tinkerList.push("Serverless Edge Architectures");
    } else if (isProductRole) {
      tinkerList.push("AI-driven user research & rapid prototyping");
    } else if (isSeniorLeader) {
      tinkerList.push("AI productivity workflows for high-performing teams");
    }
  }

  return {
    askMeAbout: uniqueAsk,
    helpOffers: uniqueHelp,
    tinkeringWith: Array.from(new Set(tinkerList)).slice(0, 3),
  };
}

export function ProximityCardModal({
  person,
  currentUserProfile,
  onClose,
  onStartChat,
  onFollowToggle,
  onJoinBeacon,
  userBeacon,
}: ProximityCardModalProps) {
  const [copied, setCopied] = useState(false);
  const [isCelebrated, setIsCelebrated] = useState(person?.is_celebrated || false);
  const [celebrating, setCelebrating] = useState(false);
  const [graffitiToast, setGraffitiToast] = useState<{ name: string } | null>(null);

  if (!person) return null;

  const visibility = person.visibility || {
    showCompany: true,
    showTitle: true,
    showPhoto: true,
  };

  const pref = person.quick_chat_preference
    ? CHAT_PREF_LABELS[person.quick_chat_preference] || {
        label: person.quick_chat_preference,
        icon: "☕",
      }
    : { label: "Down for a 15-min chai", icon: "☕" };

  const displayName = person.full_name || person.anonymous_name || "Neighbor Professional";
  const displayCompany = visibility.showCompany !== false
    ? person.company || "Independent / Startup"
    : "Company Protected";
  const displayTitle = visibility.showTitle !== false
    ? person.job_title || "Professional"
    : "Title Protected";
  const showPhoto = visibility.showPhoto !== false && !!person.profile_photo_url;

  const engagement = computeReasonToEngage(currentUserProfile, person);
  const distanceStr = formatDistance(person.distance);

  // Deep, actionable community intelligence mining
  const {
    askMeAbout: askMeAboutList,
    helpOffers: helpOffersList,
    tinkeringWith: tinkeringWithList,
  } = extractActionableCommunityProfile(person);

  const handleShare = () => {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/network` : "https://www.proxnet.in/network";
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCelebrate = async () => {
    if (isCelebrated || celebrating || (currentUserProfile && currentUserProfile.id === person.id)) return;
    setCelebrating(true);
    setIsCelebrated(true);
    setGraffitiToast({ name: displayName });
    setTimeout(() => {
      setGraffitiToast(null);
    }, 4500);

    try {
      await fetch("/api/profile-celebrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: person.id,
          graffitiNote: "celebrated your professional profile and contributions in the community!",
        }),
      });
    } catch (err) {
      console.error("[ProximityCardModal] Celebrate error:", err);
    } finally {
      setCelebrating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-all animate-scaleIn max-h-[92vh] flex flex-col relative"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with proximity badge & Close Button */}
        <div className="h-28 w-full bg-gradient-to-r from-blue-500/20 via-teal-500/20 to-purple-500/25 p-4 flex items-start justify-between border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/40 text-white backdrop-blur-sm border border-white/10">
              <span>📍</span> Network Proximity View
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {distanceStr}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer text-sm font-bold shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Floating Celebration Toast Banner */}
        {graffitiToast && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white shadow-xl border border-white/30 flex items-center gap-3 animate-scaleIn z-10 shrink-0">
            <span className="text-2xl shrink-0">🎉</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black m-0 truncate">
                You celebrated {graffitiToast.name}!
              </p>
              <p className="text-[11px] text-white/90 m-0 mt-0.5">
                A graffiti notice has been delivered to their ProxNet profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGraffitiToast(null)}
              className="text-white/80 hover:text-white bg-transparent border-0 cursor-pointer text-xs p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Card Body */}
        <div className="px-6 pb-6 pt-0 relative -mt-10 overflow-y-auto flex-1">
          {/* Avatar and Quick Chat Preference Row */}
          <div className="flex items-end justify-between mb-4">
            <div className="relative">
              {showPhoto ? (
                <img
                  src={person.profile_photo_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-[var(--color-surface)] shadow-md bg-[var(--color-surface-secondary)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl border-4 border-[var(--color-surface)] shadow-md">
                  {getInitials(displayName)}
                </div>
              )}
              {person.company && visibility.showCompany !== false && (
                <div className="absolute -bottom-1 -right-1 bg-[var(--color-surface)] p-1 rounded-lg shadow-sm border border-[var(--color-border)]">
                  <CompanyLogo company={person.company} size={20} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <span>{pref.icon}</span> {pref.label}
              </span>
            </div>
          </div>

          {/* Name & Headline */}
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--color-text)] m-0">
                {displayName}
              </h2>
              {person.anonymous_name && (
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                  @{person.anonymous_name}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-[var(--color-text-secondary)] m-0">
              {displayTitle} {visibility.showCompany !== false && person.company ? `at ${displayCompany}` : ""}
            </p>

            {(person.society_name || person.institute_name || person.institute_affiliation) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--color-text-tertiary)]">
                {person.society_name && (
                  <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    <span>🏡</span> {person.society_name}
                  </span>
                )}
                {(person.institute_name || person.institute_affiliation) && (
                  <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    <span>🎓</span> {person.institute_name || person.institute_affiliation}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Reason to Engage Callout */}
          {engagement && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm animate-fadeIn mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">✨</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Reason to Engage
                </span>
              </div>
              <p className="text-xs font-serif italic leading-relaxed m-0 text-amber-800 dark:text-amber-100">
                &quot;{engagement.reason}&quot;
              </p>
            </div>
          )}

          {/* Live Beacon Callout (if active) */}
          {userBeacon && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Live Beacon Active
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {userBeacon.activity === "chai" ? "☕ Ready for Chai" : userBeacon.activity === "walk" ? "🚶 Out for a Walk" : "🤝 Quick Meet"}
                    {userBeacon.note ? ` • "${userBeacon.note}"` : ""}
                  </span>
                </div>
              </div>
              {onJoinBeacon && (
                <button
                  type="button"
                  onClick={() => onJoinBeacon(userBeacon, person)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm border-none cursor-pointer transition-transform hover:scale-105"
                >
                  Join Now
                </button>
              )}
            </div>
          )}

          {/* Professional Bio / About */}
          {(person.professional_bio || person.about) && (
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
              <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-[var(--color-text)]">
                <span>📝</span> Professional Bio
              </div>
              {person.professional_bio || person.about}
            </div>
          )}

          {/* Neighbor Scrapbook Tags: Actionable, Deep Community Insights */}
          <div className="space-y-3.5 pt-3 border-t border-[var(--color-border-light)]">
            {askMeAboutList.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <span>💬</span>
                  <span>Ask Me About:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {askMeAboutList.map((topic: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 transition-all hover:bg-blue-500/15"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {helpOffersList.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <span>🤝</span>
                  <span>I Can Help With:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {helpOffersList.map((offer: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition-all hover:bg-emerald-500/15"
                    >
                      {offer}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tinkeringWithList.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <span>🛠️</span>
                  <span>Tinkering With:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tinkeringWithList.map((item: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-all hover:bg-purple-500/15"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border-light)] flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5">
            {onStartChat && (
              <button
                type="button"
                onClick={() => onStartChat(person)}
                className="flex-1 py-2.5 px-3 text-center text-xs font-bold rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-[100px]"
              >
                <span>👋</span>
                <span>Say Hi</span>
              </button>
            )}

            {/* Celebrate Button */}
            {(!currentUserProfile || currentUserProfile.id !== person.id) && (
              <button
                type="button"
                onClick={handleCelebrate}
                disabled={isCelebrated || celebrating}
                className={`flex-1 py-2.5 px-3 text-center text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border-0 min-w-[105px] ${
                  isCelebrated
                    ? "bg-amber-500 text-white shadow-amber-500/20 cursor-default"
                    : "bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white hover:opacity-95 active:scale-95 shadow-rose-500/25"
                }`}
                title="Celebrate Profile (Sends Graffiti Cheer)"
              >
                <span className="shrink-0">🎉</span>
                <span>{isCelebrated ? "Celebrated!" : "Celebrate"}</span>
              </button>
            )}

            {onFollowToggle && (
              <button
                type="button"
                onClick={(e) => onFollowToggle(e, person)}
                className={`py-2.5 px-3 text-center text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  person.is_followed
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-[var(--color-primary)]/20"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {person.is_followed ? "✓ Following" : "+ Follow"}
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="py-2.5 px-2.5 text-center text-xs font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
              title="Share profile"
            >
              <span>{copied ? "✓" : "🔗"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
