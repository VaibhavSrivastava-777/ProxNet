"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { ResumeCard } from "./ResumeCard";
import { ReferralPitchModal } from "./ReferralPitchModal";
import { TargetCompanyManager } from "./TargetCompanyManager";
import { ApplicationPipeline } from "./ApplicationPipeline";
import { DeepConversionModal } from "./DeepConversionModal";
import type { ConversionBlueprint } from "@/lib/jobs/deep-conversion-miner";
import { JobInbox } from "./JobInbox";
import { playNotificationSound } from "@/lib/sound";
import { cleanJobTitle, isSameCompany } from "@/lib/jobs/job-filters";
import { ProximityCardModal } from "@/components/profile/ProximityCardModal";
import { DeepFetchModal } from "./DeepFetchModal";
import { QuestionForm } from "@/components/qa/QuestionForm";
import { ColdOutreachModal } from "./ColdOutreachModal";
import { ApplicationSprintMode } from "./ApplicationSprintMode";
import { CompanyResearchModal } from "./CompanyResearchModal";
import { BridgeRequestModal } from "./BridgeRequestModal";

interface SuggestedJob {
  id: string;
  title: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  keywords: string[];
  matchRate: number;
  score?: number;
  label?: string;
  reason?: string;
}

interface CompanyGroup {
  company: string;
  contactsCount: number;
  referralContacts: Array<{ id: string; alias: string; is_followed?: boolean }>;
  jobs: SuggestedJob[];
}

interface ProfileDigest {
  skills?: string[];
  summary?: string;
  experienceYears?: number;
}

interface NearbyHelper {
  id: string;
  full_name: string | null;
  anonymous_name: string;
  job_title: string;
  company: string;
  distance: number | null;
  profile_photo_url: string | null;
  is_followed?: boolean;
}

interface JobsCachePayload {
  companies: CompanyGroup[];
  allCompanies: CompanyGroup[];
  profileDigest: ProfileDigest | null;
  hasResume: boolean;
  resumeUrl: string | null;
  wallet: number;
  currentUserId: string | null;
  currentUserCompany: string | null;
  userInviteCode: string | null;
  nearbyHelpers: NearbyHelper[];
  isMatchingCompleted: boolean;
  deepConversionBlueprints?: ConversionBlueprint[];
  timestamp: number;
}

const JOBS_CACHE_KEY = "proxnet_last_jobs_pull_v2";

// In-memory module cache to persist across client-side tab switching without any disk hit
let memoryJobsCache: JobsCachePayload | null = null;
// Track whether we've already executed a refresh during the current full page load
let hasRefreshedInCurrentPageLoad = false;

