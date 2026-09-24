"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { ResumeCard } from "./ResumeCard";
import { ReferralPitchModal } from "./ReferralPitchModal";
import { TargetCompanyManager } from "./TargetCompanyManager";
import { ApplicationPipeline } from "./ApplicationPipeline";
import { playNotificationSound } from "@/lib/sound";

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

export function SuggestedJobs() {
  const [companies, setCompanies] = useState<CompanyGroup[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      sessionStorage.removeItem("proxnet_suggested_jobs_cache"); // purge legacy
      sessionStorage.removeItem("proxnet_suggested_jobs_cache_v2"); // purge legacy
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache_v3");
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
      const cached = sessionStorage.getItem("proxnet_all_jobs_cache_v2");
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
  // Save job feedback & state tracking
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [savedJobKeys, setSavedJobKeys] = useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const router = useRouter();

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
      const [suggestedRes, allRes] = await Promise.allSettled([
        fetch(`/api/jobs/suggested?_t=${t}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
        fetch(`/api/jobs/all?_t=${t}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      ]);

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
        }
        try {
          sessionStorage.setItem("proxnet_suggested_jobs_cache_v3", JSON.stringify({
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
          sessionStorage.setItem("proxnet_all_jobs_cache_v2", JSON.stringify({
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
          message: `🔥 High Match (${data.score}%): ${evaluatedJobItem.title} at ${evaluatedCompanyName} is now in your "Matched" tab!`,
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

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto pb-8">
        {/* Default/Prominent Message */}
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-center animate-pulse">
          ⏳ GENERATING THE LATEST MATCH LIST IN THE BACKGROUD
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 skeleton h-24 animate-pulse" />
        ))}
      </div>
    );
  }

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
      setSaveToast(`Already saved "${job.title}" to your pipeline`);
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
        setSaveToast(`🔖 Saved "${job.title}" to your pipeline`);
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

  return (
    <div className="space-y-4 stagger-children max-w-3xl mx-auto pb-8">
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

      {/* Default/Prominent Message */}
      {!isMatchingCompleted && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-center animate-pulse">
          ℹ️ GENERATING THE LATEST MATCH LIST IN THE BACKGROUND
        </div>
      )}

      {/* Resume Management & Automated Job Alerts Card */}
      <ResumeCard
        hasResume={hasResume}
        resumeUrl={resumeUrl}
        onResumeUpdated={loadData}
      />

      {/* 📊 Market Pulse Summary */}
      {(totalMatchedJobs > 0 || totalAllJobs > 0) && (
        <div className="p-4 rounded-xl border border-[var(--color-border-light)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📊</span>
            <span className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Hiring Pulse</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)]">
              <span className="text-lg font-bold text-[var(--color-primary)]">{totalAllJobs}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">Active Roles</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)]">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{strongMatchCount}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">Strong Matches</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)]">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalReferrers}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">Insider Referrers</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)]">
              <span className="text-lg font-bold text-[var(--color-text)]">{allCompanies.length}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">Companies</span>
            </div>
          </div>
        </div>
      )}

      {/* 📋 Application Pipeline Tracker */}
      <ApplicationPipeline />

      {/* Bio Digest (Minimal Header) */}
      <div className="flex flex-col gap-4">
        {profileDigest && showSummary && (
          <div className="p-3.5 rounded-lg bg-surface-elevated/40 border border-border/50 text-caption flex flex-col gap-2 animate-fadeIn relative">
            <button 
              className="absolute top-2 right-2 text-text-tertiary hover:text-text"
              onClick={() => setShowSummary(false)}
              title="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div>
              <span className="font-semibold text-text-secondary uppercase tracking-wider text-[10px]">Candidate Profile Summary</span>
              <p className="text-text mt-0.5">{profileDigest.summary || "No summary generated yet"}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {profileDigest.skills?.map((s, idx) => (
                <span key={idx} className="badge bg-primary/10 text-primary border border-primary/20 text-[10px] px-2 font-medium">
                  {s}
                </span>
              ))}
              {profileDigest.experienceYears !== undefined && (
                <span className="badge bg-accent/10 text-accent border border-accent/20 text-[10px] px-2 font-medium">
                  {profileDigest.experienceYears} Years Exp
                </span>
              )}
            </div>
          </div>
        )}
      </div>

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
        <div className="space-y-3">
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
                        <h4 className="font-semibold text-sm text-[var(--color-text)] m-0 leading-snug">{job.title}</h4>
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
    </div>
  );
}
