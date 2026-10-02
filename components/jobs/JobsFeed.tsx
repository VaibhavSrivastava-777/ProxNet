"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { JobDetailSheet, JobItem } from "./JobDetailSheet";

interface RawCompanyData {
  company: string;
  contactsCount: number;
  referralContacts: Array<{ id: string; alias: string; is_followed?: boolean }>;
  jobs: Array<{
    id: string;
    title: string;
    location: string;
    url: string;
    description: string;
    posted_at: string;
    keywords?: string[];
  }>;
}

export interface CompanyJobGroup {
  company: string;
  topJob: JobItem;
  otherJobs: JobItem[];
  allJobs: JobItem[];
  totalJobsCount: number;
  contactsCount: number;
  referralContacts: Array<{ id: string; alias: string; is_followed?: boolean }>;
}

function extractExperience(title: string, desc: string): string {
  const text = (title + " " + (desc || "")).toLowerCase();
  if (text.includes("intern") || text.includes("trainee") || text.includes("entry level")) return "0–1 yrs (Entry)";
  if (text.includes("principal") || text.includes("director") || text.includes("vp ") || text.includes("head of")) return "10+ yrs (Exec)";
  if (text.includes("staff") || text.includes("lead") || text.includes("architect")) return "7–10 yrs (Lead)";
  if (text.includes("senior") || text.includes("sr.") || text.includes("sr ")) return "4–7 yrs (Senior)";
  
  const match = text.match(/(\d+)\s*(?:-|to|\+)\s*(\d+)?\s*years?/);
  if (match) {
    if (match[2]) return `${match[1]}–${match[2]} yrs`;
    return `${match[1]}+ yrs`;
  }
  return "2–5 yrs";
}

function formatAge(postedAt: string | undefined): string {
  if (!postedAt) return "Recently";
  const date = new Date(postedAt);
  if (isNaN(date.getTime())) return "Recently";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  return "1mo ago";
}

// Client-side module memory cache for instant tab switching
let memoryFeedCompanies: RawCompanyData[] = [];
let memoryFeedWallet: number = 0;
let memoryFeedLoaded = false;