function getStoredJobsCache(): JobsCachePayload | null {
  if (memoryJobsCache) return memoryJobsCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(JOBS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryJobsCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function saveJobsCache(payload: Partial<JobsCachePayload>) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredJobsCache() || {
      companies: [],
      allCompanies: [],
      profileDigest: null,
      hasResume: true,
      resumeUrl: null,
      wallet: 0,
      currentUserId: null,
      currentUserCompany: null,
      userInviteCode: null,
      nearbyHelpers: [],
      isMatchingCompleted: true,
      deepConversionBlueprints: [],
      timestamp: Date.now(),
    };
    const updated: JobsCachePayload = {
      ...existing,
      ...payload,
      timestamp: Date.now(),
    };
    memoryJobsCache = updated;
    localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function SuggestedJobs() {
  const initialCache = getStoredJobsCache();

  const [companies, setCompanies] = useState<CompanyGroup[]>(() => initialCache?.companies || []);
  const [allCompanies, setAllCompanies] = useState<CompanyGroup[]>(() => initialCache?.allCompanies || []);
  const [jobsViewMode, setJobsViewMode] = useState<"matched" | "all">("matched");
  const [profileDigest, setProfileDigest] = useState<ProfileDigest | null>(() => initialCache?.profileDigest || null);
  const [hasResume, setHasResume] = useState<boolean>(() => initialCache?.hasResume ?? true);
  const [resumeUrl, setResumeUrl] = useState<string | null>(() => initialCache?.resumeUrl ?? null);
  const [userWallet, setUserWallet] = useState<number | null>(() => initialCache?.wallet ?? null);
  const [calculatingMatchJobId, setCalculatingMatchJobId] = useState<string | null>(null);

  // Loading is ONLY true if we have no cached data at all (first-time load ever)
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const cache = getStoredJobsCache();
    return !cache || (cache.companies.length === 0 && cache.allCompanies.length === 0);
  });

  const [activeCompanyModal, setActiveCompanyModal] = useState<CompanyGroup | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => initialCache?.currentUserId ?? null);
  const [currentUserCompany, setCurrentUserCompany] = useState<string | null>(() => initialCache?.currentUserCompany ?? null);
  const [userInviteCode, setUserInviteCode] = useState<string | null>(() => initialCache?.userInviteCode ?? null);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [linkedInLaunchData, setLinkedInLaunchData] = useState<{ url: string; company: string; inviteUrl: string; title?: string } | null>(null);
  const [startingReferralJobId, setStartingReferralJobId] = useState<string | null>(null);
  const [isMatchingCompleted, setIsMatchingCompleted] = useState<boolean>(() => initialCache?.isMatchingCompleted ?? true);
  const [errorMsg, setErrorMsg] = useState("");
  const [matchAddedToast, setMatchAddedToast] = useState<{ show: boolean; message: string; score: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(true);
  // New: Advanced Filters
  const [hasReferrersOnly, setHasReferrersOnly] = useState(false);
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [freshnessFilter, setFreshnessFilter] = useState<number>(30); // days
  // New: Pitch Modal
  const [pitchModalJob, setPitchModalJob] = useState<{ job: SuggestedJob; group: CompanyGroup } | null>(null);
  // New: Target Company Manager Modal
  const [showTargetCompanyModal, setShowTargetCompanyModal] = useState(false);
  // Deep Career Conversion Miner State
  const [showDeepConversionModal, setShowDeepConversionModal] = useState(false);
  const [deepConversionBlueprints, setDeepConversionBlueprints] = useState<ConversionBlueprint[]>(() => initialCache?.deepConversionBlueprints || []);
  const [activeBlueprintTab, setActiveBlueprintTab] = useState<Record<number, "x" | "y" | "z">>({});
  const [copiedBlueprintIndex, setCopiedBlueprintIndex] = useState<number | null>(null);
  const [showDeepFetchModal, setShowDeepFetchModal] = useState(false);
  const [deepHunterMatches, setDeepHunterMatches] = useState<any[]>([]);

  // Pioneer Strategy & Credit Economics State (Job Seeker Toolkit)
  const [coldOutreachModalJob, setColdOutreachModalJob] = useState<{
    job: {
      id: string;
      title: string;
      url?: string;
      description?: string;
      keywords?: string[];
      score?: number;
      label?: string;
      reason?: string;
      location?: string;
      posted_at?: string;
      matchRate?: number;
    };
    company: string;
  } | null>(null);
  const [companyResearchData, setCompanyResearchData] = useState<{ company: string; jobTitle?: string } | null>(null);
  const [bridgeRequestData, setBridgeRequestData] = useState<{ company: string; jobTitle?: string } | null>(null);
  const [watchedPioneerCompanies, setWatchedPioneerCompanies] = useState<string[]>([]);
  // Save job feedback & state tracking
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [savedJobKeys, setSavedJobKeys] = useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  // Option 5: Proximity Colleagues & Helpers State
  const [nearbyHelpers, setNearbyHelpers] = useState<NearbyHelper[]>(() => initialCache?.nearbyHelpers || []);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const router = useRouter();

  const handleOpenProximityProfile = useCallback((person: any) => {
    setSelectedPerson(person);
    if (!person?.id) return;
    fetch(`/api/proximity/people?targetId=${encodeURIComponent(person.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const fullPerson = data?.person || (data?.people && data.people.find((x: any) => x.id === person.id)) || data?.people?.[0];
        if (fullPerson) {
          setSelectedPerson((prev: any) => (prev?.id === person.id ? { ...prev, ...fullPerson } : prev));
        }
      })
      .catch(() => {});
  }, []);

  const handleBlueprintsFetched = (blueprints: ConversionBlueprint[], newWallet: number) => {
    setDeepConversionBlueprints(blueprints);
    setUserWallet(newWallet);
    window.dispatchEvent(new CustomEvent("wallet-updated", { detail: newWallet }));
    try {
      playNotificationSound("job_match");
    } catch {}
    setMatchAddedToast({
      show: true,
      message: `🎯 Generated ${blueprints.length} strategic conversion blueprints with resume anchors, ATS optimization & warm connector bridges!`,
      score: blueprints[0]?.matchScore || 92,
    });

    // Auto-merge newly unearthed conversion blueprints into the overall list of opportunities (companies state)
    if (blueprints.length > 0) {
      setCompanies((prev) => {
        const updated = [...prev];
        for (const bp of blueprints) {
          if (currentUserCompany && isSameCompany(bp.company, currentUserCompany)) continue;
          const compIdx = updated.findIndex(
            (c) => c.company.toLowerCase().trim() === bp.company.toLowerCase().trim()
          );

          const jobObj: SuggestedJob = {
            id: bp.jobId,
            title: cleanJobTitle(bp.title),
            location: bp.location || "Remote",
            url: bp.url || "",
            description: bp.whyThisOpportunity || "",
            posted_at: new Date().toISOString(),
            keywords: bp.focusY?.keywordsToAdd || [],
            matchRate: bp.matchScore,
            score: bp.matchScore,
            label: bp.fitVerdict,
            reason: bp.whyThisOpportunity,
          };

          // Strictly validate that the connector is actually at bp.company and not a mismatched profile
          const isPramodMismatched = bp.connector?.proxnetUserId === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" && bp.company.toLowerCase().trim() !== "t";
          const connectorRoleCompany = bp.connector?.role?.split("@")[1]?.trim();
          const connectorPathCompany = bp.connector?.connectionPath?.split("@")[1]?.replace(")", "").trim();
          const connCompany = connectorRoleCompany || connectorPathCompany;
          const isCompanyValid = connCompany ? isSameCompany(connCompany, bp.company) : true;

          const referralContacts = (bp.connector?.proxnetUserId && !isPramodMismatched && isCompanyValid)
            ? [
                {
                  id: bp.connector.proxnetUserId,
                  alias: bp.connector.name
                    ? `${bp.connector.name} (${bp.connector.role || "Insider"} @ ${bp.company})`
                    : `Insider @ ${bp.company}`,
                },
              ]
            : [];

          if (compIdx !== -1) {
            const existingComp = updated[compIdx];
            const existingJobs = existingComp.jobs.filter(
              (j) => j.id !== bp.jobId && j.title.toLowerCase().trim() !== bp.title.toLowerCase().trim()
            );
            existingJobs.unshift(jobObj);
            existingJobs.sort((a, b) => (b.score ?? b.matchRate ?? 0) - (a.score ?? a.matchRate ?? 0));
            const cleanExistingReferrals = (existingComp.referralContacts || []).filter((c) => {
              const isPramod = c.id === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" && existingComp.company.toLowerCase().trim() !== "t";
              return !isPramod;
            });
            updated[compIdx] = {
              ...existingComp,
              contactsCount: Math.max(cleanExistingReferrals.length, referralContacts.length),
              referralContacts: cleanExistingReferrals.length ? cleanExistingReferrals : referralContacts,
              jobs: existingJobs,
            };
          } else {
            updated.unshift({
              company: bp.company,
              contactsCount: referralContacts.length,
              referralContacts,
              jobs: [jobObj],
            });
          }
        }
        return updated.sort((a, b) => (b.jobs[0]?.score ?? 0) - (a.jobs[0]?.score ?? 0));
      });
    }
  };

  const handleMatchesFetched = (matches: any[], newWallet: number) => {
    // Exclude candidate's own current employer from output
    const externalMatches = (matches || []).filter((m) => {
      if (!currentUserCompany) return true;
      const cleanUser = currentUserCompany.toLowerCase().trim();
      const cleanComp = (m.company || "").toLowerCase().trim();
      return cleanComp !== cleanUser && !cleanComp.includes(cleanUser) && !cleanUser.includes(cleanComp);
    });

    setDeepHunterMatches(externalMatches);
    setUserWallet(newWallet);
    window.dispatchEvent(new CustomEvent("wallet-updated", { detail: newWallet }));
    try {
      playNotificationSound("job_match");
    } catch {}
    setMatchAddedToast({
      show: true,
      message: `🎯 Fetched ${externalMatches.length} high-conviction roles (>70% fit) directly from live ATS boards!`,
      score: externalMatches[0]?.score || 85,
    });

    // Also auto-merge these matches into existing companies state if matched (excluding candidate's own company)
    if (externalMatches.length > 0) {
      setCompanies((prev) => {
        const updated = [...prev];
        for (const m of externalMatches) {
          if (currentUserCompany && isSameCompany(m.company, currentUserCompany)) continue;
          const compIdx = updated.findIndex(
            (c) => c.company.toLowerCase().trim() === m.company.toLowerCase().trim()
          );
          const jobObj: SuggestedJob = {
            id: m.id,
            title: cleanJobTitle(m.title),
            location: m.location || "Remote",
            url: m.url || "",
            description: m.description || "",
            posted_at: m.posted_at || "",
            keywords: m.keywords || [],
            matchRate: m.score,
            score: m.score,
            label: m.label,
            reason: m.reason,
          };

          if (compIdx !== -1) {
            const existingComp = updated[compIdx];
            const existingJobs = existingComp.jobs.filter((j) => j.id !== m.id);
            existingJobs.unshift(jobObj);
            existingJobs.sort((a, b) => (b.score ?? b.matchRate ?? 0) - (a.score ?? a.matchRate ?? 0));
            const cleanExistingReferrals = (existingComp.referralContacts || []).filter((c) => {
              const isPramod = c.id === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" && existingComp.company.toLowerCase().trim() !== "t";
              return !isPramod;
            });
            updated[compIdx] = {
              ...existingComp,
              contactsCount: cleanExistingReferrals.length,
              referralContacts: cleanExistingReferrals,
              jobs: existingJobs,
            };
          } else {
            const cleanReferrals = (m.referralContacts || []).filter((c: any) => {
              const isPramod = c.id === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" && m.company.toLowerCase().trim() !== "t";
              return !isPramod;
            });
            updated.unshift({
              company: m.company,
              contactsCount: cleanReferrals.length,
              referralContacts: cleanReferrals,
              jobs: [jobObj],
            });
          }
        }
        return updated.sort((a, b) => (b.jobs[0]?.score ?? 0) - (a.jobs[0]?.score ?? 0));
      });
    }
  };

  const fetchSavedApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/applications");
      if (res.ok) {
        const data = await res.json();
        const keys = new Set<string>();
        for (const app of data.applications || []) {
          if (app.job_id) keys.add(`id:${app.job_id}`);
          if (app.company && app.job_title) {
            keys.add(`text:${app.company.toLowerCase().trim()}:::${app.job_title.toLowerCase().trim()}`);
          }
        }
        setSavedJobKeys(keys);
      }
    } catch (e) {
      console.error("Failed to load saved jobs:", e);
    }
  }, []);

  useEffect(() => {
    fetchSavedApplications();
    const onUpdated = () => fetchSavedApplications();
    window.addEventListener("job_application_updated", onUpdated);
    return () => window.removeEventListener("job_application_updated", onUpdated);
  }, [fetchSavedApplications]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeCompanyModal) {
        setActiveCompanyModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCompanyModal]);

  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      const t = Date.now();
      const [suggestedRes, allRes, peopleRes] = await Promise.allSettled([
        fetch(`/api/jobs/suggested?_t=${t}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
        fetch(`/api/jobs/all?_t=${t}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
        fetch(`/api/proximity/people?unfiltered=true`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      ]);

      let newNearbyHelpers: NearbyHelper[] = [];
      if (peopleRes.status === "fulfilled" && peopleRes.value) {
        const pData = peopleRes.value;
        newNearbyHelpers = Array.isArray(pData.people)
          ? pData.people
          : Array.isArray(pData)
          ? pData
          : [];
        setNearbyHelpers(newNearbyHelpers);
      }

      let newValidCompanies: CompanyGroup[] = [];
      let newProfileDigest: ProfileDigest | null = null;
      let newWallet: number = 0;
      let newUserId: string | null = null;
      let newUserCompany: string | null = null;
      let newInviteCode: string | null = null;
      let newHasResume: boolean = true;
      let newResumeUrl: string | null = null;
      let newIsMatchingCompleted: boolean = true;
      let newBlueprints: ConversionBlueprint[] = [];

      if (suggestedRes.status === "fulfilled" && suggestedRes.value) {
        const data = suggestedRes.value;
        const userComp = data.currentUserCompany || currentUserCompany;
        newValidCompanies = (data.companies || []).filter(
          (c: CompanyGroup) => !userComp || !isSameCompany(c.company, userComp)
        );
        setCompanies(newValidCompanies);
        newIsMatchingCompleted = data.isMatchingCompleted ?? true;
        setIsMatchingCompleted(newIsMatchingCompleted);
        if (data.currentUserId) {
          newUserId = data.currentUserId;
          setCurrentUserId(newUserId);
        }
        if (data.currentUserCompany) {
          newUserCompany = data.currentUserCompany;
          setCurrentUserCompany(newUserCompany);
        }
        if (data.inviteCode) {
          newInviteCode = data.inviteCode;
          setUserInviteCode(newInviteCode);
        }
        if (data.hasResume !== undefined) {
          newHasResume = data.hasResume;
          setHasResume(newHasResume);
        }
        if (data.resumeUrl !== undefined) {
          newResumeUrl = data.resumeUrl;
          setResumeUrl(newResumeUrl);
        }
        if (data.wallet !== undefined) {
          newWallet = data.wallet;
          setUserWallet(newWallet);
        }
        if (data.profileDigest) {
          newProfileDigest = data.profileDigest;
          setProfileDigest(newProfileDigest);
          if (Array.isArray(data.profileDigest.deep_career_blueprints) && data.profileDigest.deep_career_blueprints.length > 0) {
            newBlueprints = data.profileDigest.deep_career_blueprints.map((bp: ConversionBlueprint) => {
              if (bp.connector && bp.connector.type === "proxnet") {
                const isPramodMismatched = bp.connector.proxnetUserId === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" && bp.company.toLowerCase().trim() !== "t";
                const roleComp = bp.connector.role?.split("@")[1]?.trim();
                const pathComp = bp.connector.connectionPath?.split("@")[1]?.replace(")", "").trim();
                const connComp = roleComp || pathComp;
                const isSame = connComp && isSameCompany(connComp, bp.company) && (connComp.toLowerCase().trim() !== "t" || bp.company.toLowerCase().trim() === "t");

                if (isPramodMismatched || !isSame) {
                  return {
                    ...bp,
                    connector: {
                      type: "linkedin",
                      linkedinSearchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(bp.company + " (Director OR Head OR VP)")}`,
                      linkedinAlumniUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(bp.company)}`,
                      outreachMessage: `Hi [Name], I noticed ${bp.company}'s ${bp.title}. With my background, I'd love to connect and learn about the team's roadmap.`,
                      connectionPath: `LinkedIn Direct: Hiring Leader at ${bp.company}`,
                    },
                  };
                }
              }
              return bp;
            });
            setDeepConversionBlueprints(newBlueprints);
          }
        }
      }

      let newAllCompanies: CompanyGroup[] = [];
      if (allRes.status === "fulfilled" && allRes.value) {
        const allData = allRes.value;
        newAllCompanies = allData.companies || [];
        setAllCompanies(newAllCompanies);
      }

      saveJobsCache({
        companies: newValidCompanies,
        allCompanies: newAllCompanies,
        profileDigest: newProfileDigest,
        hasResume: newHasResume,
        resumeUrl: newResumeUrl,
        wallet: newWallet,
        currentUserId: newUserId,
        currentUserCompany: newUserCompany,
        userInviteCode: newInviteCode,
        nearbyHelpers: newNearbyHelpers,
        isMatchingCompleted: newIsMatchingCompleted,
        deepConversionBlueprints: newBlueprints,
      });
    } catch (e) {
      console.error("Failed to load jobs feed", e);
      setErrorMsg("An error occurred while fetching jobs.");
    } finally {
      setLoading(false);
    }
  }, [currentUserCompany]);

  useEffect(() => {
    // Only refresh when the page gets refreshed (first mount of this page load session)
    // or if we have no cached data at all.
    if (!hasRefreshedInCurrentPageLoad) {
      hasRefreshedInCurrentPageLoad = true;
      loadData();
    }
  }, [loadData]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    async function poll() {
      try {
        const res = await fetch("/api/jobs/suggested");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
          const completed = data.isMatchingCompleted ?? true;
          setIsMatchingCompleted(completed);
          if (data.currentUserCompany) {
            setCurrentUserCompany(data.currentUserCompany);
          }
          if (data.hasResume !== undefined) {
            setHasResume(data.hasResume);
          }
          if (data.resumeUrl !== undefined) {
            setResumeUrl(data.resumeUrl);
          }
          if (data.wallet !== undefined) {
            setUserWallet(data.wallet);
          }
          if (data.profileDigest) {
            setProfileDigest(data.profileDigest);
          }
          if (!completed) {
            timer = setTimeout(poll, 5000);
          }
        }
      } catch (e) {
        console.warn("Poll failed", e);
      }
    }

    if (!isMatchingCompleted) {
      timer = setTimeout(poll, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isMatchingCompleted]);

  const handleAskReferral = async (job: SuggestedJob, group: CompanyGroup) => {
    if (startingReferralJobId === job.id) return;
    setStartingReferralJobId(job.id);
    setErrorMsg("");

    try {
      // Prioritize followed referrers if available, otherwise pick the first referrer
      const availableReferrers = (group.referralContacts || []).filter(
        (c) => !currentUserId || c.id !== currentUserId
      );
      const targetContact = availableReferrers.find((c) => c.is_followed) || availableReferrers[0];

      if (!targetContact) {
        // Fallback to direct application if no referrer is available
        const cleanUrl = (job.url || "").replace(/&amp;/g, "&").trim();
        if (cleanUrl) {
          const a = document.createElement("a");
          a.href = cleanUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        return;
      }

      const cleanUrl = (job.url || "").replace(/&amp;/g, "&").trim();

      const res = await fetch("/api/jobs/chat/init-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: targetContact.id,
          jobId: job.id,
          company: group.company,
          jobTitle: job.title,
          jobUrl: cleanUrl,
          location: job.location,
          score: job.score ?? job.matchRate,
          reason: job.reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to initiate referral chat");
      }

      const data = await res.json();
      if (data.threadId) {
        setActiveCompanyModal(null);
        try {
          sessionStorage.removeItem("proxnet_inbox_cache");
        } catch (e) {}
        mutate("/api/jobs/inbox");
        // Direct transition into the chat session without intermediate screens
        router.push(`/jobs/chat/${data.threadId}`);
      }
    } catch (err: any) {
      console.error("Referral request error:", err);
      setErrorMsg(err.message || "Failed to ask for referral. Please try again.");
    } finally {
      setStartingReferralJobId(null);
    }
  };

  const handleInviteColleague = async (companyName: string) => {
    const code = userInviteCode || "";
    const inviteUrl = code ? `${window.location.origin}/join/${code}?company=${encodeURIComponent(companyName)}` : `${window.location.origin}/grow`;
    const shareText = `Hey! We're building our verified tech network for ${companyName} on ProxNet. Join with my invite link: ${inviteUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${companyName} on ProxNet`,
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteToast(`📋 Copied invite link for ${companyName}! You'll earn +10 credits when they join.`);
      setTimeout(() => setInviteToast(null), 4000);
    } catch (err) {
      setInviteToast(`Invite link: ${inviteUrl}`);
      setTimeout(() => setInviteToast(null), 6000);
    }
  };

  const handlePioneerClick = (companyName: string, roleQuery?: string, title?: string) => {
    const cleanCompany = (companyName || "").trim();
    if (!cleanCompany) return;

    let query = cleanCompany;
    if (roleQuery) {
      query = `${cleanCompany} ${roleQuery}`;
    }
    const linkedInUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
    const code = userInviteCode || "";
    const inviteUrl = code ? `${window.location.origin}/join/${code}?company=${encodeURIComponent(companyName)}` : `${window.location.origin}/grow`;

    // Copy invite link to clipboard proactively
    try {
      navigator.clipboard.writeText(inviteUrl);
    } catch { /* clipboard access may fail silently */ }

    // Show in-app interstitial instead of auto-opening (fixes PWA navigation loss)
    setLinkedInLaunchData({
      url: linkedInUrl,
      company: cleanCompany,
      inviteUrl,
      title: title || `Search ${cleanCompany} on LinkedIn`,
    });
  };

  const handleToggleWatch = async (companyName: string) => {
    try {
      const res = await fetch("/api/jobs/pioneer-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: companyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchedPioneerCompanies(data.watchedCompanies || []);
        setInviteToast(
          data.isWatching
            ? `🔔 Watching ${companyName}! You'll be alerted when an insider joins.`
            : `Unwatched ${companyName}`
        );
        setTimeout(() => setInviteToast(null), 3500);
      }
    } catch (e) {
      console.error("Toggle watch error:", e);
    }
  };

  const handleFindMatchRate = async (jobId: string) => {
    setCalculatingMatchJobId(jobId);
    try {
      const res = await fetch("/api/jobs/match-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "INSUFFICIENT_CREDITS") {
          alert(data.message || "Your credit balance is exhausted. Please recharge your wallet to calculate match rates.");
          return;
        }
        if (data.error === "NO_RESUME") {
          alert("Please upload your resume to calculate a real-time match rate.");
          return;
        }
        throw new Error(data.message || data.error || "Failed to calculate match rate");
      }

      if (data.remainingWallet !== undefined) {
        setUserWallet(data.remainingWallet);
        window.dispatchEvent(new CustomEvent("wallet-updated", { detail: data.remainingWallet }));
      }

      const updateJob = (j: SuggestedJob) => {
        if (j.id === jobId) {
          return {
            ...j,
            score: data.score,
            matchRate: data.score,
            label: data.label,
            reason: data.reason,
          };
        }
        return j;
      };

      // Always update job state in allCompanies
      setAllCompanies(prev => prev.map(c => ({
        ...c,
        jobs: c.jobs.map(updateJob)
      })));

      // Always update job state in active modal
      setActiveCompanyModal(prev => {
        if (!prev) return null;
        return {
          ...prev,
          jobs: prev.jobs.map(updateJob)
        };
      });

      // Find the evaluated job and its company metadata
      let evaluatedJobItem: SuggestedJob | null = null;
      let evaluatedCompanyName = "";
      let evaluatedContactsCount = 0;
      let evaluatedReferralContacts: Array<{ id: string; alias: string; is_followed?: boolean }> = [];

      for (const comp of allCompanies) {
        const found = comp.jobs.find(j => j.id === jobId);
        if (found) {
          evaluatedJobItem = {
            ...found,
            score: data.score,
            matchRate: data.score,
            label: data.label,
            reason: data.reason,
          };
          evaluatedCompanyName = comp.company;
          evaluatedContactsCount = comp.contactsCount;
          evaluatedReferralContacts = comp.referralContacts;
          break;
        }
      }

      if (!evaluatedJobItem && activeCompanyModal) {
        const found = activeCompanyModal.jobs.find(j => j.id === jobId);
        if (found) {
          evaluatedJobItem = {
            ...found,
            score: data.score,
            matchRate: data.score,
            label: data.label,
            reason: data.reason,
          };
          evaluatedCompanyName = activeCompanyModal.company;
          evaluatedContactsCount = activeCompanyModal.contactsCount;
          evaluatedReferralContacts = activeCompanyModal.referralContacts;
        }
      }

      // If match rate is at least 70% (or Good/Strong match), ensure it is auto-present in "Matched" tab
      if (data.score >= 70 && evaluatedJobItem) {
        try {
          playNotificationSound("job_match");
        } catch {}

        setCompanies(prev => {
          const compIdx = prev.findIndex(c => c.company.toLowerCase().trim() === evaluatedCompanyName.toLowerCase().trim());
          if (compIdx !== -1) {
            const existingComp = prev[compIdx];
            const updatedJobs = existingComp.jobs.filter(j => j.id !== jobId);
            updatedJobs.unshift(evaluatedJobItem!);
            updatedJobs.sort((a, b) => (b.score ?? b.matchRate ?? 0) - (a.score ?? a.matchRate ?? 0));

            const newComps = [...prev];
            newComps[compIdx] = {
              ...existingComp,
              jobs: updatedJobs,
            };
            return newComps.sort((a, b) => (b.jobs[0]?.score ?? 0) - (a.jobs[0]?.score ?? 0));
          } else {
            const newGroup: CompanyGroup = {
              company: evaluatedCompanyName,
              contactsCount: evaluatedContactsCount,
              referralContacts: evaluatedReferralContacts,
              jobs: [evaluatedJobItem!],
            };
            return [newGroup, ...prev].sort((a, b) => (b.jobs[0]?.score ?? 0) - (a.jobs[0]?.score ?? 0));
          }
        });

        setMatchAddedToast({
          show: true,
          message: `🔥 High Match (${data.score}%): ${cleanJobTitle(evaluatedJobItem.title)} at ${evaluatedCompanyName} is now in your "Matched" tab!`,
          score: data.score,
        });
      } else {
        setCompanies(prev => prev.map(c => ({
          ...c,
          jobs: c.jobs.map(updateJob)
        })));
      }
    } catch (err: unknown) {
      console.error("Failed to find match rate:", err);
      const message = err instanceof Error ? err.message : "Failed to calculate match rate";
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setCalculatingMatchJobId(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSummary(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Helper: days since posted
  const daysSince = (dateStr: string | undefined) => {
    if (!dateStr) return 999;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Helper: freshness badge
  const getFreshnessBadge = (dateStr: string | undefined) => {
    const days = daysSince(dateStr);
    if (days <= 7) return { text: `🟢 ${days}d ago`, cls: "text-emerald-600 dark:text-emerald-400" };
    if (days <= 21) return { text: `🟡 ${days}d ago`, cls: "text-amber-600 dark:text-amber-400" };
    return { text: `🟠 ${days}d ago`, cls: "text-orange-600 dark:text-orange-400" };
  };

  // Helper: save job to pipeline
  const handleSaveJob = async (job: SuggestedJob, company: string) => {
    const idKey = job.id ? `id:${job.id}` : null;
    const textKey = `text:${company.toLowerCase().trim()}:::${job.title.toLowerCase().trim()}`;
    const alreadySaved = (idKey && savedJobKeys.has(idKey)) || savedJobKeys.has(textKey);

    if (alreadySaved) {
      setSaveToast(`Already saved "${cleanJobTitle(job.title)}" to your pipeline`);
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    setSavingJobId(job.id);
    try {
      const res = await fetch("/api/jobs/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          company,
          jobTitle: job.title,
          jobUrl: job.url,
          stage: "saved",
          matchScore: job.score || job.matchRate || null,
        }),
      });

      if (res.ok || res.status === 409) {
        setSavedJobKeys((prev) => {
          const next = new Set(prev);
          if (idKey) next.add(idKey);
          next.add(textKey);
          return next;
        });
        setSaveToast(`🔖 Saved "${cleanJobTitle(job.title)}" to your pipeline`);
        setTimeout(() => setSaveToast(null), 3000);
        window.dispatchEvent(new CustomEvent("job_application_updated"));
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveToast(`❌ Could not save: ${data.error || "Please log in or try again"}`);
        setTimeout(() => setSaveToast(null), 4000);
      }
    } catch (e: any) {
      console.error("Failed to save job:", e);
      setSaveToast(`❌ Failed to save: ${e.message || "Network error"}`);
      setTimeout(() => setSaveToast(null), 3000);
    } finally {
      setSavingJobId(null);
    }
  };

  // Advanced filter logic
  const applyAdvancedFilters = (companiesList: CompanyGroup[], isMatchedFeed: boolean = false) => {
    const q = searchQuery.toLowerCase().trim();
    return companiesList
      .filter((c) => {
        // Guarantee candidate's own company is NEVER displayed as a matched opportunity
        if (isMatchedFeed && currentUserCompany && isSameCompany(c.company, currentUserCompany)) {
          return false;
        }
        return true;
      })
      .map(c => {
        let jobs = c.jobs;

        // Text search
        if (q) {
          const companyMatch = c.company.toLowerCase().includes(q);
          if (!companyMatch) {
            jobs = jobs.filter(j =>
              j.title.toLowerCase().includes(q) ||
              (j.keywords && j.keywords.some(k => k.toLowerCase().includes(q)))
            );
          }
        }

        // Freshness filter
        if (freshnessFilter < 30) {
          jobs = jobs.filter(j => daysSince(j.posted_at) <= freshnessFilter);
        }

        // Min score filter
        if (minScoreFilter > 0) {
          jobs = jobs.filter(j => (j.score ?? j.matchRate ?? 0) >= minScoreFilter);
        }

        return { ...c, jobs };
      })
      // Has referrers filter
      .filter(c => {
        if (hasReferrersOnly && c.contactsCount === 0) return false;
        return c.jobs.length > 0;
      });
  };

  const filteredMatchedCompanies = applyAdvancedFilters(companies, true);
  const filteredAllCompanies = applyAdvancedFilters(allCompanies, false);

  const displayedCompanies = jobsViewMode === "matched" ? filteredMatchedCompanies : filteredAllCompanies;

  // Stats for market pulse (excluding own company in matched counts)
  const totalMatchedJobs = companies
    .filter(c => !currentUserCompany || !isSameCompany(c.company, currentUserCompany))
    .reduce((acc, c) => acc + c.jobs.length, 0);
  const totalAllJobs = allCompanies.reduce((acc, c) => acc + c.jobs.length, 0);
  const strongMatchCount = companies
    .filter(c => !currentUserCompany || !isSameCompany(c.company, currentUserCompany))
    .reduce((acc, c) => acc + c.jobs.filter(j => (j.score ?? j.matchRate ?? 0) >= 85).length, 0);
  const companiesWithReferrers = companies
    .filter(c => (!currentUserCompany || !isSameCompany(c.company, currentUserCompany)) && c.contactsCount > 0).length;
  const totalReferrers = companies
    .filter(c => !currentUserCompany || !isSameCompany(c.company, currentUserCompany))
    .reduce((acc, c) => acc + c.contactsCount, 0);

  // Option 5: Flattened and sorted matched opportunities for Hero & Similar sections (strictly non-own company)
  const allFlattenedMatchedJobs = useMemo(() => {
    return companies
      .filter((g) => !currentUserCompany || !isSameCompany(g.company, currentUserCompany))
      .flatMap((g) =>
        g.jobs.map((j) => ({ job: j, group: g }))
      ).sort((a, b) => {
        const scoreA = a.job.score ?? a.job.matchRate ?? 0;
        const scoreB = b.job.score ?? b.job.matchRate ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        const dateA = a.job.posted_at ? new Date(a.job.posted_at).getTime() : 0;
        const dateB = b.job.posted_at ? new Date(b.job.posted_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [companies, currentUserCompany]);

  // Top hero match (highest match opportunity from non-own company)
  const heroJobItem = useMemo(() => {
    if (allFlattenedMatchedJobs.length > 0) return allFlattenedMatchedJobs[0];
    const nonOwnAll = allCompanies.filter(
      (c) => !currentUserCompany || !isSameCompany(c.company, currentUserCompany)
    );
    if (nonOwnAll.length > 0 && nonOwnAll[0].jobs.length > 0) {
      return { job: nonOwnAll[0].jobs[0], group: nonOwnAll[0] };
    }
    return null;
  }, [allFlattenedMatchedJobs, allCompanies, currentUserCompany]);

  // Next top opportunities (Option 5: "More Similar Jobs" - never showing own company)
  const similarJobs = useMemo(() => {
    if (allFlattenedMatchedJobs.length > 1) {
      return allFlattenedMatchedJobs.slice(1, 5);
    }
    const others = allCompanies
      .filter((g) => !currentUserCompany || !isSameCompany(g.company, currentUserCompany))
      .flatMap((g) => g.jobs.map((j) => ({ job: j, group: g })))
      .filter((item) => !heroJobItem || item.job.id !== heroJobItem.job.id);
    return others.slice(0, 4);
  }, [allFlattenedMatchedJobs, allCompanies, heroJobItem, currentUserCompany]);

  // Relevant nearby helpers (Option 5: "People around you who can help")
  const relevantHelpers = useMemo(() => {
    const result: NearbyHelper[] = [];
    const seenIds = new Set<string>();

    const matchedCompanyNames = new Set(
      companies.map((c) => c.company.toLowerCase().trim())
    );

    // 1. Filter valid nearby candidates
    const validNearby = [...nearbyHelpers].filter(
      (p) => (!currentUserId || p.id !== currentUserId) && p.job_title && p.company
    );

    // Prioritize candidates working at matched opportunity companies, then nearest distance
    validNearby.sort((a, b) => {
      const aMatch = matchedCompanyNames.has((a.company || "").toLowerCase().trim()) ? 1 : 0;
      const bMatch = matchedCompanyNames.has((b.company || "").toLowerCase().trim()) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return (a.distance ?? 99999) - (b.distance ?? 99999);
    });

    for (const p of validNearby) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        result.push(p);
        if (result.length >= 3) break;
      }
    }

    // 2. Supplement from company groups if fewer than 3
    if (result.length < 3) {
      for (const group of companies) {
        for (const ref of group.referralContacts || []) {
          if (!seenIds.has(ref.id) && (!currentUserId || ref.id !== currentUserId)) {
            seenIds.add(ref.id);
            const alias = ref.alias || "Insider";
            const title = alias.includes("@") ? alias.split("@")[0].trim() : "Colleague";
            result.push({
              id: ref.id,
              full_name: alias.includes("@") ? alias.split("@")[0].trim() : alias,
              anonymous_name: alias,
              job_title: title,
              company: group.company,
              distance: (result.length + 1) * 350,
              profile_photo_url: null,
              is_followed: ref.is_followed,
            });
            if (result.length >= 3) break;
          }
        }
        if (result.length >= 3) break;
      }
    }

    return result;
  }, [nearbyHelpers, companies, currentUserId]);

  const topSprintJobs = useMemo(() => {
    const list: Array<{ id: string; title: string; company: string; score?: number; url?: string }> = [];
    const sourceList = companies.length > 0 ? companies : allCompanies;
    for (const g of sourceList) {
      for (const j of g.jobs) {
        list.push({
          id: j.id,
          title: cleanJobTitle(j.title),
          company: g.company,
          score: j.score ?? j.matchRate,
          url: j.url,
        });
      }
    }
    return list.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
  }, [companies, allCompanies]);

  const handleSelectSprintJob = (job: { id: string; title: string; company: string; score?: number; url?: string }) => {
    const found =
      companies.find((c) => isSameCompany(c.company, job.company)) ||
      allCompanies.find((c) => isSameCompany(c.company, job.company));

    if (found) {
      setActiveCompanyModal(found);
    } else {
      setActiveCompanyModal({
        company: job.company,
        jobs: [
          {
            id: job.id,
            title: job.title,
            location: "Flexible / Remote",
            url: job.url || "",
            description: "",
            posted_at: new Date().toISOString(),
            keywords: [],
            score: job.score,
            matchRate: job.score || 80,
          },
        ],
        contactsCount: 0,
        referralContacts: [],
      });
    }
  };

  const similarCompaniesWithReferrers = useMemo(() => {
    return companies
      .filter((c) => c.contactsCount > 0)
      .map((c) => ({
        company: c.company,
        contactsCount: c.contactsCount,
        openingsCount: c.jobs.length,
      }))
      .slice(0, 6);
  }, [companies]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto pb-8">
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>Loading verified openings & AI match scores...</span>
          </span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 rounded-xl skeleton h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-children max-w-3xl mx-auto pb-8">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">
          {errorMsg}
        </div>
      )}

      {/* Save Toast */}
      {saveToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-lg animate-fadeInUp">
          {saveToast}
        </div>
      )}

      {/* 🧭 Career Companion Header: Don't show everything, show what you can do next */}
      <div className="flex flex-col gap-1 pb-1 border-b border-[var(--color-border-light)]/60">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text)] tracking-tight m-0">
          Opportunities & Referrals
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">
          Here are the opportunities relevant to you, and here are the people who can help you act on them.
        </p>
      </div>

      {/* Background Matching Status Pill */}
      {!isMatchingCompleted && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium animate-fadeIn">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            <span>Updating match evaluation in background...</span>
          </span>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Active</span>
        </div>
      )}

      {/* ── 1. CAREER EXPLORER & TOOLS (Top Section) ── */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)] uppercase tracking-wider m-0">
              Career Explorer & Tools
            </h3>
            <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
              Active resume, hiring pulse, ATS match hunter & career utilities
            </p>
          </div>
        </div>

        {/* Active Resume Management */}
        <ResumeCard
          hasResume={hasResume}
          resumeUrl={resumeUrl}
          onResumeUpdated={loadData}
        />

        {/* 🚀 Application Sprint Mode (Active Job Seeker Persona) */}
        <ApplicationSprintMode
          userWallet={userWallet}
          onWalletUpdated={(newWallet) => {
            setUserWallet(newWallet);
            window.dispatchEvent(new CustomEvent("wallet-updated", { detail: newWallet }));
          }}
          topSprintJobs={topSprintJobs}
          onSelectJob={handleSelectSprintJob}
          onFilterPioneerJobs={() => {
            setJobsViewMode("all");
            setHasReferrersOnly(false);
            const el = document.getElementById("pioneer-roles-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* 📊 Interactive Hiring Pulse */}
        {(totalMatchedJobs > 0 || totalAllJobs > 0) && (
          <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-border-light)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📊</span>
                <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Hiring Pulse</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium">Click to filter</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Card 1: Active Roles */}
              <button
                id="pulse-active-roles"
                type="button"
                onClick={() => {
                  setJobsViewMode("all");
                  setHasReferrersOnly(false);
                  setMinScoreFilter(0);
                  setSearchQuery("");
                }}
                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                  jobsViewMode === "all" && !hasReferrersOnly && minScoreFilter === 0
                    ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-primary/50 text-[var(--color-text)]"
                }`}
                title="Click to view all active scraped openings"
              >
                <span className="text-base sm:text-lg font-bold text-[var(--color-primary)]">{totalAllJobs}</span>
                <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">Active Roles</span>
                <span className="text-[9px] text-[var(--color-text-tertiary)]">
                  {jobsViewMode === "all" && !hasReferrersOnly && minScoreFilter === 0 ? "Viewing All ✓" : "View all →"}
                </span>
              </button>

              {/* Card 2: Strong Matches */}
              <button
                id="pulse-strong-matches"
                type="button"
                onClick={() => {
                  setJobsViewMode("matched");
                  setMinScoreFilter((prev) => (prev >= 70 ? 0 : 70));
                }}
                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                  jobsViewMode === "matched" && minScoreFilter >= 70
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-emerald-500/50 text-[var(--color-text)]"
                }`}
                title="Click to filter by high-confidence matches (70%+ fit)"
              >
                <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {strongMatchCount || totalMatchedJobs}
                </span>
                <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">Strong Matches</span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {minScoreFilter >= 70 ? "70%+ Active ✓" : "Filter 70%+ →"}
                </span>
              </button>

              {/* Card 3: Insider Referrers */}
              <button
                id="pulse-insider-referrers"
                type="button"
                onClick={() => {
                  setHasReferrersOnly((prev) => !prev);
                }}
                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                  hasReferrersOnly
                    ? "bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-blue-500/50 text-[var(--color-text)]"
                }`}
                title="Click to filter companies with active insider referrers"
              >
                <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">{totalReferrers}</span>
                <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">Insider Referrers</span>
                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium">
                  {hasReferrersOnly ? "Referrers Active ✓" : `${companiesWithReferrers} Cos • Filter →`}
                </span>
              </button>

              {/* Card 4: Companies */}
              <button
                id="pulse-companies"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setHasReferrersOnly(false);
                  setMinScoreFilter(0);
                  const el = document.getElementById("jobs-company-list");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="p-2.5 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-purple-500/50 text-[var(--color-text)] text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95"
                title="Click to browse all companies"
              >
                <span className="text-base sm:text-lg font-bold text-[var(--color-text)]">
                  {jobsViewMode === "matched" ? companies.length : allCompanies.length}
                </span>
                <span className="text-[10px] font-semibold text-[var(--color-text-secondary)]">Companies</span>
                <span className="text-[9px] text-[var(--color-text-tertiary)]">
                  Browse list ↓
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 🎯 Deep ATS Match Hunter Action Banner */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-[var(--color-surface)] to-emerald-500/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-lg shrink-0 shadow-2xs">
              🎯
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)] m-0">
                  Deep ATS Match Hunter
                </h3>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] border border-emerald-500/20">
                  &gt;70% Fit Guaranteed
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 m-0">
                Live crawl across Greenhouse, Lever & Ashby boards with AI resume reranking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-[11px] font-bold text-[var(--color-text)] flex items-center gap-1.5">
              <span>🪙</span>
              <span>{userWallet ?? 0} Credits</span>
            </div>

            <button
              id="btn-deep-ats-fetch"
              type="button"
              onClick={() => setShowDeepConversionModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-primary via-indigo-600 to-emerald-600 hover:opacity-95 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>🎯 Mine Opportunities (3 Credits / Job)</span>
            </button>
          </div>
        </div>

        {/* 🎯 Deep Career Conversion Dossier (Rendered when conversion blueprints available) */}
        {deepConversionBlueprints.length > 0 && (
          <div id="deep-conversion-results" className="p-4 sm:p-5 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-[var(--color-surface)] to-emerald-500/5 shadow-sm space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--color-border-light)] gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-base font-bold shadow-2xs">
                  🎯
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)] m-0 flex items-center gap-2">
                    <span>Deep Career Conversion Dossier</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {deepConversionBlueprints.length} Strategic Blueprints
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
                    High-yield peer roles equipped with resume anchors, ATS keywords, interview pitches & warm connectors
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setShowDeepConversionModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors cursor-pointer"
                >
                  ⚡ Re-Mine
                </button>
                <button
                  type="button"
                  onClick={() => setDeepConversionBlueprints([])}
                  className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] underline ml-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {deepConversionBlueprints.map((bp, bIdx) => {
                const activeTab = activeBlueprintTab[bIdx] || "x";
                const isProxNet = bp.connector?.type === "proxnet";

                return (
                  <div
                    key={bp.jobId || bIdx}
                    className="p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-xs hover:border-primary/40 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <CompanyLogo company={bp.company} size={38} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-[var(--color-text)]">
                              {cleanJobTitle(bp.title)}
                            </span>
                            {bp.reqId && (
                              <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)] px-1.5 py-0.5 rounded font-mono">
                                Req #{bp.reqId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            <span className="font-semibold text-[var(--color-text)]">{bp.company}</span>
                            <span>•</span>
                            <span>📍 {bp.location || "Remote"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                          {bp.matchScore}% Match
                        </span>
                        {bp.url && (
                          <a
                            href={bp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-primary hover:opacity-90 text-white font-bold text-xs transition-opacity flex items-center gap-1 shadow-2xs"
                          >
                            <span>Apply</span>
                            <span>↗</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Why this opportunity */}
                    {bp.whyThisOpportunity && (
                      <p className="text-[11px] text-[var(--color-text-secondary)] italic bg-[var(--color-surface-secondary)]/50 p-2.5 rounded-lg border border-[var(--color-border-light)]/60 m-0">
                        &quot;{bp.whyThisOpportunity}&quot;
                      </p>
                    )}

                    {/* Conversion Strategy Tab Bar */}
                    <div className="space-y-2 pt-1">
                      <div className="flex border-b border-[var(--color-border-light)] gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveBlueprintTab(prev => ({ ...prev, [bIdx]: "x" }))}
                          className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all cursor-pointer ${
                            activeTab === "x"
                              ? "border-primary text-primary"
                              : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                          }`}
                        >
                          🎯 Resume Hook
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveBlueprintTab(prev => ({ ...prev, [bIdx]: "y" }))}
                          className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all cursor-pointer ${
                            activeTab === "y"
                              ? "border-primary text-primary"
                              : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                          }`}
                        >
                          ⚙️ ATS Keyword Optimization
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveBlueprintTab(prev => ({ ...prev, [bIdx]: "z" }))}
                          className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all cursor-pointer ${
                            activeTab === "z"
                              ? "border-primary text-primary"
                              : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                          }`}
                        >
                          🎙️ Interview Pitch & Strategy
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)]/50 border border-[var(--color-border-light)] text-[11px]">
                        {activeTab === "x" && (
                          <div className="space-y-1">
                            <span className="font-bold text-[var(--color-text)] block">
                              {bp.focusX?.title || "Resume Project Anchor"}
                            </span>
                            <p className="text-[var(--color-text-secondary)] m-0 leading-relaxed">
                              {bp.focusX?.description}
                            </p>
                          </div>
                        )}

                        {activeTab === "y" && (
                          <div className="space-y-2">
                            <span className="font-bold text-[var(--color-text)] block">
                              {bp.focusY?.title || "ATS Keywords & Metrics"}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(bp.focusY?.keywordsToAdd || []).map((kw, kwIdx) => (
                                <span
                                  key={kwIdx}
                                  className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[10px] font-semibold border border-primary/20"
                                >
                                  +{kw}
                                </span>
                              ))}
                            </div>
                            <p className="text-[var(--color-text-secondary)] m-0 leading-relaxed">
                              {bp.focusY?.description}
                            </p>
                          </div>
                        )}

                        {activeTab === "z" && (
                          <div className="space-y-2">
                            <div>
                              <span className="font-bold text-[var(--color-text)] block">
                                {bp.focusZ?.title || "Winning Interview Narrative"}
                              </span>
                              <div className="mt-1 p-2 rounded bg-primary/5 border-l-2 border-primary text-[var(--color-text)] font-medium italic">
                                &quot;{bp.focusZ?.interviewPitch}&quot;
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] block">
                                Objection Handler:
                              </span>
                              <p className="text-[var(--color-text-secondary)] m-0 leading-relaxed">
                                {bp.focusZ?.objectionHandler}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Warm Connector Card (Mr. A) */}
                    {bp.connector && (
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm shrink-0">{isProxNet ? "🟢" : "🔵"}</span>
                            {isProxNet ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (bp.connector?.proxnetUserId) {
                                    handleOpenProximityProfile({
                                      id: bp.connector.proxnetUserId,
                                      full_name: bp.connector.name || "Insider",
                                      anonymous_name: bp.connector.name || "Insider",
                                      job_title: bp.connector.role || "Insider",
                                      company: bp.company,
                                    });
                                  }
                                }}
                                className="font-bold text-xs text-[var(--color-text)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-left truncate"
                                title="View Proximity Profile of Insider"
                              >
                                {bp.connector.connectionPath} ↗
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  handlePioneerClick(
                                    bp.company,
                                    "Director OR VP OR Head OR Hiring Manager",
                                    `Search Hiring Leaders at ${bp.company}`
                                  );
                                }}
                                className="font-bold text-xs text-[var(--color-text)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-left truncate"
                                title="Click to view safe search options for hiring leaders"
                              >
                                {bp.connector.connectionPath}
                              </button>
                            )}
                          </div>

                          {!isProxNet && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  handlePioneerClick(
                                    bp.company,
                                    "Director OR VP OR Head OR Hiring Manager",
                                    `Search Hiring Leaders at ${bp.company}`
                                  );
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0077b5]/15 hover:bg-[#0077b5] text-[#0077b5] hover:text-white dark:text-[#00a0dc] font-bold text-[10px] border border-[#0077b5]/30 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Safe in-app search options for Hiring Leaders"
                              >
                                <span>🔍</span>
                                <span>Leaders ↗</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handlePioneerClick(
                                    bp.company,
                                    "Alumni",
                                    `Search Alumni at ${bp.company}`
                                  );
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0077b5]/15 hover:bg-[#0077b5] text-[#0077b5] hover:text-white dark:text-[#00a0dc] font-bold text-[10px] border border-[#0077b5]/30 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Safe in-app search options for Alumni"
                              >
                                <span>🎓</span>
                                <span>Alumni Search ↗</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setColdOutreachModalJob({
                                    job: {
                                      id: bp.jobId || `bp_${bIdx}`,
                                      title: bp.title,
                                      description: bp.whyThisOpportunity || "",
                                      keywords: bp.focusY?.keywordsToAdd || [],
                                      score: bp.matchScore,
                                    },
                                    company: bp.company,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Draft customized AI message for Hiring Leaders in ProxNet (FREE)"
                              >
                                <span>✉️</span>
                                <span>Custom Pitch</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Outreach Pitch Copy Box */}
                        <div className="relative p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] text-[11px] font-mono text-[var(--color-text-secondary)] leading-relaxed">
                          <div className="pr-16">{bp.connector.outreachMessage}</div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bp.connector.outreachMessage);
                              setCopiedBlueprintIndex(bIdx);
                              setTimeout(() => setCopiedBlueprintIndex(null), 2500);
                            }}
                            className="absolute top-2 right-2 px-2.5 py-1 rounded bg-primary text-white font-bold text-[10px] shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                          >
                            {copiedBlueprintIndex === bIdx ? "Copied! ✓" : "Copy Note"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🎯 Deep Hunter Matches Section (Rendered when live matches fetched) */}
        {deepHunterMatches.length > 0 && (
          <div id="deep-hunter-results" className="p-4 rounded-xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/5 to-transparent space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)] m-0">
                  Deep Hunter Matches ({deepHunterMatches.length} Roles with &gt;70% Fit)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Sorted by Match Fit ↓
                </span>
                <button
                  type="button"
                  onClick={() => setDeepHunterMatches([])}
                  className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] underline ml-2 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {deepHunterMatches.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="p-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-xs hover:border-emerald-500/40 transition-all flex flex-col gap-2.5"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo company={m.company} size={36} />
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text)] m-0">
                          {cleanJobTitle(m.title)}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                          <span className="font-semibold text-[var(--color-text)]">{m.company}</span>
                          <span>•</span>
                          <span>{m.location || "Remote"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1">
                        <span>🎯</span>
                        <span>{m.score}% Match</span>
                      </span>
                      <span className="text-[9px] text-[var(--color-text-tertiary)]">
                        ⚡ Live from {m.source || "ATS"}
                      </span>
                    </div>
                  </div>

                  {/* AI Fit Reason */}
                  {m.reason && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-[var(--color-text)] leading-relaxed">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 mr-1.5">💡 Fit Reason:</span>
                      <span>{m.reason}</span>
                    </div>
                  )}

                  {/* Footer Actions: Pioneer vs Referrer + Apply */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--color-border-light)]/40">
                    {m.isPioneer ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePioneerClick(m.company)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                          title="Open LinkedIn with this company filter & invite a colleague to earn +10 credits!"
                        >
                          <span>🏆 Pioneer +10 pts</span>
                          <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">• Open LinkedIn ↗</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setColdOutreachModalJob({
                              job: {
                                id: m.id,
                                title: m.title,
                                url: m.url,
                                description: m.description,
                                keywords: m.keywords,
                                score: m.score,
                                reason: m.reason,
                              },
                              company: m.company,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary text-[11px] font-bold hover:bg-primary/25 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                          title="Draft AI cold outreach for recruiters or hiring managers (FREE • 0 Credits)"
                        >
                          <span>✉️</span>
                          <span>Draft Outreach</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handlePioneerClick(
                              m.company,
                              `recruiter ${cleanJobTitle(m.title)}`,
                              `Recruiters for ${cleanJobTitle(m.title)} at ${m.company}`
                            )
                          }
                          className="px-2 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[11px] font-semibold hover:border-primary/40 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Find recruiters on LinkedIn"
                        >
                          <span>🔍</span>
                          <span>Recruiter</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        <span>🤝</span>
                        <span>{(m.referralContacts && m.referralContacts.length > 0) ? m.referralContacts.length : "Verified"} Insider Referrer(s) Available</span>
                      </div>
                    )}

                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity ml-auto"
                      >
                        Apply on ATS →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. MY REFERRAL CONVERSATIONS (Collapsed by default) ── */}
      <JobInbox />

      {/* ── 1. HERO OPPORTUNITY CARD (Option 5: Make job discovery the hero) ── */}
      {heroJobItem && (
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-primary/25 bg-gradient-to-b from-primary/5 via-[var(--color-surface)] to-[var(--color-surface)] shadow-md space-y-4 hover:border-primary/45 transition-all animate-fadeIn">
          {/* Top row: Logo + Title + Match Pill */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CompanyLogo company={heroJobItem.group.company} size={46} />
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] leading-snug m-0">
                  {cleanJobTitle(heroJobItem.job.title)}
                </h2>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] font-medium mt-1">
                  <span className="font-semibold text-[var(--color-text)]">{heroJobItem.group.company}</span>
                  <span>•</span>
                  <span>{heroJobItem.job.location || "Bengaluru"}</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 shadow-2xs">
                <span>🎯</span>
                <span>{heroJobItem.job.score || heroJobItem.job.matchRate || 87}% match</span>
              </span>
            </div>
          </div>

          {/* Sub-details: Referral hook + Freshness */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {heroJobItem.group.contactsCount > 0 ? (
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                <span>👥</span>
                {(() => {
                  const firstRef = (heroJobItem.group.referralContacts || []).find((c) => !currentUserId || c.id !== currentUserId);
                  if (firstRef) {
                    const alias = firstRef.alias || "Insider";
                    const title = alias.includes("@") ? alias.split("@")[0].trim() : "Colleague";
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenProximityProfile({
                            id: firstRef.id,
                            full_name: alias.includes("@") ? alias.split("@")[0].trim() : alias,
                            anonymous_name: alias,
                            job_title: title,
                            company: heroJobItem.group.company,
                            is_followed: firstRef.is_followed,
                          });
                        }}
                        className="hover:underline cursor-pointer bg-transparent border-0 p-0 text-inherit font-semibold text-xs flex items-center gap-1"
                        title="Click to view referrer's Proximity Profile"
                      >
                        <span>{heroJobItem.group.contactsCount} ProxNet connection{heroJobItem.group.contactsCount > 1 ? "s" : ""} can refer you</span>
                        <span className="text-[10px] opacity-75">({alias}) ↗</span>
                      </button>
                    );
                  }
                  return (
                    <span>
                      {heroJobItem.group.contactsCount} ProxNet connection{heroJobItem.group.contactsCount > 1 ? "s" : ""} can refer you
                    </span>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <span>🏆</span>
                <span>Pioneer company • Invite a colleague for +10 credits</span>
              </div>
            )}

            <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
              <span>🕒</span>
              <span>
                {heroJobItem.job.posted_at
                  ? `Posted ${daysSince(heroJobItem.job.posted_at)}d ago`
                  : "Recently posted"}
              </span>
            </div>
          </div>

          {/* AI Fit Reason */}
          {heroJobItem.job.reason && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-[var(--color-text)] leading-relaxed">
              <span className="font-bold text-emerald-700 dark:text-emerald-300 mr-1.5">💡 Why it fits:</span>
              <span>{heroJobItem.job.reason}</span>
            </div>
          )}

          {/* Hero Action Buttons: [ View Job ] & [ Ask Referral ] */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveCompanyModal(heroJobItem.group)}
              className="py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs sm:text-sm text-center transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>View Job</span>
            </button>

            {heroJobItem.group.contactsCount > 0 ? (
              <button
                type="button"
                disabled={startingReferralJobId === heroJobItem.job.id}
                onClick={() => {
                  const isOwn =
                    currentUserCompany &&
                    heroJobItem.group.company &&
                    currentUserCompany.trim().toLowerCase() === heroJobItem.group.company.trim().toLowerCase();
                  if (isOwn) {
                    handleAskReferral(heroJobItem.job, heroJobItem.group);
                  } else {
                    setPitchModalJob({ job: heroJobItem.job, group: heroJobItem.group });
                  }
                }}
                className="py-2.5 px-4 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border-2 border-primary text-primary font-bold text-xs sm:text-sm text-center transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                {startingReferralJobId === heroJobItem.job.id ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <span>🤝</span>
                    <span>Ask Referral</span>
                  </>
                )}
              </button>
            ) : heroJobItem.job.url ? (
              <a
                href={heroJobItem.job.url.replace(/&amp;/g, "&").trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text)] font-bold text-xs sm:text-sm text-center transition-all shadow-xs no-underline flex items-center justify-center gap-1"
              >
                <span>Apply on Career Website</span>
                <span>↗</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handlePioneerClick(heroJobItem.group.company)}
                className="py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-xs sm:text-sm text-center transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                title={`Open LinkedIn with ${heroJobItem.group.company} & invite a colleague for +10 credits`}
              >
                <span>🏆 Pioneer +10 pts</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 2. PEOPLE AROUND YOU WHO CAN HELP (Option 5) ── */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🤝</span>
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
              People around you who can help
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              router.push("/qa?tab=network&view=list");
              window.dispatchEvent(new CustomEvent("tabchange", { detail: "/network" }));
            }}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 flex items-center gap-0.5"
          >
            <span>See all</span>
            <span>&gt;</span>
          </button>
        </div>

        {relevantHelpers.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-[var(--color-border-light)] text-center text-xs text-[var(--color-text-secondary)]">
            Explore your network map to discover colleagues in your neighbourhood.
          </div>
        ) : (
          <div className="space-y-2">
            {relevantHelpers.map((person) => (
              <div
                key={person.id}
                onClick={() => {
                  setSelectedPerson(person);
                  handleOpenProximityProfile(person);
                }}
                className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-primary/40 hover:bg-[var(--color-surface-hover)] transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {person.profile_photo_url ? (
                    <img
                      src={person.profile_photo_url}
                      alt={person.full_name || person.anonymous_name}
                      className="w-10 h-10 rounded-full object-cover border border-[var(--color-border-light)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/15 to-blue-500/15 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
                      {(person.full_name || person.anonymous_name || "P")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex flex-col">
                    <span className="text-xs sm:text-sm font-bold text-[var(--color-text)] truncate group-hover:text-primary transition-colors">
                      {person.full_name || person.anonymous_name}
                    </span>
                    <span className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                      {person.job_title} • <strong className="font-semibold text-[var(--color-text)]">{person.company}</strong>
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                      <span>📍</span>
                      <span>
                        {person.distance != null && person.distance !== Infinity
                          ? `${(person.distance / 1000).toFixed(1)} km • Mutual connections nearby`
                          : "Nearby in your network"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="hidden sm:inline-block text-[11px] font-semibold text-primary group-hover:underline">
                    Connect
                  </span>
                  <span className="text-[var(--color-text-tertiary)] group-hover:text-primary transition-transform group-hover:translate-x-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Option 5 Community Trust Badge */}
        <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base shrink-0">
            👥
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--color-text)]">
              Real people. Real referrals.
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
              Your neighbourhood network works for you.
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. MORE SIMILAR JOBS (Option 5: High match alternatives) ── */}
      {similarJobs.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">💼</span>
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
                More Similar Jobs
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("jobs-company-list");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 flex items-center gap-0.5"
            >
              <span>See all ({totalMatchedJobs || totalAllJobs})</span>
              <span>&gt;</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {similarJobs.map(({ job, group }) => {
              const score = job.score ?? job.matchRate ?? 75;
              const availableReferrers = (group.referralContacts || []).filter(
                (c) => !currentUserId || c.id !== currentUserId
              );
              const hasReferrer = availableReferrers.length > 0;

              return (
                <div
                  key={job.id}
                  className="p-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-primary/40 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CompanyLogo company={group.company} size={36} />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text)] leading-snug truncate m-0">
                          {cleanJobTitle(job.title)}
                        </h4>
                        <div className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                          {group.company} • {job.location || "Bengaluru"}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] shrink-0">
                      {score}% match
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--color-border-light)]/40">
                    <div className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                      {hasReferrer ? (
                        (() => {
                          const firstRef = availableReferrers[0];
                          if (firstRef) {
                            const alias = firstRef.alias || "Insider";
                            const title = alias.includes("@") ? alias.split("@")[0].trim() : "Colleague";
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenProximityProfile({
                                    id: firstRef.id,
                                    full_name: alias.includes("@") ? alias.split("@")[0].trim() : alias,
                                    anonymous_name: alias,
                                    job_title: title,
                                    company: group.company,
                                    is_followed: firstRef.is_followed,
                                  });
                                }}
                                className="text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer bg-transparent border-0 p-0 text-[10px] flex items-center gap-1"
                                title="Click to view referrer's Proximity Profile"
                              >
                                <span>👥 {availableReferrers.length} referrer{availableReferrers.length > 1 ? "s" : ""} nearby</span>
                                <span className="opacity-75">({alias}) ↗</span>
                              </button>
                            );
                          }
                          return (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              👥 {availableReferrers.length} referrer{availableReferrers.length > 1 ? "s" : ""} nearby
                            </span>
                          );
                        })()
                      ) : (
                        <span>🕒 {job.posted_at ? `${daysSince(job.posted_at)}d ago` : "Recent"}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveCompanyModal(group)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-[11px] font-semibold text-[var(--color-text)] transition-colors cursor-pointer"
                      >
                        View Job
                      </button>
                      {hasReferrer ? (
                        <button
                          type="button"
                          disabled={startingReferralJobId === job.id}
                          onClick={() => {
                            const isOwn =
                              currentUserCompany &&
                              group.company &&
                              currentUserCompany.trim().toLowerCase() === group.company.trim().toLowerCase();
                            if (isOwn) {
                              handleAskReferral(job, group);
                            } else {
                              setPitchModalJob({ job, group });
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Ask Referral
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePioneerClick(group.company)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
                          title="Open LinkedIn with this company filter & invite a colleague to earn +10 credits!"
                        >
                          Pioneer +10 pts
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. EXPLORE ALL COMPANIES & DIRECTORY ── */}
      <div className="pt-6 border-t border-[var(--color-border-light)] space-y-4">

        {/* 📋 Application Pipeline Tracker */}
        <ApplicationPipeline />

        {/* Bio Digest (Minimal Collapsible) */}
        {profileDigest && profileDigest.summary && (
          <details className="group rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)]/60 text-xs overflow-hidden">
            <summary className="px-3.5 py-2 font-semibold text-[var(--color-text-secondary)] cursor-pointer flex items-center justify-between select-none hover:text-[var(--color-text)]">
              <span className="flex items-center gap-1.5">
                <span>🎯</span>
                <span>Candidate Match Profile</span>
              </span>
              <span className="text-[10px] text-[var(--color-text-tertiary)] group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="p-3 pt-1 border-t border-[var(--color-border-light)]/40 flex flex-col gap-2">
              <p className="text-[var(--color-text)] leading-relaxed m-0 text-xs">{profileDigest.summary}</p>
              {profileDigest.skills && profileDigest.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {profileDigest.skills.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}

        {/* Segmented View Switcher: Matched vs All Jobs */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center p-1 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-light)] gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setJobsViewMode("matched")}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-0 cursor-pointer ${
                jobsViewMode === "matched"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-transparent"
              }`}
            >
              <span>Matched</span>
              {companies.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  jobsViewMode === "matched" ? "bg-primary/15 text-primary" : "bg-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                }`}>
                  {companies.length} ({totalMatchedJobs})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setJobsViewMode("all")}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-0 cursor-pointer ${
                jobsViewMode === "all"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-transparent"
              }`}
            >
              <span>All Jobs</span>
              {allCompanies.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  jobsViewMode === "all" ? "bg-primary/15 text-primary" : "bg-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                }`}>
                  {allCompanies.length} ({totalAllJobs})
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Track Company Button */}
            <button
              type="button"
              onClick={() => setShowTargetCompanyModal(true)}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] text-xs font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors cursor-pointer shadow-2xs"
              title="Track any company for fresh job alerts"
            >
              <span>+</span>
              <span className="hidden sm:inline">Track Company</span>
            </button>

            {userWallet !== null && (
              <div 
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border-light text-xs font-bold text-text-secondary shrink-0 shadow-2xs"
                title="Your current credit balance for match evaluations and network chats"
              >
                <span>🪙</span>
                <span>Credits: <strong className="text-primary">{userWallet}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* 🔍 Advanced Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Has Referrers Toggle */}
          <button
            type="button"
            onClick={() => setHasReferrersOnly(!hasReferrersOnly)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
              hasReferrersOnly
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-primary)]"
            }`}
          >
            <span>🤝</span> Has Referrers {hasReferrersOnly && "✓"}
          </button>

          {/* Match Score Filter */}
          <button
            type="button"
            onClick={() => setMinScoreFilter(minScoreFilter === 70 ? 85 : minScoreFilter === 85 ? 0 : 70)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
              minScoreFilter > 0
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-primary)]"
            }`}
          >
            <span>🔥</span> {minScoreFilter > 0 ? `${minScoreFilter}%+ Match` : "Match Score"}
          </button>

          {/* Freshness Filter */}
          <button
            type="button"
            onClick={() => setFreshnessFilter(freshnessFilter === 7 ? 14 : freshnessFilter === 14 ? 30 : 7)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
              freshnessFilter < 30
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-primary)]"
            }`}
          >
            <span>📅</span> {freshnessFilter < 30 ? `Last ${freshnessFilter}d` : "Freshness"}
          </button>

          {/* Clear filters */}
          {(hasReferrersOnly || minScoreFilter > 0 || freshnessFilter < 30) && (
            <button
              type="button"
              onClick={() => { setHasReferrersOnly(false); setMinScoreFilter(0); setFreshnessFilter(30); }}
              className="px-2 py-1.5 rounded-lg text-[11px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer bg-transparent border-0"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Real-time Matched Transition Notification */}
        {matchAddedToast && (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs animate-fadeInUp">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              <span className="text-base">🎉</span>
              <span>{matchAddedToast.message}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {jobsViewMode !== "matched" && (
                <button
                  type="button"
                  onClick={() => {
                    setJobsViewMode("matched");
                    setMatchAddedToast(null);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer border-0 shadow-xs"
                >
                  View in Matched →
                </button>
              )}
              <button
                type="button"
                onClick={() => setMatchAddedToast(null)}
                className="p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 cursor-pointer border-0 bg-transparent"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Freshness indicator for All Jobs */}
        {jobsViewMode === "all" && (
          <div className="flex items-center justify-between px-1 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>All verified listings posted within the last 30 days (≤ 1 month old)</span>
            </span>
            <span>{allCompanies.length} companies • {totalAllJobs} jobs</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-tertiary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input
            type="text"
            placeholder={jobsViewMode === "matched" ? "Search matched roles or companies..." : "Search all scraped companies and openings..."}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface hover:border-primary/50 focus:border-primary focus:outline-none transition-colors text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {displayedCompanies.length === 0 ? (
        <div className="card p-12 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px] justify-center bg-surface">
          <svg className="text-text-tertiary mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
          <p className="text-body text-text-secondary font-medium">
            {jobsViewMode === "matched" ? "No matched companies found." : "No scraped companies found."}
          </p>
          <p className="text-caption mt-1">
            {jobsViewMode === "matched" ? "Try updating your profile details, or switch to 'All Scraped Jobs by Company' above." : "Try adjusting your search query."}
          </p>
        </div>
      ) : (
        <div id="jobs-company-list" className="space-y-3">
          {displayedCompanies.map((group) => (
            <div
              key={group.company}
              className="card p-3 sm:p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] transition-all flex items-center justify-between gap-4"
            >
              <div 
                className="flex items-center gap-3 min-w-0 cursor-pointer"
                onClick={() => setActiveCompanyModal(group)}
                title="Click to view openings"
              >
                <CompanyLogo company={group.company} size={40} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-[var(--color-text)] truncate hover:text-[var(--color-primary)] transition-colors">
                    {group.company}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    📂 {group.jobs.length} Opening{group.jobs.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {group.contactsCount > 0 ? (
                  <button
                    onClick={() => {
                      router.push(`/qa?tab=network&company=${encodeURIComponent(group.company)}`);
                      window.dispatchEvent(new CustomEvent("tabchange", { detail: "/network" }));
                    }}
                    className="btn btn-sm btn-primary text-xs cursor-pointer font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <span>🤝</span> {group.contactsCount} Referrer{group.contactsCount > 1 ? "s" : ""} Available
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handlePioneerClick(group.company);
                      setActiveCompanyModal(group);
                    }}
                    className="btn btn-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg border-0 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title={`Open LinkedIn with ${group.company} & claim +10 pts Pioneer Bounty`}
                  >
                    <span>🏆</span> Pioneer +10 pts
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Openings Detail Modal */}
      {activeCompanyModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setActiveCompanyModal(null)}
        >
          <div 
            className="bg-[var(--color-surface)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--color-border)] animate-scaleIn flex flex-col max-h-[85vh] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pinned Sticky Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface)] shrink-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <CompanyLogo company={activeCompanyModal.company} size={28} />
                <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] m-0 truncate">
                  Openings at {activeCompanyModal.company}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setActiveCompanyModal(null)} 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] bg-[var(--color-surface)] cursor-pointer transition-colors shrink-0 shadow-2xs"
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-3.5 min-h-0">

            {(() => {
              const count = (activeCompanyModal.referralContacts || []).filter(c => !currentUserId || c.id !== currentUserId).length;
              const availableRefs = (activeCompanyModal.referralContacts || []).filter(c => !currentUserId || c.id !== currentUserId);
              if (count > 0) {
                return (
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>🤝</span>
                      <span><strong>{count} Referrer{count > 1 ? "s" : ""}</strong> available at {activeCompanyModal.company}</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {availableRefs.slice(0, 3).map((ref) => {
                        const alias = ref.alias || "Insider";
                        const title = alias.includes("@") ? alias.split("@")[0].trim() : "Colleague";
                        return (
                          <button
                            key={ref.id}
                            type="button"
                            onClick={() => {
                              handleOpenProximityProfile({
                                id: ref.id,
                                full_name: alias.includes("@") ? alias.split("@")[0].trim() : alias,
                                anonymous_name: alias,
                                job_title: title,
                                company: activeCompanyModal.company,
                                is_followed: ref.is_followed,
                              });
                            }}
                            className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-0.5 rounded-full border border-emerald-500/30 cursor-pointer flex items-center gap-1 transition-all"
                            title={`View ${alias}'s Proximity Profile`}
                          >
                            <span>👤</span>
                            <span>{alias.length > 18 ? alias.slice(0, 16) + "…" : alias}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/15 border border-amber-500/30 flex flex-col gap-3 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">🏆</span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-[var(--color-text)]">Pioneer Opportunity: +10 Credits Bounty</span>
                          <span className="badge text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold rounded">No Insiders Yet</span>
                          {watchedPioneerCompanies.includes(activeCompanyModal.company) && (
                            <span className="badge text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold rounded">🔔 Watching</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
                          No ProxNet insiders at {activeCompanyModal.company} yet. Draft AI cold outreach, find recruiters directly, or ask the community!
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePioneerClick(activeCompanyModal.company, "recruiter", `Recruiters at ${activeCompanyModal.company}`)}
                        className="btn btn-sm bg-[#0077b5] hover:bg-[#005885] text-white font-bold text-xs px-3 py-1.5 rounded-lg border-0 cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                        title="Search recruiters on LinkedIn"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        <span>Find Recruiters ↗</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInviteColleague(activeCompanyModal.company)}
                        className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg border-0 cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                        title="Invite a colleague & earn +10 credits"
                      >
                        <span>🎯</span> Invite (+10 pts)
                      </button>
                    </div>
                  </div>

                  {/* Secondary Quick Action Tools Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20 text-xs">
                    <button
                      type="button"
                      onClick={() => setCompanyResearchData({ company: activeCompanyModal.company })}
                      className="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-[var(--color-text)] font-semibold text-[11px] cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <span>🏢</span>
                      <span>Company Research Brief</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBridgeRequestData({ company: activeCompanyModal.company })}
                      className="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <span>🌉</span>
                      <span>Ask Network for Intro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleWatch(activeCompanyModal.company)}
                      className={`px-2.5 py-1 rounded-lg border font-semibold text-[11px] cursor-pointer flex items-center gap-1.5 transition-colors ml-auto ${
                        watchedPioneerCompanies.includes(activeCompanyModal.company)
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                          : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <span>🔔</span>
                      <span>{watchedPioneerCompanies.includes(activeCompanyModal.company) ? "Watching for Insiders ✓" : "Watch for Insiders"}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {inviteToast && (
              <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold animate-fadeInUp flex items-center gap-1.5">
                <span>{inviteToast}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                ⚠️ {errorMsg}
              </div>
            )}
            {saveToast && (
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-fadeInUp flex items-center gap-1.5">
                <span>{saveToast}</span>
              </div>
            )}
            <div className="space-y-3 pr-1">
              {[...activeCompanyModal.jobs]
                .sort((a, b) => {
                  const scoreA = a.score ?? a.matchRate ?? 0;
                  const scoreB = b.score ?? b.matchRate ?? 0;
                  if (scoreB !== scoreA) return scoreB - scoreA;
                  const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
                  const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
                  return dateB - dateA;
                })
                .map((job) => {
                  const cleanDirectUrl = (job.url || "").replace(/&amp;/g, "&").trim();
                  return (
                    <div key={job.id} className="p-4 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex flex-col gap-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-sm text-[var(--color-text)] m-0 leading-snug">{cleanJobTitle(job.title)}</h4>
                        {job.label === "Strong Match" ? (
                          <span className="badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 font-bold shrink-0 flex items-center gap-1">
                            🔥 Strong Match • {job.score || job.matchRate}%
                          </span>
                        ) : job.label === "Good Match" ? (
                          <span className="badge bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 font-bold shrink-0 flex items-center gap-1">
                            ✨ Good Match • {job.score || job.matchRate}%
                          </span>
                        ) : job.label === "Moderate Match" ? (
                          <span className="badge bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 font-bold shrink-0 flex items-center gap-1">
                            💡 {job.label || "Moderate Match"} • {job.score || job.matchRate}%
                          </span>
                        ) : job.label === "Low Match" ? (
                          <span className="badge bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30 text-[10px] px-2 py-0.5 font-bold shrink-0 flex items-center gap-1">
                            Low Match • {job.score || job.matchRate}%
                          </span>
                        ) : (
                          <span className="badge bg-primary/10 text-primary border border-primary/20 text-[10px] px-2 py-0.5 font-bold shrink-0 flex items-center gap-1">
                            🏢 Active Role
                          </span>
                        )}
                      </div>

                      {/* On-demand Match Rate Button for All Jobs / Unscored Jobs */}
                      {(!job.score || job.label === "Active Role") && (
                        <div className="flex items-center gap-2 pt-0.5">
                          {hasResume ? (
                            <button
                              type="button"
                              onClick={() => handleFindMatchRate(job.id)}
                              disabled={calculatingMatchJobId === job.id}
                              className="btn btn-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs disabled:opacity-60"
                            >
                              {calculatingMatchJobId === job.id ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                  </svg>
                                  <span>Calculating Match with Latest Resume...</span>
                                </>
                              ) : (
                                <>
                                  <span>✨</span>
                                  <span>Find Match Rate</span>
                                  <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.2 rounded-full">
                                    1 credit
                                  </span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCompanyModal(null);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 font-medium"
                              title="Upload resume at top to check match rate"
                            >
                              <span>📄</span>
                              <span>Upload resume to find match rate (1 credit)</span>
                            </button>
                          )}
                        </div>
                      )}

                      {job.reason && (
                        <div className="text-xs text-text-secondary bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-md p-2.5 flex items-start gap-2">
                          <span className="text-primary text-xs shrink-0 mt-0.5">💡</span>
                          <span className="leading-relaxed font-normal">{job.reason}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                        <span>📍 {job.location || "Remote"}</span>
                        {job.posted_at && (
                          <span className={getFreshnessBadge(job.posted_at).cls}>
                            {getFreshnessBadge(job.posted_at).text}
                          </span>
                        )}
                      </div>
                      {/* Skill Keywords */}
                      {job.keywords && job.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {job.keywords.slice(0, 5).map((kw, idx) => (
                            <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const availableReferrers = (activeCompanyModal.referralContacts || []).filter(
                          (c) => !currentUserId || c.id !== currentUserId
                        );
                        const hasReferrer = availableReferrers.length > 0;
                        const isOwnCompany = Boolean(
                          currentUserCompany &&
                          activeCompanyModal.company &&
                          currentUserCompany.trim().toLowerCase() === activeCompanyModal.company.trim().toLowerCase()
                        );

                        if (hasReferrer) {
                          return (
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isOwnCompany) {
                                      handleAskReferral(job, activeCompanyModal);
                                    } else {
                                      setPitchModalJob({ job, group: activeCompanyModal });
                                    }
                                  }}
                                  disabled={startingReferralJobId === job.id}
                                  className="btn btn-sm btn-primary text-center text-xs font-semibold py-2 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 col-span-2"
                                >
                                  {startingReferralJobId === job.id ? (
                                    <>
                                      <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                      </svg>
                                      <span>Opening...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>{isOwnCompany ? "💬" : "🤝"}</span>
                                      <span>{isOwnCompany ? "Message Colleague" : "Ask Referral"}</span>
                                    </>
                                  )}
                                </button>

                                {/* Save Button */}
                                {(() => {
                                  const idKey = job.id ? `id:${job.id}` : null;
                                  const textKey = `text:${activeCompanyModal.company.toLowerCase().trim()}:::${job.title.toLowerCase().trim()}`;
                                  const isSaved = (idKey && savedJobKeys.has(idKey)) || savedJobKeys.has(textKey);
                                  const isSaving = savingJobId === job.id;

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveJob(job, activeCompanyModal.company)}
                                      disabled={isSaving || isSaved}
                                      className={`btn btn-sm text-center text-xs font-semibold py-2 flex items-center justify-center gap-1.5 shadow-2xs transition-all ${
                                        isSaved
                                          ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 cursor-default"
                                          : isSaving
                                          ? "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] opacity-75 cursor-wait"
                                          : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] cursor-pointer"
                                      }`}
                                      title={isSaved ? "Saved to your pipeline" : "Save to your pipeline"}
                                    >
                                      {isSaving ? (
                                        <>
                                          <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                          </svg>
                                          <span>Saving...</span>
                                        </>
                                      ) : isSaved ? (
                                        <>
                                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                                          <span className="text-emerald-700 dark:text-emerald-300 font-bold">Saved</span>
                                        </>
                                      ) : (
                                        <>
                                          <span>🔖</span>
                                          <span>Save</span>
                                        </>
                                      )}
                                    </button>
                                  );
                                })()}
                              </div>

                              {cleanDirectUrl ? (
                                <a
                                  href={cleanDirectUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] text-center text-xs font-semibold py-2 no-underline flex items-center justify-center gap-1 shadow-2xs"
                                >
                                  <span>↗</span>
                                  <span>Apply Directly</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="btn btn-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-light)] text-center text-xs font-semibold py-2 opacity-50 cursor-not-allowed"
                                >
                                  Direct Link N/A
                                </button>
                              )}
                            </div>
                          );
                        }

                        // When referrer is not available: Pioneer Job Seeker Action Suite
                        const idKey = job.id ? `id:${job.id}` : null;
                        const textKey = `text:${activeCompanyModal.company.toLowerCase().trim()}:::${job.title.toLowerCase().trim()}`;
                        const isSaved = (idKey && savedJobKeys.has(idKey)) || savedJobKeys.has(textKey);
                        const isSaving = savingJobId === job.id;

                        return (
                          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-border-light)]/40">
                            {/* Primary Action: Draft AI Cold Outreach (FREE • 0 Credits) */}
                            <button
                              type="button"
                              onClick={() => setColdOutreachModalJob({ job, company: activeCompanyModal.company })}
                              className="btn btn-sm bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                            >
                              <span>✉️</span>
                              <span>Draft AI Cold Outreach (FREE • 0 Credits)</span>
                            </button>

                            {/* Secondary Action Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {/* Recruiter Finder Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handlePioneerClick(
                                    activeCompanyModal.company,
                                    `recruiter ${cleanJobTitle(job.title)}`,
                                    `Recruiters for ${cleanJobTitle(job.title)} at ${activeCompanyModal.company}`
                                  )
                                }
                                className="btn btn-sm bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[#0077b5] dark:text-sky-400 border border-[var(--color-border)] text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Find recruiters on LinkedIn"
                              >
                                <span>🔍</span>
                                <span>Recruiter</span>
                              </button>

                              {/* Hiring Manager Finder Button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handlePioneerClick(
                                    activeCompanyModal.company,
                                    `engineering manager OR hiring manager ${cleanJobTitle(job.title)}`,
                                    `Hiring Managers for ${cleanJobTitle(job.title)} at ${activeCompanyModal.company}`
                                  )
                                }
                                className="btn btn-sm bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                title="Find hiring managers on LinkedIn"
                              >
                                <span>🎯</span>
                                <span>Hiring Mgr</span>
                              </button>

                              {/* Save to Pipeline Button */}
                              <button
                                type="button"
                                onClick={() => handleSaveJob(job, activeCompanyModal.company)}
                                disabled={isSaving || isSaved}
                                className={`btn btn-sm text-center text-xs font-semibold py-1.5 flex items-center justify-center gap-1 shadow-2xs transition-all ${
                                  isSaved
                                    ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 cursor-default"
                                    : isSaving
                                    ? "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] opacity-75 cursor-wait"
                                    : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] cursor-pointer"
                                }`}
                                title={isSaved ? "Saved to your pipeline" : "Save to your pipeline"}
                              >
                                {isSaving ? (
                                  <span>Saving...</span>
                                ) : isSaved ? (
                                  <>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">Saved</span>
                                  </>
                                ) : (
                                  <>
                                    <span>🔖</span>
                                    <span>Save</span>
                                  </>
                                )}
                              </button>

                              {/* Direct Career Site Apply Link */}
                              {cleanDirectUrl ? (
                                <a
                                  href={cleanDirectUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] text-center text-xs font-semibold py-1.5 no-underline flex items-center justify-center gap-1 shadow-2xs"
                                >
                                  <span>↗</span>
                                  <span>Apply Direct</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-center text-[var(--color-text-tertiary)] py-1.5">Direct N/A</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Referral Pitch Modal */}
      {pitchModalJob && (
        <ReferralPitchModal
          isOpen={true}
          onClose={() => setPitchModalJob(null)}
          onSend={async (customMessage: string) => {
            const { job, group } = pitchModalJob;
            setPitchModalJob(null);

            // Use the custom message from the pitch modal
            const availableReferrers = (group.referralContacts || []).filter(
              (c) => !currentUserId || c.id !== currentUserId
            );
            const targetContact = availableReferrers.find((c) => c.is_followed) || availableReferrers[0];
            if (!targetContact) {
              const cleanUrl = (job.url || "").replace(/&amp;/g, "&").trim();
              if (cleanUrl) {
                const a = document.createElement("a");
                a.href = cleanUrl;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
              return;
            }

            setStartingReferralJobId(job.id);
            try {
              const cleanUrl = (job.url || "").replace(/&amp;/g, "&").trim();
              const res = await fetch("/api/jobs/chat/init-referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contactId: targetContact.id,
                  jobId: job.id,
                  company: group.company,
                  jobTitle: job.title,
                  jobUrl: cleanUrl,
                  location: job.location,
                  score: job.score ?? job.matchRate,
                  reason: job.reason,
                  customMessage,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.threadId) {
                  setActiveCompanyModal(null);
                  try {
                    sessionStorage.removeItem("proxnet_inbox_cache");
                  } catch (e) {}
                  mutate("/api/jobs/inbox");
                  router.push(`/jobs/chat/${data.threadId}`);
                }
              }
            } catch (err) {
              console.error("Referral from pitch modal failed:", err);
            } finally {
              setStartingReferralJobId(null);
            }
          }}
          job={{
            id: pitchModalJob.job.id,
            title: pitchModalJob.job.title,
            url: pitchModalJob.job.url,
            description: pitchModalJob.job.description,
            keywords: pitchModalJob.job.keywords,
            score: pitchModalJob.job.score,
            label: pitchModalJob.job.label,
            reason: pitchModalJob.job.reason,
          }}
          company={pitchModalJob.group.company}
          referrerAlias={
            (() => {
              const refs = (pitchModalJob.group.referralContacts || []).filter(
                (c) => !currentUserId || c.id !== currentUserId
              );
              const target = refs.find((c) => c.is_followed) || refs[0];
              return target?.alias || "Insider";
            })()
          }
          isSending={startingReferralJobId === pitchModalJob.job.id}
        />
      )}

      {/* Target Company Manager Modal */}
      {showTargetCompanyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowTargetCompanyModal(false)}
        >
          <div
            className="bg-[var(--color-surface)] w-full max-w-lg rounded-xl shadow-xl border border-[var(--color-border)] p-0 animate-scaleIn flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] rounded-t-xl">
              <h3 className="text-sm font-bold text-[var(--color-text)] m-0 flex items-center gap-1.5">
                <span>🎯</span> Track Target Companies
              </h3>
              <button
                onClick={() => setShowTargetCompanyModal(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border-0 bg-transparent cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                Add any company to automatically scrape their career site and get notified when matching roles appear.
              </p>
              <TargetCompanyManager onCompaniesChanged={() => { loadData(); }} />
            </div>
          </div>
        </div>
      )}

      {/* Deep Career Conversion Miner Modal */}
      <DeepConversionModal
        isOpen={showDeepConversionModal}
        onClose={() => setShowDeepConversionModal(false)}
        wallet={userWallet ?? 0}
        hasResume={hasResume}
        onBlueprintsFetched={handleBlueprintsFetched}
        onOpenResumeUpload={() => {
          const el = document.getElementById("resume-upload-input");
          if (el) el.click();
        }}
      />

      {/* Deep ATS Match Hunter Modal */}
      <DeepFetchModal
        isOpen={showDeepFetchModal}
        onClose={() => setShowDeepFetchModal(false)}
        wallet={userWallet ?? 0}
        hasResume={hasResume}
        onMatchesFetched={handleMatchesFetched}
        onOpenResumeUpload={() => {
          const el = document.getElementById("resume-upload-input");
          if (el) el.click();
        }}
      />

      {/* Proximity Card Detail Modal */}
      {selectedPerson && (
        <ProximityCardModal
          person={selectedPerson}
          currentUserProfile={{
            company: currentUserCompany,
          }}
          onClose={() => setSelectedPerson(null)}
          onStartChat={(p) => {
            const target = p || selectedPerson;
            setSelectedPerson(null);
            setChatTarget(target);
          }}
          onFollowToggle={(e, p) => {
            setSelectedPerson((prev: any) => prev ? { ...prev, is_followed: !prev.is_followed } : null);
            fetch(`/api/proximity/follow`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetUserId: p.id }),
            }).catch(() => {});
          }}
        />
      )}

      {/* Direct Message Dialog from Jobs tab */}
      {chatTarget && (
        <div
          className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 pb-safe backdrop-blur-sm animate-fadeIn"
          onClick={() => setChatTarget(null)}
        >
          <div
            className="bg-[var(--color-surface)] w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[92dvh] overflow-hidden animate-slideUp sm:animate-scaleIn pb-2 sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0 flex items-center gap-2">
                <span>💬</span>
                <span>Direct Message</span>
              </h3>
              <button
                type="button"
                onClick={() => setChatTarget(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <QuestionForm
                targetUser={{
                  id: chatTarget.id,
                  job_title: chatTarget.job_title || "Professional",
                  company: chatTarget.company || "Nearby Company",
                }}
                initialMsg={
                  currentUserCompany &&
                  chatTarget?.company &&
                  currentUserCompany.trim().toLowerCase() === chatTarget.company.trim().toLowerCase()
                    ? `Hi! I noticed we both work at ${chatTarget.company} and are nearby in the area. Would love to connect and chat!`
                    : `Hi! I noticed we're professional neighbors in the area and you work as a ${chatTarget.job_title || "professional"} at ${chatTarget.company || "a nearby company"}. Would love to connect and chat!`
                }
                onPosted={() => {
                  setTimeout(() => setChatTarget(null), 1500);
                }}
              />
            </div>
          </div>
        </div>
      )}


      {/* ── LinkedIn Launch Interstitial (replaces auto window.open) ── */}
      {linkedInLaunchData && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setLinkedInLaunchData(null)}
        >
          <div
            className="bg-[var(--color-surface)] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[var(--color-border)] animate-slideUp sm:animate-scaleIn overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--color-border-light)] bg-gradient-to-r from-[#0077b5]/10 to-transparent">
              <h3 className="text-sm font-bold text-[var(--color-text)] m-0 flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <span>{linkedInLaunchData.title || `Open LinkedIn — ${linkedInLaunchData.company}`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLinkedInLaunchData(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Pioneer Bounty Callout */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <span className="text-2xl shrink-0">🏆</span>
                <div>
                  <p className="text-xs font-bold text-[var(--color-text)] m-0">Pioneer Bounty: +10 Credits</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] m-0 mt-1 leading-relaxed">
                    Find a colleague at <strong>{linkedInLaunchData.company}</strong> on LinkedIn and invite them to ProxNet. When they join, you earn <strong>+10 credits</strong>!
                  </p>
                </div>
              </div>

              {/* Invite Link (already copied) */}
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] m-0 tracking-wider">Your Invite Link (copied to clipboard ✓)</p>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={linkedInLaunchData.inviteUrl}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-[11px] font-mono text-[var(--color-text-secondary)] pr-16"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(linkedInLaunchData.inviteUrl);
                      setInviteToast("✓ Invite link copied!");
                      setTimeout(() => setInviteToast(null), 2500);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-primary/10 text-primary text-[10px] font-bold border-none cursor-pointer hover:bg-primary/20 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(linkedInLaunchData.inviteUrl);
                    } catch {}
                    setInviteToast(`🔗 Link copied! Opening LinkedIn search...`);
                    if (typeof window !== "undefined") {
                      window.open(linkedInLaunchData.url, "_blank", "noopener,noreferrer");
                    }
                    setTimeout(() => {
                      setInviteToast(null);
                      setLinkedInLaunchData(null);
                    }, 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0077b5] hover:bg-[#005885] text-white font-bold text-sm shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  <span>{linkedInLaunchData.title ? `${linkedInLaunchData.title} ↗` : `Search ${linkedInLaunchData.company} on LinkedIn ↗`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(linkedInLaunchData.url);
                      setInviteToast("✓ LinkedIn search link copied! You can paste it directly in the LinkedIn App.");
                      setTimeout(() => setInviteToast(null), 3500);
                    } catch {}
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[#0077b5] dark:text-[#00a0dc] font-bold text-xs border border-[#0077b5]/30 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>📋</span>
                  <span>Copy Search Link (Open in LinkedIn App)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLinkedInLaunchData(null)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] font-bold text-xs border border-[var(--color-border-light)] cursor-pointer transition-colors"
                >
                  ✕ Stay in ProxNet
                </button>
              </div>

              {/* Return hint */}
              <p className="text-[10px] text-center text-[var(--color-text-tertiary)] m-0 leading-relaxed">
                💡 LinkedIn opens externally in your browser or LinkedIn app. Your ProxNet app and active session remain right here!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Cold Outreach Modal (Pioneer Jobs) ── */}
      {coldOutreachModalJob && (
        <ColdOutreachModal
          isOpen={!!coldOutreachModalJob}
          onClose={() => setColdOutreachModalJob(null)}
          job={coldOutreachModalJob.job}
          company={coldOutreachModalJob.company}
          userInviteCode={userInviteCode}
          onOpenLinkedIn={(searchUrl, label) => {
            const inviteUrl = userInviteCode
              ? `${window.location.origin}/join/${userInviteCode}?company=${encodeURIComponent(coldOutreachModalJob.company)}`
              : `${window.location.origin}/grow`;
            setLinkedInLaunchData({
              url: searchUrl,
              company: coldOutreachModalJob.company,
              inviteUrl,
              title: label,
            });
            setColdOutreachModalJob(null);
          }}
        />
      )}

      {/* ── Company Research Modal (Pioneer Companies) ── */}
      {companyResearchData && (
        <CompanyResearchModal
          isOpen={!!companyResearchData}
          onClose={() => setCompanyResearchData(null)}
          company={companyResearchData.company}
          jobTitle={companyResearchData.jobTitle}
          similarCompaniesWithReferrers={similarCompaniesWithReferrers}
          onSelectSimilarCompany={(comp) => {
            const found = (companies.length > 0 ? companies : allCompanies).find(
              (c) => c.company.toLowerCase() === comp.toLowerCase()
            );
            if (found) {
              setActiveCompanyModal(found);
            }
          }}
          onOpenColdOutreach={() => {
            const foundJob =
              activeCompanyModal?.jobs[0] || {
                id: `research_${Date.now()}`,
                title: companyResearchData.jobTitle || "Open Role",
                location: "",
                url: "",
                description: "",
                posted_at: "",
                keywords: [],
                matchRate: 0,
              };
            setColdOutreachModalJob({
              job: foundJob,
              company: companyResearchData.company,
            });
          }}
          onOpenLinkedInSearch={(type) => {
            const query =
              type === "recruiter"
                ? `recruiter ${companyResearchData.jobTitle ? cleanJobTitle(companyResearchData.jobTitle) : ""}`
                : type === "hiring_manager"
                ? `hiring manager ${companyResearchData.jobTitle ? cleanJobTitle(companyResearchData.jobTitle) : ""}`
                : "";
            handlePioneerClick(
              companyResearchData.company,
              query.trim(),
              type === "recruiter"
                ? `Recruiters at ${companyResearchData.company}`
                : `Hiring Managers at ${companyResearchData.company}`
            );
          }}
        />
      )}

      {/* ── Bridge Request Modal (Ask the Network) ── */}
      {bridgeRequestData && (
        <BridgeRequestModal
          isOpen={!!bridgeRequestData}
          onClose={() => setBridgeRequestData(null)}
          company={bridgeRequestData.company}
          jobTitle={bridgeRequestData.jobTitle}
          userInviteCode={userInviteCode}
          onSuccess={() => {
            setInviteToast(`✓ Bridge request published for ${bridgeRequestData.company}!`);
            setTimeout(() => setInviteToast(null), 4000);
          }}
        />
      )}

    </div>
  );
}
