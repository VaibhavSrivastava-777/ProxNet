"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

export const LOCATION_OPTIONS = [
  { id: "all", label: "All Locations" },
  { id: "remote", label: "Remote / WFH" },
  { id: "bengaluru", label: "Bengaluru" },
  { id: "hyderabad", label: "Hyderabad" },
  { id: "pune", label: "Pune" },
  { id: "delhi_ncr", label: "Delhi / NCR" },
  { id: "mumbai", label: "Mumbai / MMR" },
  { id: "chennai", label: "Chennai" },
  { id: "kolkata", label: "Kolkata" },
  { id: "ahmedabad", label: "Ahmedabad" },
];

export const AGE_OPTIONS = [
  { id: "all", label: "All Time (Past 30d)" },
  { id: "24h", label: "Past 24 Hours" },
  { id: "3d", label: "Past 3 Days" },
  { id: "7d", label: "Past 7 Days" },
  { id: "14d", label: "Past 14 Days" },
  { id: "30d", label: "Past 30 Days" },
];

export const FUNCTION_OPTIONS = [
  { id: "all", label: "All Functions" },
  { id: "sales_marketing", label: "Sales & Marketing" },
  { id: "software_engineering", label: "Engineering" },
  { id: "data_ai", label: "Data & AI" },
  { id: "product_management", label: "Product Management" },
  { id: "operations", label: "Operations" },
  { id: "finance", label: "Finance & Accounting" },
  { id: "human_resources", label: "HR & Talent" },
  { id: "supply_chain", label: "Supply Chain" },
  { id: "design", label: "Design & UX" },
  { id: "consulting_strategy", label: "Strategy & Consulting" },
  { id: "legal", label: "Legal" },
];

const STORAGE_KEY = "proxnet_job_feed_filters";

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
let memoryFeedAppliedKeys: string[] = [];
let memoryFeedLoaded = false;

