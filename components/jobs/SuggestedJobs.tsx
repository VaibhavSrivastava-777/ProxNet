"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { ResumeCard } from "./ResumeCard";

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
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache");
      if (cached) return JSON.parse(cached).companies || [];
    } catch {
      // ignore
    }
    return [];
  });
  const [allCompanies, setAllCompanies] = useState<CompanyGroup[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = sessionStorage.getItem("proxnet_all_jobs_cache");
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
      const cached = sessionStorage.getItem("proxnet_suggested_jobs_cache");
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
  const [isMatchingCompleted, setIsMatchingCompleted] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(true);
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [suggestedRes, allRes] = await Promise.allSettled([
        fetch("/api/jobs/suggested").then(r => r.ok ? r.json() : null),
        fetch("/api/jobs/all").then(r => r.ok ? r.json() : null),
      ]);

      if (suggestedRes.status === "fulfilled" && suggestedRes.value) {
        const data = suggestedRes.value;
        setCompanies(data.companies || []);
        setIsMatchingCompleted(data.isMatchingCompleted ?? true);
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
          sessionStorage.setItem("proxnet_suggested_jobs_cache", JSON.stringify({
            companies: data.companies || [],
            profileDigest: data.profileDigest || null,
            hasResume: data.hasResume ?? true,
            resumeUrl: data.resumeUrl || null,
            wallet: data.wallet ?? 0,
          }));
        } catch {
          // ignore
        }
      }

      if (allRes.status === "fulfilled" && allRes.value) {
        const allData = allRes.value;
        setAllCompanies(allData.companies || []);
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
          sessionStorage.setItem("proxnet_all_jobs_cache", JSON.stringify({
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

      setCompanies(prev => prev.map(c => ({
        ...c,
        jobs: c.jobs.map(updateJob)
      })));

      setAllCompanies(prev => prev.map(c => ({
        ...c,
        jobs: c.jobs.map(updateJob)
      })));

      setActiveCompanyModal(prev => {
        if (!prev) return null;
        return {
          ...prev,
          jobs: prev.jobs.map(updateJob)
        };
      });
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

  // Filter companies/jobs by search query
  const q = searchQuery.toLowerCase().trim();
  const filteredMatchedCompanies = companies.filter(c => {
    if (!q) return true;
    return (
      c.company.toLowerCase().includes(q) ||
      c.jobs.some(j => j.title.toLowerCase().includes(q) || (j.keywords && j.keywords.some(k => k.toLowerCase().includes(q))))
    );
  });

  const filteredAllCompanies = allCompanies.filter(c => {
    if (!q) return true;
    return (
      c.company.toLowerCase().includes(q) ||
      c.jobs.some(j => j.title.toLowerCase().includes(q) || (j.keywords && j.keywords.some(k => k.toLowerCase().includes(q))))
    );
  });

  const displayedCompanies = jobsViewMode === "matched" ? filteredMatchedCompanies : filteredAllCompanies;
  const totalAllJobs = allCompanies.reduce((acc, c) => acc + c.jobs.length, 0);
  const totalMatchedJobs = companies.reduce((acc, c) => acc + c.jobs.length, 0);

  return (
    <div className="space-y-4 stagger-children max-w-3xl mx-auto pb-8">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">
          {errorMsg}
        </div>
      )}

      {/* Default/Prominent Message */}
      {!isMatchingCompleted && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-center animate-pulse">
          ℹ️ GENERATING THE LATEST MATCH LIST IN THE BACKGROUD
        </div>
      )}

      {/* Resume Management & Automated Job Alerts Card */}
      <ResumeCard
        hasResume={hasResume}
        resumeUrl={resumeUrl}
        onResumeUpdated={loadData}
      />

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
              <div className="flex items-center gap-3 min-w-0">
                <CompanyLogo company={group.company} size={40} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-[var(--color-text)] truncate">
                    {group.company}
                  </span>
                  <button
                    onClick={() => setActiveCompanyModal(group)}
                    className="text-left text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer border-none bg-transparent p-0 mt-0.5"
                  >
                    📂 {group.jobs.length} Opening{group.jobs.length > 1 ? "s" : ""} Available
                  </button>
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
                    <span>🤝</span> {group.contactsCount} Referrar{group.contactsCount > 1 ? "s" : ""} Available
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveCompanyModal(group)}
                    className="btn btn-sm bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border-light)] text-[var(--color-text)] text-xs cursor-pointer font-bold px-3 py-1.5 rounded-lg border border-[var(--color-border-light)] flex items-center gap-1.5"
                  >
                    <span>📂</span> View {group.jobs.length} Opening{group.jobs.length > 1 ? "s" : ""}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setActiveCompanyModal(null)}
        >
          <div 
            className="bg-[var(--color-surface)] w-full max-w-lg rounded-xl shadow-xl border border-[var(--color-border)] p-6 animate-scaleIn flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-[var(--color-border-light)] pb-2">
              <h3 className="text-h3 font-bold text-text m-0">Openings at {activeCompanyModal.company}</h3>
              <button 
                onClick={() => setActiveCompanyModal(null)} 
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border-0 bg-transparent text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
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
                          <span>📅 {new Date(job.posted_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {cleanDirectUrl && (
                        <a 
                          href={cleanDirectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-primary mt-1 text-center text-xs block py-1.5 no-underline font-semibold"
                        >
                          Apply on Career Website
                        </a>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
