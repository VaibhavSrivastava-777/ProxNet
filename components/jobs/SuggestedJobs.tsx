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
import { cleanJobTitle } from "@/lib/jobs/job-filters";

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

export function SuggestedJobs() {
  const [companies, setCompanies] = useState<CompanyGroup[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      sessionStorage.removeItem("proxnet_suggested_jobs_cache"); // purge legacy
      sessionStorage.removeItem("proxnet_suggested_jobs_cache_v2"); // purge legacy
      sessionStorage.removeItem("proxnet_suggested_jobs_cache_v3"); // purge legacy
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache_v4");
      if (cached) return JSON.parse(cached).companies || [];
    } catch {
      // ignore
    }
    return [];
  });
  const [allCompanies, setAllCompanies] = useState<CompanyGroup[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      sessionStorage.removeItem("proxnet_all_jobs_cache"); // purge legacy
      sessionStorage.removeItem("proxnet_all_jobs_cache_v2"); // purge legacy
      const cached = sessionStorage.getItem("proxnet_all_jobs_cache_v3");
      if (cached) return JSON.parse(cached).companies || [];
    } catch {
      // ignore
    }
    return [];
  });
  const [jobsViewMode, setJobsViewMode] = useState<"matched" | "all">("matched");
  const [profileDigest, setProfileDigest] = useState<ProfileDigest | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache_v3");
      if (cached) return JSON.parse(cached).profileDigest || null;
    } catch {
      // ignore
    }
    return null;
  });
  const [hasResume, setHasResume] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.hasResume !== undefined) return parsed.hasResume;
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [resumeUrl, setResumeUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache");
      if (cached) return JSON.parse(cached).resumeUrl || null;
    } catch {
      // ignore
    }
    return null;
  });
  const [userWallet, setUserWallet] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache");
      if (cached) return JSON.parse(cached).wallet ?? null;
    } catch {
      // ignore
    }
    return null;
  });
  const [calculatingMatchJobId, setCalculatingMatchJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return !sessionStorage.getItem("proxnet_suggested_jobs_cache");
    } catch {
      // ignore
    }
    return true;
  });
  const [activeCompanyModal, setActiveCompanyModal] = useState<CompanyGroup | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserCompany, setCurrentUserCompany] = useState<string | null>(null);
  const [userInviteCode, setUserInviteCode] = useState<string | null>(null);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [startingReferralJobId, setStartingReferralJobId] = useState<string | null>(null);
  const [isMatchingCompleted, setIsMatchingCompleted] = useState(true);
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
  const [deepConversionBlueprints, setDeepConversionBlueprints] = useState<ConversionBlueprint[]>([]);
  const [activeBlueprintTab, setActiveBlueprintTab] = useState<Record<number, "x" | "y" | "z">>({});
  const [copiedBlueprintIndex, setCopiedBlueprintIndex] = useState<number | null>(null);
  const [showDeepFetchModal, setShowDeepFetchModal] = useState(false);
  const [deepHunterMatches, setDeepHunterMatches] = useState<any[]>([]);
  // Save job feedback & state tracking
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [savedJobKeys, setSavedJobKeys] = useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  // Option 5: Proximity Colleagues & Helpers State
  const [nearbyHelpers, setNearbyHelpers] = useState<NearbyHelper[]>([]);
  const router = useRouter();

  const handleBlueprintsFetched = (blueprints: ConversionBlueprint[], newWallet: number) => {
    setDeepConversionBlueprints(blueprints);
    setUserWallet(newWallet);
    window.dispatchEvent(new CustomEvent("wallet-updated", { detail: newWallet }));
    try {
      playNotificationSound("job_match");
    } catch {}
    setMatchAddedToast({
      show: true,
      message: `🎯 Generated ${blueprints.length} strategic conversion blueprints with Focus X, Y, Z & warm connector bridges!`,
      score: blueprints[0]?.matchScore || 92,
    });
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

    // Also auto-merge these matches into existing companies state if matched
    if (externalMatches.length > 0) {
      setCompanies((prev) => {
        const updated = [...prev];
        for (const m of externalMatches) {
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
            updated[compIdx] = { ...existingComp, jobs: existingJobs };
          } else {
            updated.unshift({
              company: m.company,
              contactsCount: m.referralContacts?.length || 0,
              referralContacts: m.referralContacts || [],
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

  const loadData = useCallback(async () => {
    try {
      const t = Date.now();
      const [suggestedRes, allRes, peopleRes] = await Promise.allSettled([
        fetch(`/api/jobs/suggested?_t=${t}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
        fetch(`/api/jobs/all?_t=${t}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
        fetch(`/api/proximity/people?unfiltered=true`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      ]);

      if (peopleRes.status === "fulfilled" && peopleRes.value) {
        const pData = peopleRes.value;
        const peopleList: NearbyHelper[] = Array.isArray(pData.people)
          ? pData.people
          : Array.isArray(pData)
          ? pData
          : [];
        setNearbyHelpers(peopleList);
      }

      if (suggestedRes.status === "fulfilled" && suggestedRes.value) {
        const data = suggestedRes.value;
        setCompanies(data.companies || []);
        setIsMatchingCompleted(data.isMatchingCompleted ?? true);
        if (data.currentUserId) {
          setCurrentUserId(data.currentUserId);
        }
        if (data.currentUserCompany) {
          setCurrentUserCompany(data.currentUserCompany);
        }
        if (data.inviteCode) {
          setUserInviteCode(data.inviteCode);
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
          if (Array.isArray(data.profileDigest.deep_career_blueprints) && data.profileDigest.deep_career_blueprints.length > 0) {
            setDeepConversionBlueprints(data.profileDigest.deep_career_blueprints);
          }
        }

        try {
          sessionStorage.setItem("proxnet_suggested_jobs_cache_v4", JSON.stringify({
            companies: data.companies || [],
            profileDigest: data.profileDigest || null,
            hasResume: data.hasResume ?? true,
            resumeUrl: data.resumeUrl || null,
            wallet: data.wallet ?? 0,
            currentUserId: data.currentUserId || null,
          }));
        } catch {
          // ignore
        }
      }

      if (allRes.status === "fulfilled" && allRes.value) {
        const allData = allRes.value;
        setAllCompanies(allData.companies || []);
        if (allData.currentUserId) {
          setCurrentUserId(allData.currentUserId);
        }
        if (allData.currentUserCompany) {
          setCurrentUserCompany(allData.currentUserCompany);
        }
        if (allData.inviteCode) {
          setUserInviteCode(allData.inviteCode);
        }
        if (allData.hasResume !== undefined) {
          setHasResume(allData.hasResume);
        }
        if (allData.resumeUrl !== undefined) {
          setResumeUrl(allData.resumeUrl);
        }
        if (allData.wallet !== undefined) {
          setUserWallet(allData.wallet);
        }
        try {
          sessionStorage.setItem("proxnet_all_jobs_cache_v3", JSON.stringify({
            companies: allData.companies || [],
            hasResume: allData.hasResume ?? true,
            resumeUrl: allData.resumeUrl || null,
            wallet: allData.wallet ?? 0,
          }));
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("Failed to load jobs feed", e);
      setErrorMsg("An error occurred while fetching jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        loadData();
      }
    });
    return () => {
      active = false;
    };
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
          window.open(cleanUrl, "_blank", "noopener,noreferrer");
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
  const applyAdvancedFilters = (companiesList: CompanyGroup[]) => {
    const q = searchQuery.toLowerCase().trim();
    return companiesList
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

  const filteredMatchedCompanies = applyAdvancedFilters(companies);
  const filteredAllCompanies = applyAdvancedFilters(allCompanies);

  const displayedCompanies = jobsViewMode === "matched" ? filteredMatchedCompanies : filteredAllCompanies;

  // Stats for market pulse
  const totalMatchedJobs = companies.reduce((acc, c) => acc + c.jobs.length, 0);
  const totalAllJobs = allCompanies.reduce((acc, c) => acc + c.jobs.length, 0);
  const strongMatchCount = companies.reduce((acc, c) => acc + c.jobs.filter(j => (j.score ?? j.matchRate ?? 0) >= 85).length, 0);
  const companiesWithReferrers = companies.filter(c => c.contactsCount > 0).length;
  const totalReferrers = companies.reduce((acc, c) => acc + c.contactsCount, 0);

  // Option 5: Flattened and sorted matched opportunities for Hero & Similar sections
  const allFlattenedMatchedJobs = useMemo(() => {
    return companies.flatMap((g) =>
      g.jobs.map((j) => ({ job: j, group: g }))
    ).sort((a, b) => {
      const scoreA = a.job.score ?? a.job.matchRate ?? 0;
      const scoreB = b.job.score ?? b.job.matchRate ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const dateA = a.job.posted_at ? new Date(a.job.posted_at).getTime() : 0;
      const dateB = b.job.posted_at ? new Date(b.job.posted_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [companies]);

  // Top hero match (highest match opportunity or fallback to first available opening)
  const heroJobItem = useMemo(() => {
    if (allFlattenedMatchedJobs.length > 0) return allFlattenedMatchedJobs[0];
    if (allCompanies.length > 0 && allCompanies[0].jobs.length > 0) {
      return { job: allCompanies[0].jobs[0], group: allCompanies[0] };
    }
    return null;
  }, [allFlattenedMatchedJobs, allCompanies]);

  // Next top opportunities (Option 5: "More Similar Jobs")
  const similarJobs = useMemo(() => {
    if (allFlattenedMatchedJobs.length > 1) {
      return allFlattenedMatchedJobs.slice(1, 5);
    }
    const others = allCompanies
      .flatMap((g) => g.jobs.map((j) => ({ job: j, group: g })))
      .filter((item) => !heroJobItem || item.job.id !== heroJobItem.job.id);
    return others.slice(0, 4);
  }, [allFlattenedMatchedJobs, allCompanies, heroJobItem]);

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

      {/* 🤝 Active Referral Conversations (Only displays if active threads exist) */}
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
                <span>
                  {heroJobItem.group.contactsCount} ProxNet connection{heroJobItem.group.contactsCount > 1 ? "s" : ""} can refer you
                </span>
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
                onClick={() => handleInviteColleague(heroJobItem.group.company)}
                className="py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-xs sm:text-sm text-center transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
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
              router.push("/qa?tab=network");
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
                  router.push(`/chat?user=${person.id}`);
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
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          👥 {availableReferrers.length} referrer{availableReferrers.length > 1 ? "s" : ""} nearby
                        </span>
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
                          onClick={() => handleInviteColleague(group.company)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
                          title="No members from this company yet. Invite a colleague and earn +10 credits!"
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

      {/* ── 4. CAREER EXPLORER & ADVANCED UTILITIES (Progressive Disclosure) ── */}
      <div className="pt-6 border-t border-[var(--color-border-light)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[var(--color-text)] uppercase tracking-wider m-0">
              Career Explorer & Tools
            </h3>
            <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
              Hiring pulse, ATS match hunter, resume alerts & full company directory
            </p>
          </div>
        </div>

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
                    High-yield peer roles equipped with Focus X (resume hooks), Focus Y (ATS gaps), Focus Z (interview pitches) & warm connectors
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

                    {/* Focus X, Y, Z Tab Bar */}
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
                          🎯 Focus X (Resume Hook)
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
                          ⚙️ Focus Y (ATS Optimization)
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
                          🎙️ Focus Z (Interview Strategy)
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
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{isProxNet ? "🟢" : "🔵"}</span>
                            <span className="font-bold text-xs text-[var(--color-text)]">
                              {bp.connector.connectionPath}
                            </span>
                          </div>

                          {!isProxNet && bp.connector.linkedinAlumniUrl && (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={bp.connector.linkedinAlumniUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded bg-[#0077b5]/15 text-[#0077b5] dark:text-[#00a0dc] font-bold text-[10px] border border-[#0077b5]/30 hover:bg-[#0077b5] hover:text-white transition-all"
                              >
                                Alumni Search ↗
                              </a>
                              <a
                                href={bp.connector.linkedinSearchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded bg-[#0077b5]/15 text-[#0077b5] dark:text-[#00a0dc] font-bold text-[10px] border border-[#0077b5]/30 hover:bg-[#0077b5] hover:text-white transition-all"
                              >
                                Leaders ↗
                              </a>
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
                      <button
                        type="button"
                        onClick={() => handleInviteColleague(m.company)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                        title="No members from this company yet. Invite a colleague and earn +10 credits!"
                      >
                        <span>🏆 Pioneer +10 pts</span>
                        <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">• Invite Colleague</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        <span>🤝</span>
                        <span>{m.referralContacts?.length || 1} Insider Referrer(s) Available</span>
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

        {/* Resume Management & Automated Job Alerts Card */}
        <ResumeCard
          hasResume={hasResume}
          resumeUrl={resumeUrl}
          onResumeUpdated={loadData}
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
                    onClick={() => setActiveCompanyModal(group)}
                    className="btn btn-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg border-0 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title={`View ${group.jobs.length} opening${group.jobs.length > 1 ? "s" : ""} & claim +10 pts Pioneer Bounty`}
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
              if (count > 0) {
                return (
                  <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>🤝</span>
                      <span><strong>{count} Referrer{count > 1 ? "s" : ""}</strong> available at {activeCompanyModal.company}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      Referral Chat Ready
                    </span>
                  </div>
                );
              }
              return (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">🏆</span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--color-text)]">Pioneer Bounty: +10 Credits</span>
                        <span className="badge text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold rounded">Unclaimed</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
                        No insiders from {activeCompanyModal.company} on ProxNet yet. Invite a colleague with your invite link and claim +10 credits when they join!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInviteColleague(activeCompanyModal.company)}
                    className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg border-0 cursor-pointer shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                  >
                    <span>🎯</span> Invite Colleague
                  </button>
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

                        // When referrer is not available, keep the flow as-is
                        return (
                          cleanDirectUrl && (
                            <a
                              href={cleanDirectUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-primary mt-1 text-center text-xs block py-1.5 no-underline font-semibold"
                            >
                              Apply on Career Website
                            </a>
                          )
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
                window.open(cleanUrl, "_blank", "noopener,noreferrer");
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

    </div>
  );
}