export function JobsFeed() {
  const [loading, setLoading] = useState(!memoryFeedLoaded);
  const [error, setError] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<RawCompanyData[]>(memoryFeedCompanies);
  const [userWallet, setUserWallet] = useState(memoryFeedWallet);
  const [userDiscipline, setUserDiscipline] = useState<string>("operations_general");
  const [userSkills, setUserSkills] = useState<string[]>(memoryFeedSkills);
  const [userJobTitle, setUserJobTitle] = useState<string>(memoryFeedJobTitle);
  const [appliedJobKeys, setAppliedJobKeys] = useState<Set<string>>(new Set(memoryFeedAppliedKeys));

  const [searchQuery, setSearchQuery] = useState("");

  // Persistent Dropdown Filters: Location, Age, Function, Keywords (multi-select, default 'all')
  const [selectedLocations, setSelectedLocations] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.locations) && parsed.locations.length > 0) return parsed.locations;
        }
      } catch {}
    }
    return ["all"];
  });

  const [selectedAge, setSelectedAge] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.age === "string" && parsed.age) return parsed.age;
          if (Array.isArray(parsed.ages) && parsed.ages.length > 0) return parsed.ages[0];
        }
      } catch {}
    }
    return "all";
  });

  const [selectedFunctions, setSelectedFunctions] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.functions) && parsed.functions.length > 0) return parsed.functions;
        }
      } catch {}
    }
    return ["all"];
  });

  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.keywords) && parsed.keywords.length > 0) return parsed.keywords;
        }
      } catch {}
    }
    return ["all"];
  });

  // Open dropdown tracker
  const [activeDropdown, setActiveDropdown] = useState<"location" | "age" | "function" | "keywords" | null>(null);
  const [keywordSearch, setKeywordSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Paging state: first 30 opportunities, then +20 each time
  const [visibleCount, setVisibleCount] = useState(30);

  // Modal state for inspecting/preparing a job
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  // Modal state for viewing all openings of a company
  const [activeCompanyModal, setActiveCompanyModal] = useState<CompanyJobGroup | null>(null);

  // Persist filter changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          locations: selectedLocations,
          age: selectedAge,
          ages: [selectedAge],
          functions: selectedFunctions,
          keywords: selectedKeywords,
        })
      );
    } catch {}
  }, [selectedLocations, selectedAge, selectedFunctions, selectedKeywords]);

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
      const appliedSigs: string[] = data.appliedSignatures || [];

      memoryFeedCompanies = comps;
      memoryFeedWallet = wallet;
      memoryFeedSkills = skills;
      memoryFeedJobTitle = jobTitle;
      memoryFeedAppliedKeys = appliedSigs;
      memoryFeedLoaded = true;

      setAllCompanies(comps);
      setUserWallet(wallet);
      setUserDiscipline(data.userDiscipline || "operations_general");
      setUserSkills(skills);
      setUserJobTitle(jobTitle);
      setAppliedJobKeys(new Set(appliedSigs));
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

  // Listen to application updates: immediately hide any applied/status-changed job for THIS user
  useEffect(() => {
    const handleJobApplicationUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setAppliedJobKeys((prev) => {
          const next = new Set(prev);
          if (detail.jobId) next.add(`id:${detail.jobId}`);
          if (detail.url) next.add(`url:${detail.url.toLowerCase().trim()}`);
          if (detail.company && detail.title) {
            next.add(`tc:${detail.company.toLowerCase().trim()}:::${detail.title.toLowerCase().trim()}`);
          }
          return next;
        });
      }
      // Quiet background refresh to keep server in sync
      loadJobs(false);
    };

    window.addEventListener("job_application_updated", handleJobApplicationUpdated);
    return () => window.removeEventListener("job_application_updated", handleJobApplicationUpdated);
  }, [loadJobs]);

  // Close modals & dropdowns on Escape key or outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeDropdown) {
          setActiveDropdown(null);
        } else if (selectedJob) {
          setSelectedJob(null);
        } else if (activeCompanyModal) {
          setActiveCompanyModal(null);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedJob, activeCompanyModal, activeDropdown]);

  // Dynamically extract top keywords from scraped jobs feed
  const availableKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comp of allCompanies) {
      for (const j of comp.jobs || []) {
        if (j.keywords && Array.isArray(j.keywords)) {
          for (const k of j.keywords) {
            const clean = k.trim();
            if (clean && clean.length > 1) {
              const proper = clean.charAt(0).toUpperCase() + clean.slice(1);
              counts.set(proper, (counts.get(proper) || 0) + 1);
            }
          }
        }
      }
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([kw]) => kw);

    const baseline = [
      "React", "Python", "Java", "AWS", "SQL", "TypeScript", "Node.js", "Docker",
      "Kubernetes", "AI / ML", "Product Management", "Sales", "Marketing", "Finance",
      "Customer Success", "Business Development", "Lead Generation", "Analytics"
    ];
    return Array.from(new Set([...sorted, ...baseline])).slice(0, 50);
  }, [allCompanies]);

  // Group jobs by company, exclude user's applied jobs, sort jobs descending by matchRate
  const allCompanyGroups = useMemo(() => {
    const groups: CompanyJobGroup[] = [];
    const candidateContext = {
      profile_digest: { skills: userSkills },
      job_title: userJobTitle,
    };

    for (const comp of allCompanies) {
      if (!comp.jobs || comp.jobs.length === 0) continue;

      const companyJobs: JobItem[] = [];
      const compLower = comp.company.trim().toLowerCase();

      for (const j of comp.jobs) {
        // Exclude India-disqualified jobs
        if (!isIndiaLocation(j.location, j.description, j.title)) continue;

        // Exclude opportunities this user has moved to Applied / changed status for
        const isApplied = (
          (j.id && appliedJobKeys.has(`id:${j.id}`)) ||
          (j.url && appliedJobKeys.has(`url:${j.url.toLowerCase().trim()}`)) ||
          appliedJobKeys.has(`tc:${compLower}:::${(j.title || "").toLowerCase().trim()}`)
        );
        if (isApplied) continue;

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
          raw_posted_at: j.posted_at,
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

    // Sort company groups strictly by top matchRate descending
    return groups.sort((a, b) => {
      const topDiff = b.topJob.matchRate - a.topJob.matchRate;
      if (topDiff !== 0) return topDiff;
      if (b.totalJobsCount !== a.totalJobsCount) return b.totalJobsCount - a.totalJobsCount;
      return a.company.localeCompare(b.company);
    });
  }, [allCompanies, userDiscipline, userSkills, userJobTitle, appliedJobKeys]);

  // Compute total individual jobs count
  const totalOpeningsCount = useMemo(() => {
    return allCompanyGroups.reduce((acc, g) => acc + g.totalJobsCount, 0);
  }, [allCompanyGroups]);

  // Multi-select toggle helper: manages "all" default state and individual item checkboxes
  const toggleFilter = (
    current: string[],
    setter: (val: string[]) => void,
    optionId: string
  ) => {
    if (optionId === "all") {
      setter(["all"]);
      setVisibleCount(30);
      return;
    }

    const withoutAll = current.filter((x) => x !== "all");
    let next: string[];
    if (withoutAll.includes(optionId)) {
      next = withoutAll.filter((x) => x !== optionId);
      if (next.length === 0) next = ["all"];
    } else {
      next = [...withoutAll, optionId];
    }
    setter(next);
    setVisibleCount(30);
  };

  // Clear all filters handler (reverts to 'all' default, resets search, removes localStorage)
  const handleClearFilters = useCallback(() => {
    setSelectedLocations(["all"]);
    setSelectedAge("all");
    setSelectedFunctions(["all"]);
    setSelectedKeywords(["all"]);
    setSearchQuery("");
    setVisibleCount(30);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const hasActiveFilters = useMemo(() => {
    const hasLoc = !selectedLocations.includes("all") && selectedLocations.length > 0;
    const hasAge = selectedAge !== "all";
    const hasFunc = !selectedFunctions.includes("all") && selectedFunctions.length > 0;
    const hasKw = !selectedKeywords.includes("all") && selectedKeywords.length > 0;
    const hasQuery = Boolean(searchQuery.trim());
    return hasLoc || hasAge || hasFunc || hasKw || hasQuery;
  }, [selectedLocations, selectedAge, selectedFunctions, selectedKeywords, searchQuery]);

  // Apply multi-select dropdown filters & search query
  const filteredCompanyGroups = useMemo(() => {
    let result = allCompanyGroups;
    const q = searchQuery.trim().toLowerCase();

    const isAllLoc = selectedLocations.includes("all") || selectedLocations.length === 0;
    const isAllFunc = selectedFunctions.includes("all") || selectedFunctions.length === 0;
    const isAllKw = selectedKeywords.includes("all") || selectedKeywords.length === 0;

    return result
      .map((g) => {
        const matchedJobs = g.allJobs.filter((j) => {
          // 1. Search Query
          if (q) {
            const matchesQ =
              g.company.toLowerCase().includes(q) ||
              j.title.toLowerCase().includes(q) ||
              j.location.toLowerCase().includes(q) ||
              j.keywords?.some((k) => k.toLowerCase().includes(q)) ||
              j.description.toLowerCase().includes(q);
            if (!matchesQ) return false;
          }

          // 2. Location (Multi-select)
          if (!isAllLoc) {
            const locText = (j.location || "").toLowerCase();
            const descText = (j.description || "").toLowerCase();
            const locMatches = selectedLocations.some((locId) => {
              if (locId === "remote") return locText.includes("remote") || descText.includes("work from home") || descText.includes("remote");
              if (locId === "bengaluru") return locText.includes("bengaluru") || locText.includes("bangalore");
              if (locId === "hyderabad") return locText.includes("hyderabad");
              if (locId === "pune") return locText.includes("pune");
              if (locId === "delhi_ncr") return locText.includes("delhi") || locText.includes("ncr") || locText.includes("gurgaon") || locText.includes("gurugram") || locText.includes("noida");
              if (locId === "mumbai") return locText.includes("mumbai") || locText.includes("navi mumbai") || locText.includes("thane");
              if (locId === "chennai") return locText.includes("chennai");
              if (locId === "kolkata") return locText.includes("kolkata");
              if (locId === "ahmedabad") return locText.includes("ahmedabad");
              return locText.includes(locId.toLowerCase());
            });
            if (!locMatches) return false;
          }

          // 3. Age of Posting (Single threshold)
          if (selectedAge !== "all") {
            let diffHours = 999999;
            if (j.raw_posted_at) {
              const dt = new Date(j.raw_posted_at).getTime();
              if (!isNaN(dt)) diffHours = (Date.now() - dt) / (1000 * 60 * 60);
            } else {
              const pa = (j.posted_at || "").toLowerCase();
              if (pa.includes("just now") || pa.includes("h ago")) diffHours = 12;
              else if (pa.includes("1d ago")) diffHours = 24;
              else {
                const match = pa.match(/(\d+)d\s*ago/);
                if (match) diffHours = parseInt(match[1], 10) * 24;
                else diffHours = 24 * 15;
              }
            }

            if (selectedAge === "24h" && diffHours > 24) return false;
            if (selectedAge === "3d" && diffHours > 24 * 3) return false;
            if (selectedAge === "7d" && diffHours > 24 * 7) return false;
            if (selectedAge === "14d" && diffHours > 24 * 14) return false;
            if (selectedAge === "30d" && diffHours > 24 * 30) return false;
          }

          // 4. Function (Multi-select)
          if (!isAllFunc) {
            const jobDisc = detectFunctionalDiscipline(j.title, j.description);
            const funcMatches = selectedFunctions.some((funcId) => {
              if (jobDisc === funcId) return true;
              if (funcId === "sales_marketing") {
                return /\b(sales|marketing|account executive|business development|bdm|bde|growth|brand)\b/i.test(j.title);
              }
              if (funcId === "software_engineering") {
                return /\b(software|developer|engineer|full ?stack|backend|frontend|devops|sre|architect|qa|tech lead)\b/i.test(j.title);
              }
              if (funcId === "data_ai") {
                return /\b(data|ai|machine learning|ml|bi|analytics)\b/i.test(j.title);
              }
              if (funcId === "product_management") {
                return /\b(product manager|product management|product lead|product owner)\b/i.test(j.title);
              }
              if (funcId === "finance") {
                return /\b(finance|financial|accountant|accounting|audit|controller|tax|cfo)\b/i.test(j.title);
              }
              if (funcId === "human_resources") {
                return /\b(hr|talent|recruiter|people ops|human resources)\b/i.test(j.title);
              }
              if (funcId === "operations") {
                return /\b(operations|ops|delivery|program manager|project manager)\b/i.test(j.title);
              }
              return false;
            });
            if (!funcMatches) return false;
          }

          // 5. Keywords (Multi-select)
          if (!isAllKw) {
            const kwMatches = selectedKeywords.some((kw) => {
              const kwLower = kw.toLowerCase();
              return (
                j.keywords?.some((k) => k.toLowerCase() === kwLower) ||
                j.title.toLowerCase().includes(kwLower) ||
                j.description.toLowerCase().includes(kwLower)
              );
            });
            if (!kwMatches) return false;
          }

          return true;
        });

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
  }, [allCompanyGroups, searchQuery, selectedLocations, selectedAge, selectedFunctions, selectedKeywords]);

  // Paginated company groups: first 30, then +20 each time
  const displayedGroups = useMemo(() => {
    return filteredCompanyGroups.slice(0, visibleCount);
  }, [filteredCompanyGroups, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 20); // setVisibleCount((prev) => prev + 10)
  };

  // Helper label formatters for dropdown buttons
  const getLocationButtonLabel = () => {
    if (selectedLocations.includes("all") || selectedLocations.length === 0) return "Location: All";
    if (selectedLocations.length === 1) {
      const match = LOCATION_OPTIONS.find((o) => o.id === selectedLocations[0]);
      return match ? match.label : selectedLocations[0];
    }
    return `Location (${selectedLocations.length})`;
  };

  const getAgeButtonLabel = () => {
    if (selectedAge === "all") return "Age: All";
    const match = AGE_OPTIONS.find((o) => o.id === selectedAge);
    return match ? match.label : selectedAge;
  };

  const getFunctionButtonLabel = () => {
    if (selectedFunctions.includes("all") || selectedFunctions.length === 0) return "Function: All";
    if (selectedFunctions.length === 1) {
      const match = FUNCTION_OPTIONS.find((o) => o.id === selectedFunctions[0]);
      return match ? match.label : selectedFunctions[0];
    }
    return `Function (${selectedFunctions.length})`;
  };

  const getKeywordButtonLabel = () => {
    if (selectedKeywords.includes("all") || selectedKeywords.length === 0) return "Keywords: All";
    if (selectedKeywords.length === 1) return selectedKeywords[0];
    return `Keywords (${selectedKeywords.length})`;
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

      {/* Search Input Bar */}
      <div className="relative w-full">
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
          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)] transition-all shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setVisibleCount(30);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] border-none bg-transparent cursor-pointer p-1"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Multi-Select Dropdowns Bar: Location, Age of Posting, Function, Keywords */}
      <div ref={dropdownRef} className="flex flex-wrap items-center gap-2 z-30">
        {/* 1. Location Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveDropdown(activeDropdown === "location" ? null : "location")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              !selectedLocations.includes("all") && selectedLocations.length > 0
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>📍</span>
            <span>{getLocationButtonLabel()}</span>
            <svg
              className={`w-3 h-3 transition-transform ${activeDropdown === "location" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {activeDropdown === "location" && (
            <div className="absolute left-0 top-full mt-1.5 w-60 max-h-72 overflow-y-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-2 z-50 animate-scaleIn">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--color-border-light)] px-2">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Location</span>
                <button
                  type="button"
                  onClick={() => toggleFilter(selectedLocations, setSelectedLocations, "all")}
                  className="text-[11px] font-bold text-[var(--color-primary)] hover:underline bg-transparent border-none cursor-pointer p-0"
                >
                  Reset to All
                </button>
              </div>

              {/* All Option */}
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs font-semibold text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={selectedLocations.includes("all")}
                  onChange={() => toggleFilter(selectedLocations, setSelectedLocations, "all")}
                  className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                />
                <span>All Locations</span>
              </label>

              {/* Individual Options */}
              {LOCATION_OPTIONS.filter((o) => o.id !== "all").map((loc) => {
                const isChecked = selectedLocations.includes(loc.id);
                return (
                  <label
                    key={loc.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs text-[var(--color-text)]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleFilter(selectedLocations, setSelectedLocations, loc.id)}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                    />
                    <span>{loc.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Age of Posting Dropdown (Single Select Threshold) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveDropdown(activeDropdown === "age" ? null : "age")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              selectedAge !== "all"
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>🕒</span>
            <span>{getAgeButtonLabel()}</span>
            <svg
              className={`w-3 h-3 transition-transform ${activeDropdown === "age" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {activeDropdown === "age" && (
            <div className="absolute left-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-2 z-50 animate-scaleIn">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--color-border-light)] px-2">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Age of Posting</span>
                {selectedAge !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAge("all");
                      setVisibleCount(30);
                      setActiveDropdown(null);
                    }}
                    className="text-[11px] font-bold text-[var(--color-primary)] hover:underline bg-transparent border-none cursor-pointer p-0"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Single Select Age Options */}
              {AGE_OPTIONS.map((age) => {
                const isSelected = selectedAge === age.id;
                return (
                  <button
                    key={age.id}
                    type="button"
                    onClick={() => {
                      setSelectedAge(age.id);
                      setVisibleCount(30);
                      setActiveDropdown(null);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border-none text-left ${
                      isSelected
                        ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold"
                        : "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span>{age.label}</span>
                    </span>
                    {isSelected && <span className="text-xs text-[var(--color-primary)]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Function Dropdown (Sales, Marketing, Engineering, etc.) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveDropdown(activeDropdown === "function" ? null : "function")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              !selectedFunctions.includes("all") && selectedFunctions.length > 0
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>💼</span>
            <span>{getFunctionButtonLabel()}</span>
            <svg
              className={`w-3 h-3 transition-transform ${activeDropdown === "function" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {activeDropdown === "function" && (
            <div className="absolute left-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-2 z-50 animate-scaleIn">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--color-border-light)] px-2">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Job Function</span>
                <button
                  type="button"
                  onClick={() => toggleFilter(selectedFunctions, setSelectedFunctions, "all")}
                  className="text-[11px] font-bold text-[var(--color-primary)] hover:underline bg-transparent border-none cursor-pointer p-0"
                >
                  Reset to All
                </button>
              </div>

              {/* All Option */}
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs font-semibold text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={selectedFunctions.includes("all")}
                  onChange={() => toggleFilter(selectedFunctions, setSelectedFunctions, "all")}
                  className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                />
                <span>All Functions</span>
              </label>

              {/* Individual Function Options */}
              {FUNCTION_OPTIONS.filter((o) => o.id !== "all").map((func) => {
                const isChecked = selectedFunctions.includes(func.id);
                return (
                  <label
                    key={func.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs text-[var(--color-text)]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleFilter(selectedFunctions, setSelectedFunctions, func.id)}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                    />
                    <span>{func.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Keywords Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setActiveDropdown(activeDropdown === "keywords" ? null : "keywords")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              !selectedKeywords.includes("all") && selectedKeywords.length > 0
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>🏷️</span>
            <span>{getKeywordButtonLabel()}</span>
            <svg
              className={`w-3 h-3 transition-transform ${activeDropdown === "keywords" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {activeDropdown === "keywords" && (
            <div className="absolute left-0 top-full mt-1.5 w-64 max-h-80 overflow-y-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-2 z-50 animate-scaleIn">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--color-border-light)] px-2">
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Keywords</span>
                <button
                  type="button"
                  onClick={() => toggleFilter(selectedKeywords, setSelectedKeywords, "all")}
                  className="text-[11px] font-bold text-[var(--color-primary)] hover:underline bg-transparent border-none cursor-pointer p-0"
                >
                  Reset to All
                </button>
              </div>

              {/* Keyword Search Input */}
              <div className="px-1 mb-2">
                <input
                  type="text"
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                  placeholder="Filter keywords..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {/* All Option */}
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs font-semibold text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={selectedKeywords.includes("all")}
                  onChange={() => toggleFilter(selectedKeywords, setSelectedKeywords, "all")}
                  className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                />
                <span>All Keywords</span>
              </label>

              {/* Filtered Keywords List */}
              <div className="max-h-48 overflow-y-auto">
                {availableKeywords
                  .filter((kw) => !keywordSearch || kw.toLowerCase().includes(keywordSearch.toLowerCase()))
                  .map((kw) => {
                    const isChecked = selectedKeywords.includes(kw);
                    return (
                      <label
                        key={kw}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] cursor-pointer text-xs text-[var(--color-text)]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFilter(selectedKeywords, setSelectedKeywords, kw)}
                          className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-0 cursor-pointer"
                        />
                        <span>{kw}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters Button (Visible whenever any filter or search query is active) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Reset all filters to default"
          >
            <span>✕</span>
            <span>Clear Filters</span>
          </button>
        )}
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
            Try adjusting your search keywords or switching dropdown filters to see more opportunities.
          </p>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all cursor-pointer border-none shadow-sm"
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
