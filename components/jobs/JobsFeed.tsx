"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { JobDetailSheet, JobItem } from "./JobDetailSheet";
import { detectFunctionalDiscipline, relateDisciplines, FunctionalDiscipline } from "@/lib/jobs/discipline";
import { computeSkillAlignment } from "@/lib/jobs/skill-matching";

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

  // Close job detail modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedJob(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Flatten all jobs across all companies, compute match rate, and sort by matchRate descending
  const allMatchedJobs = useMemo(() => {
    const list: JobItem[] = [];
    const candidateContext = {
      profile_digest: { skills: userSkills },
      job_title: userJobTitle,
    };

    for (const comp of allCompanies) {
      if (!comp.jobs || comp.jobs.length === 0) continue;

      for (const j of comp.jobs) {
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

        list.push({
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
    }

    // Sort all individual jobs strictly by top matchRate descending
    return list.sort((a, b) => b.matchRate - a.matchRate);
  }, [allCompanies, userDiscipline, userSkills, userJobTitle]);

  // Compute total individual jobs count
  const totalOpeningsCount = useMemo(() => {
    return allMatchedJobs.length;
  }, [allMatchedJobs]);

  // Apply search query and location filter across individual matched jobs
  const filteredJobs = useMemo(() => {
    let result = allMatchedJobs;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      result = result.filter(
        (j) =>
          j.company.toLowerCase().includes(q) ||
          j.title.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }

    if (selectedLocation !== "all") {
      const locMatch = selectedLocation.toLowerCase();
      result = result.filter((j) => j.location.toLowerCase().includes(locMatch));
    }

    return result;
  }, [allMatchedJobs, searchQuery, selectedLocation]);

  // Paginated jobs: first 30, then +20 each time
  const displayedJobs = useMemo(() => {
    return filteredJobs.slice(0, visibleCount);
  }, [filteredJobs, visibleCount]);

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
              {totalOpeningsCount > 0 ? `${totalOpeningsCount.toLocaleString()} Openings` : "Live Feed"}
            </span>
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
            Top matched tech opportunities sorted by relevance to your profile.
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
            placeholder="Search 7,000+ jobs by company, role, or skill..."
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
      {!loading && filteredJobs.length === 0 && (
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

      {/* Matched Jobs Feed - Format: company-logo, company name, position */}
      {!loading && displayedJobs.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayedJobs.map((job) => {
            const matchColor =
              job.matchRate >= 80
                ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                : job.matchRate >= 60
                ? "text-blue-500 bg-blue-500/10 border-blue-500/30"
                : job.matchRate >= 45
                ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
                : "text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)] border-[var(--color-border-light)]";

            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="group p-3.5 sm:p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:scale-[0.995]"
              >
                {/* Left: Company Logo, Company Name, Position */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Company Logo */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <CompanyLogo company={job.company} className="w-9 h-9 object-contain" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Header: Company Name — Position */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-sm sm:text-base font-bold text-[var(--color-text)]">
                        {job.company}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)] font-bold">—</span>
                      <span className="text-sm sm:text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors truncate">
                        {job.title}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${matchColor}`}>
                        {job.matchRate < 40
                          ? `${job.matchRate}% • Different Track`
                          : `${job.matchRate}% Match`}
                      </span>
                      {job.matchedSkills && job.matchedSkills.length > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ✓ {job.matchedSkills.length} skill{job.matchedSkills.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Metadata line: Location, Experience, Posted Age, Neighbors */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-tertiary)] mt-1">
                      <span className="font-medium text-[var(--color-text-secondary)]">{job.location}</span>
                      <span>&bull;</span>
                      <span>{job.experience}</span>
                      <span>&bull;</span>
                      <span>{job.posted_at}</span>
                      {job.contactsCount && job.contactsCount > 0 ? (
                        <>
                          <span>&bull;</span>
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            🤝 {job.contactsCount} neighbor{job.contactsCount > 1 ? "s" : ""}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right: Match Score Badge & Arrow */}
                <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${matchColor}`}>
                    {job.matchRate}%
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

      {/* Pagination: Load 20 More Opportunities */}
      {!loading && visibleCount < filteredJobs.length && (
        <div className="flex flex-col items-center justify-center gap-2 pt-4 pb-8">
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary)] transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>Load 20 More Opportunities</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              ({displayedJobs.length} of {filteredJobs.length.toLocaleString()})
            </span>
          </button>
        </div>
      )}

      {/* Floating Opportunity Detail Modal (not full screen, top notification bell remains visible) */}
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
