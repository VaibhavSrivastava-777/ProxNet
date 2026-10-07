"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { JobDetailSheet, JobItem } from "./JobDetailSheet";
import { detectFunctionalDiscipline, relateDisciplines, FunctionalDiscipline } from "@/lib/jobs/discipline";
import { computeSkillAlignment } from "@/lib/jobs/skill-matching";
import { isIndiaLocation } from "@/lib/jobs/job-filters";

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
let memoryFeedSkills: string[] = [];
let memoryFeedJobTitle: string = "";
let memoryFeedLoaded = false;

export function JobsFeed() {
  const [loading, setLoading] = useState(!memoryFeedLoaded);
  const [error, setError] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<RawCompanyData[]>(memoryFeedCompanies);
  const [userWallet, setUserWallet] = useState(memoryFeedWallet);
  const [userDiscipline, setUserDiscipline] = useState<string>("operations_general");
  const [userSkills, setUserSkills] = useState<string[]>(memoryFeedSkills);
  const [userJobTitle, setUserJobTitle] = useState<string>(memoryFeedJobTitle);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  
  // Paging state: first 30 opportunities, then +20 each time
  const [visibleCount, setVisibleCount] = useState(30);
  
  // Modal state for inspecting/preparing a job
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  // Modal state for viewing all openings of a company
  const [activeCompanyModal, setActiveCompanyModal] = useState<CompanyJobGroup | null>(null);

  // Load all ~7k scraped jobs with stale-while-revalidate
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
      const skills = data.userSkills || [];
      const jobTitle = data.userJobTitle || "";

      memoryFeedCompanies = comps;
      memoryFeedWallet = wallet;
      memoryFeedSkills = skills;
      memoryFeedJobTitle = jobTitle;
      memoryFeedLoaded = true;

      setAllCompanies(comps);
      setUserWallet(wallet);
      setUserDiscipline(data.userDiscipline || "operations_general");
      setUserSkills(skills);
      setUserJobTitle(jobTitle);
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

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedJob) {
          setSelectedJob(null);
        } else if (activeCompanyModal) {
          setActiveCompanyModal(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedJob, activeCompanyModal]);

  // Group jobs by company, sort jobs descending by matchRate, and sort companies by top matchRate
  const allCompanyGroups = useMemo(() => {
    const groups: CompanyJobGroup[] = [];
    const candidateContext = {
      profile_digest: { skills: userSkills },
      job_title: userJobTitle,
    };

    for (const comp of allCompanies) {
      if (!comp.jobs || comp.jobs.length === 0) continue;

      const companyJobs: JobItem[] = [];

      for (const j of comp.jobs) {
        if (!isIndiaLocation(j.location, j.description, j.title)) continue;
        const jobDisc = detectFunctionalDiscipline(j.title, j.description);
        const skillAlign = computeSkillAlignment(candidateContext, j);
        let matchRate = 50;

        if (userDiscipline && userDiscipline !== "operations_general") {
          const relation = relateDisciplines(userDiscipline as FunctionalDiscipline, jobDisc);
          if (relation === "same") {
            const coverageBonus = Math.round(skillAlign.coveragePercent * 0.22);
            matchRate = 70 + coverageBonus;
            if (comp.contactsCount > 0) matchRate += 3;
            matchRate = Math.min(96, matchRate);
          } else if (relation === "adjacent") {
            const coverageBonus = Math.round(skillAlign.coveragePercent * 0.18);
            matchRate = 50 + coverageBonus;
            if (comp.contactsCount > 0) matchRate += 3;
            matchRate = Math.min(74, matchRate);
          } else if (relation === "incompatible") {
            matchRate = 25;
          }
        } else {
          const coverageBonus = Math.round(skillAlign.coveragePercent * 0.20);
          matchRate = 50 + coverageBonus;
          if (comp.contactsCount > 0) matchRate += 4;
        }

        companyJobs.push({
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
          matchedSkills: skillAlign.matchedSkills,
          missingSkills: skillAlign.missingSkills,
          skillCoveragePercent: skillAlign.coveragePercent,
        });
      }

      if (companyJobs.length > 0) {
        // Sort jobs within company descending by matchRate
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
    }

    // Sort company groups strictly by top matchRate descending (e.g. Wipro 90% before Dell 85%)
    return groups.sort((a, b) => {
      const topDiff = b.topJob.matchRate - a.topJob.matchRate;
      if (topDiff !== 0) return topDiff;
      if (b.totalJobsCount !== a.totalJobsCount) return b.totalJobsCount - a.totalJobsCount;
      return a.company.localeCompare(b.company);
    });
  }, [allCompanies, userDiscipline, userSkills, userJobTitle]);

  // Compute total individual jobs count
  const totalOpeningsCount = useMemo(() => {
    return allCompanyGroups.reduce((acc, g) => acc + g.totalJobsCount, 0);
  }, [allCompanyGroups]);

  // Apply search query and location filter across company groups
  const filteredCompanyGroups = useMemo(() => {
    let result = allCompanyGroups;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result
        .map((g) => {
          const companyMatches = g.company.toLowerCase().includes(q);
          if (companyMatches) return g;
          // Filter matching jobs inside group
          const matchedJobs = g.allJobs.filter(
            (j) =>
              j.title.toLowerCase().includes(q) ||
              j.location.toLowerCase().includes(q) ||
              j.keywords?.some((k) => k.toLowerCase().includes(q))
          );
          if (matchedJobs.length === 0) return null;
          return {
            ...g,
            topJob: matchedJobs[0],
            otherJobs: matchedJobs.slice(1),
            allJobs: matchedJobs,
            totalJobsCount: matchedJobs.length,
          };
        })
        .filter(Boolean) as CompanyJobGroup[];
    }

    if (selectedLocation !== "all") {
      const locMatch = selectedLocation.toLowerCase();
      result = result
        .map((g) => {
          const matchedJobs = g.allJobs.filter((j) => j.location.toLowerCase().includes(locMatch));
          if (matchedJobs.length === 0) return null;
          return {
            ...g,
            topJob: matchedJobs[0],
            otherJobs: matchedJobs.slice(1),
            allJobs: matchedJobs,
            totalJobsCount: matchedJobs.length,
          };
        })
        .filter(Boolean) as CompanyJobGroup[];
    }

    return result;
  }, [allCompanyGroups, searchQuery, selectedLocation]);

  // Paginated company groups: first 30, then +20 each time
  const displayedGroups = useMemo(() => {
    return filteredCompanyGroups.slice(0, visibleCount);
  }, [filteredCompanyGroups, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 20);
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Header & Hero Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--color-border-light)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight m-0 flex items-center gap-2">
            <span>Opportunity Radar</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
              {totalOpeningsCount > 0 ? `${totalOpeningsCount.toLocaleString()} Openings across ${allCompanyGroups.length} Companies` : "Live Feed"}
            </span>
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
            Job opportunities grouped by company with the top matched role shown at the top.
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
              setVisibleCount(30);
            }}
            placeholder="Search jobs by company, role, or skill..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)] transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setVisibleCount(30);
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
                setVisibleCount(30);
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
              className="h-28 rounded-2xl bg-[var(--color-surface-secondary)]/60 animate-pulse border border-[var(--color-border-light)]"
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
              setVisibleCount(30);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all cursor-pointer border-none"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Company-Grouped Jobs Feed */}
      {!loading && displayedGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          {displayedGroups.map((group) => {
            const topMatchColor =
              group.topJob.matchRate >= 80
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : group.topJob.matchRate >= 60
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";

            return (
              <div
                key={group.company}
                className="group p-4 sm:p-5 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 hover:shadow-md transition-all flex flex-col gap-3.5 shadow-2xs"
              >
                {/* 1. Header: Company Info + Openings count + Neighbors */}
                <div className="flex items-center justify-between gap-3">
                  <div 
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => setActiveCompanyModal(group)}
                    title={`Click to view all ${group.company} openings`}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-xs">
                      <CompanyLogo company={group.company} className="w-9 h-9 object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-bold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors truncate">
                          {group.company}
                        </span>
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${topMatchColor}`}>
                          <span>{group.topJob.matchRate >= 80 ? "🔥" : "✨"}</span>
                          <span>{group.topJob.matchRate}% Match</span>
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-2">
                        <span>📂 {group.totalJobsCount} Opening{group.totalJobsCount > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {group.contactsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        <span>🤝</span>
                        <span>{group.contactsCount} neighbor{group.contactsCount > 1 ? "s" : ""}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        <span>🏆</span>
                        <span className="hidden sm:inline">Pioneer</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Top Matched Opportunity Spotlight */}
                <div
                  onClick={() => setSelectedJob(group.topJob)}
                  className="p-3.5 rounded-xl bg-[var(--color-surface-secondary)]/70 hover:bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] transition-all cursor-pointer flex flex-col gap-2 group/spotlight"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                          Top Matched Opportunity
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {group.topJob.matchRate}% Fit
                        </span>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-[var(--color-text)] group-hover/spotlight:text-[var(--color-primary)] transition-colors leading-snug m-0">
                        {group.topJob.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)] mt-1.5">
                        <span>📍 {group.topJob.location}</span>
                        <span>&bull;</span>
                        <span>💼 {group.topJob.experience}</span>
                        <span>&bull;</span>
                        <span>🕒 {group.topJob.posted_at}</span>
                      </div>
                      {group.topJob.matchedSkills && group.topJob.matchedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {group.topJob.matchedSkills.slice(0, 4).map((skill, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                            >
                              ✓ {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-xs flex items-center gap-1">
                        <span>View Details</span>
                        <span>→</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Sub-footer: Link to view other opportunities in modal */}
                <div className="pt-2 border-t border-[var(--color-border-light)]/60 flex items-center justify-between text-xs">
                  {group.otherJobs.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setActiveCompanyModal(group)}
                      className="font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 transition-colors"
                      title="Click to view all opportunities for this company in modal"
                    >
                      <span>📂</span>
                      <span>
                        +{group.otherJobs.length} other opportunit{group.otherJobs.length > 1 ? "ies" : "y"}{" "}
                        <span className="text-[var(--color-text-secondary)] font-normal">
                          (and others on click in a modal)
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Top opportunity currently available
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveCompanyModal(group)}
                    className="text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 transition-colors shrink-0 ml-auto"
                  >
                    <span>View All ({group.totalJobsCount})</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination: Load 20 More Companies */}
      {!loading && visibleCount < filteredCompanyGroups.length && (
        <div className="flex flex-col items-center justify-center gap-2 pt-4 pb-8">
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)] transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>Load 20 More Companies</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              ({displayedGroups.length} of {filteredCompanyGroups.length.toLocaleString()})
            </span>
          </button>
        </div>
      )}

      {/* Company Openings Modal (Safe area padding, never-truncated top "X" close button) */}
      {activeCompanyModal && (
        <div
          className="fixed inset-0 z-[100000] flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-6 overflow-y-auto pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] bg-black/75 backdrop-blur-md animate-fadeIn"
          onClick={() => setActiveCompanyModal(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[calc(100dvh-3rem)] my-auto rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Company Name, Openings count, and PROMINENT Close "X" Button */}
            <div className="sticky top-0 z-50 shrink-0 bg-[var(--color-surface)]/98 backdrop-blur-md border-b border-[var(--color-border-light)] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-xs">
                  <CompanyLogo company={activeCompanyModal.company} className="w-8 h-8 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate m-0 flex items-center gap-2">
                    <span>{activeCompanyModal.company}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Top: {activeCompanyModal.topJob.matchRate}%
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
                    {activeCompanyModal.totalJobsCount} Open Position{activeCompanyModal.totalJobsCount > 1 ? "s" : ""} &bull; Sorted by Match Score
                  </p>
                </div>
              </div>

              {/* Close Button - Guaranteed Visible, Non-truncated, High Contrast */}
              <button
                type="button"
                onClick={() => setActiveCompanyModal(null)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] shadow-sm transition-all cursor-pointer shrink-0 hover:scale-105 active:scale-95"
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Body: All listings of this company */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col gap-3 overflow-y-auto overscroll-contain">
              {activeCompanyModal.allJobs.map((job, idx) => (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJob(job);
                  }}
                  className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 hover:bg-[var(--color-surface-secondary)] hover:border-[var(--color-primary)]/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {idx === 0 ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          🔥 Top Match • {job.matchRate}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          ✨ {job.matchRate}% Match
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm sm:text-base text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors m-0 leading-snug">
                      {job.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-secondary)] mt-1">
                      <span>📍 {job.location}</span>
                      <span>&bull;</span>
                      <span>💼 {job.experience}</span>
                      <span>&bull;</span>
                      <span>🕒 {job.posted_at}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all">
                      View Playbook →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Opportunity Detail Modal */}
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