export function JobsFeed() {
  const [loading, setLoading] = useState(!memoryFeedLoaded);
  const [error, setError] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<RawCompanyData[]>(memoryFeedCompanies);
  const [userWallet, setUserWallet] = useState(memoryFeedWallet);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  
  // Paging state: first 25 companies, then +10 each time
  const [visibleCount, setVisibleCount] = useState(25);
  
  // Drawer state for inspecting/preparing a job
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);

  // Modal state for viewing other jobs of a company
  const [modalCompanyGroup, setModalCompanyGroup] = useState<CompanyJobGroup | null>(null);

  // Load all ~7k scraped jobs grouped by company with stale-while-revalidate
  const loadJobs = useCallback(async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner || !memoryFeedLoaded) {
        setLoading(true);
      }
      const res = await fetch("/api/jobs/all");
      if (!res.ok) throw new Error("Failed to load live jobs feed");
      const data = await res.json();
      const comps = data.companies || [];
      const wallet = data.wallet ?? 0;

      memoryFeedCompanies = comps;
      memoryFeedWallet = wallet;
      memoryFeedLoaded = true;

      setAllCompanies(comps);
      setUserWallet(wallet);
      setError(null);
    } catch (err: any) {
      console.error("Error loading all jobs:", err);
      if (!memoryFeedLoaded) {
        setError(err.message || "Failed to load opportunities.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If not loaded yet, fetch with loading indicator; otherwise revalidate quietly in background
    loadJobs(!memoryFeedLoaded);
  }, [loadJobs]);

  // Sync wallet balance updates across tabs
  useEffect(() => {
    const handleWalletUpdated = (e: Event) => {
      const customDetail = (e as CustomEvent).detail;
      if (customDetail && typeof customDetail.newBalance === "number") {
        setUserWallet(customDetail.newBalance);
      }
    };
    window.addEventListener("proxnet:wallet-updated", handleWalletUpdated);
    return () => window.removeEventListener("proxnet:wallet-updated", handleWalletUpdated);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalCompanyGroup(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Group jobs by company, sort company's jobs by match rate, and sort company groups by topJob.matchRate
  const companyGroups = useMemo(() => {
    const groups: CompanyJobGroup[] = [];

    for (const comp of allCompanies) {
      if (!comp.jobs || comp.jobs.length === 0) continue;

      const companyJobs: JobItem[] = comp.jobs.map((j) => {
        let baseScore = 78;
        if (comp.contactsCount > 0) baseScore += 8;
        if (j.keywords && j.keywords.length > 2) baseScore += 5;
        if (j.description && j.description.length > 500) baseScore += 4;
        const matchRate = Math.min(97, baseScore);

        return {
          id: j.id,
          title: j.title,
          company: comp.company,
          location: j.location || "Remote / India",
          url: j.url,
          description: j.description || "",
          posted_at: formatAge(j.posted_at),
          experience: extractExperience(j.title, j.description),
          matchRate,
          keywords: j.keywords || [],
          contactsCount: comp.contactsCount,
          referralContacts: comp.referralContacts,
        };
      });

      // Sort jobs within company by matchRate descending
      companyJobs.sort((a, b) => b.matchRate - a.matchRate);

      const topJob = companyJobs[0];
      const otherJobs = companyJobs.slice(1);

      groups.push({
        company: comp.company,
        topJob,
        otherJobs,
        allJobs: companyJobs,
        totalJobsCount: companyJobs.length,
        contactsCount: comp.contactsCount,
        referralContacts: comp.referralContacts,
      });
    }

    // Sort company groups by topJob.matchRate descending
    return groups.sort((a, b) => b.topJob.matchRate - a.topJob.matchRate);
  }, [allCompanies]);

  // Compute total individual jobs count
  const totalOpeningsCount = useMemo(() => {
    return allCompanies.reduce((acc, c) => acc + (c.jobs?.length || 0), 0);
  }, [allCompanies]);

  // Apply search query and location filter across company groups
  const filteredCompanyGroups = useMemo(() => {
    let result = companyGroups;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter((g) => {
        const matchesComp = g.company.toLowerCase().includes(q);
        const matchesJob = g.allJobs.some(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.location.toLowerCase().includes(q) ||
            j.keywords?.some((k) => k.toLowerCase().includes(q))
        );
        return matchesComp || matchesJob;
      });
    }

    if (selectedLocation !== "all") {
      const locMatch = selectedLocation.toLowerCase();
      result = result.filter((g) =>
        g.allJobs.some((j) => j.location.toLowerCase().includes(locMatch))
      );
    }

    return result;
  }, [companyGroups, searchQuery, selectedLocation]);

  // Paginated company groups: first 25, then +10
  const displayedGroups = useMemo(() => {
    return filteredCompanyGroups.slice(0, visibleCount);
  }, [filteredCompanyGroups, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Header & Hero Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--color-border-light)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight m-0 flex items-center gap-2">
            <span>Opportunity Radar</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
              {totalOpeningsCount > 0 ? `${totalOpeningsCount.toLocaleString()} Openings` : "Live Feed"}
            </span>
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
            Grouped by verified enterprise company boards & sorted by top match rates.
          </p>
        </div>

        {/* User Credits Pill */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] shadow-sm">
            <span className="text-amber-500">⚡</span>
            <span>{userWallet} Credits</span>
          </div>
        </div>
      </div>

      {/* Search and Quick Location Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(25);
            }}
            placeholder="Search 7,000+ jobs by company, role, or skill..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)] transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setVisibleCount(25);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] border-none bg-transparent cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Location selector pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All" },
            { id: "remote", label: "Remote" },
            { id: "bengaluru", label: "Bengaluru" },
            { id: "hyderabad", label: "Hyderabad" },
            { id: "pune", label: "Pune" },
            { id: "delhi", label: "NCR" },
          ].map((loc) => (
            <button
              key={loc.id}
              onClick={() => {
                setSelectedLocation(loc.id);
                setVisibleCount(25);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                selectedLocation === loc.id
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && allCompanies.length === 0 && (
        <div className="flex flex-col gap-3 py-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-[var(--color-surface-secondary)]/60 animate-pulse border border-[var(--color-border-light)]"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={() => loadJobs(true)}
            className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-xs border-none cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Zero matches state */}
      {!loading && filteredCompanyGroups.length === 0 && (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)]/20">
          <span className="text-3xl mb-2 block">🔍</span>
          <h3 className="text-sm font-bold text-[var(--color-text)]">No matching job opportunities</h3>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search keywords or switching location filters to see more opportunities.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedLocation("all");
              setVisibleCount(25);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all cursor-pointer border-none"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Company Grouped Jobs Feed */}
      {!loading && displayedGroups.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayedGroups.map((group) => {
            const topJob = group.topJob;
            const matchColor =
              topJob.matchRate >= 90
                ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                : topJob.matchRate >= 75
                ? "text-blue-500 bg-blue-500/10 border-blue-500/30"
                : "text-amber-500 bg-amber-500/10 border-amber-500/30";

            return (
              <div
                key={group.company}
                onClick={() => setSelectedJob(topJob)}
                className="group p-3.5 sm:p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:scale-[0.995]"
              >
                {/* Left: Company Logo + Top Job Title + Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <CompanyLogo company={group.company} className="w-9 h-9 object-contain" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Header: Company - Top Job Title (Match %) */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-sm sm:text-base font-bold text-[var(--color-text)]">
                        {group.company}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)] font-bold">—</span>
                      <span className="text-sm sm:text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors truncate">
                        {topJob.title}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        ({topJob.matchRate}% Match)
                      </span>
                    </div>

                    {/* Metadata line: Location, Experience, Age, Neighbors */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-tertiary)] mt-1">
                      <span className="font-medium text-[var(--color-text-secondary)]">{topJob.location}</span>
                      <span>&bull;</span>
                      <span>{topJob.experience}</span>
                      <span>&bull;</span>
                      <span>{topJob.posted_at}</span>
                      {group.contactsCount > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            🤝 {group.contactsCount} neighbor{group.contactsCount > 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: "and X others..." Modal Trigger + Match Badge + Arrow */}
                <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                  {group.otherJobs.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalCompanyGroup(group);
                      }}
                      className="px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                      title={`View ${group.otherJobs.length} more roles at ${group.company}`}
                    >
                      <span>& {group.otherJobs.length} other{group.otherJobs.length > 1 ? "s" : ""}</span>
                      <svg className="w-3 h-3 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${matchColor}`}>
                    {topJob.matchRate}%
                  </span>

                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] group-hover:bg-[var(--color-primary-subtle)] transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination: Load 10 More Button */}
      {!loading && visibleCount < filteredCompanyGroups.length && (
        <div className="flex flex-col items-center justify-center gap-2 pt-4 pb-8">
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)] transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>Load 10 More Companies</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              ({displayedGroups.length} of {filteredCompanyGroups.length.toLocaleString()})
            </span>
          </button>
        </div>
      )}

      {/* Modal for viewing all other jobs of a company */}
      {modalCompanyGroup && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          onClick={() => setModalCompanyGroup(null)}
        >
          <div 
            className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with High-Visibility Top 'X' Close Button */}
            <div className="sticky top-0 z-10 px-5 py-4 bg-[var(--color-surface)] border-b border-[var(--color-border-light)] flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center">
                  <CompanyLogo company={modalCompanyGroup.company} className="w-8 h-8 object-contain" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] m-0 truncate">
                    {modalCompanyGroup.company}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
                    Showing all {modalCompanyGroup.totalJobsCount} open positions
                  </p>
                </div>
              </div>

              {/* CLEARLY VISIBLE TOP 'X' CLOSE BUTTON */}
              <button
                type="button"
                onClick={() => setModalCompanyGroup(null)}
                className="w-9 h-9 rounded-full bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors flex items-center justify-center border border-[var(--color-border)] cursor-pointer shrink-0 shadow-xs active:scale-95"
                aria-label="Close other jobs modal"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body: Top Job Highlight + Other Jobs List */}
            <div className="p-4 sm:p-5 flex flex-col gap-3 overflow-y-auto flex-1">
              {/* Top Job Highlight */}
              <div
                onClick={() => {
                  setSelectedJob(modalCompanyGroup.topJob);
                  setModalCompanyGroup(null);
                }}
                className="p-3.5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
                      ⭐ Top Match
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {modalCompanyGroup.topJob.matchRate}% Match
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0 mt-1 truncate">
                    {modalCompanyGroup.topJob.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)] mt-1">
                    <span>{modalCompanyGroup.topJob.location}</span>
                    <span>&bull;</span>
                    <span>{modalCompanyGroup.topJob.experience}</span>
                    <span>&bull;</span>
                    <span>{modalCompanyGroup.topJob.posted_at}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 text-white border-none cursor-pointer self-start sm:self-center shrink-0 shadow-xs"
                >
                  View & Prepare ➔
                </button>
              </div>

              {/* Other Jobs Section Header */}
              {modalCompanyGroup.otherJobs.length > 0 && (
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1 mt-2">
                  Other Open Roles ({modalCompanyGroup.otherJobs.length})
                </div>
              )}

              {/* Other Jobs List */}
              {modalCompanyGroup.otherJobs.map((job) => {
                const matchBadgeColor =
                  job.matchRate >= 90
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                    : job.matchRate >= 75
                    ? "text-blue-500 bg-blue-500/10 border-blue-500/30"
                    : "text-amber-500 bg-amber-500/10 border-amber-500/30";

                return (
                  <div
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job);
                      setModalCompanyGroup(null);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${matchBadgeColor}`}>
                          {job.matchRate}% Match
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {job.posted_at}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--color-text)] m-0 mt-1 truncate">
                        {job.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)] mt-1">
                        <span>{job.location}</span>
                        <span>&bull;</span>
                        <span>{job.experience}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:text-[var(--color-primary)] border border-[var(--color-border-light)] cursor-pointer self-start sm:self-center shrink-0"
                    >
                      View Details ➔
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-[var(--color-surface-secondary)]/50 border-t border-[var(--color-border-light)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>Select any role to view ATS job details or prepare.</span>
              <button
                type="button"
                onClick={() => setModalCompanyGroup(null)}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Opportunity Detail Drawer */}
      <JobDetailSheet
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        userWallet={userWallet}
        onWalletUpdated={(newBal) => setUserWallet(newBal)}
      />
    </div>
  );
}
