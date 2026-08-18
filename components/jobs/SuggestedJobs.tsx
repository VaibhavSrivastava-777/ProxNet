"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { TargetCompanyManager } from "./TargetCompanyManager";

interface SuggestedJob {
  id: string;
  title: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  keywords: string[];
  matchRate: number;
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
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [profileDigest, setProfileDigest] = useState<ProfileDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [activeCompanyModal, setActiveCompanyModal] = useState<CompanyGroup | null>(null);
  const [isMatchingCompleted, setIsMatchingCompleted] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSummary, setShowSummary] = useState(true);
  const router = useRouter();

  const decodeHtml = (html: string) => {
    if (!html) return "";
    let text = html.replace(/<[^>]*>?/gm, " ");
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&rsquo;/g, "'");
    text = text.replace(/&lsquo;/g, "'");
    text = text.replace(/&rdquo;/g, '"');
    text = text.replace(/&ldquo;/g, '"');
    text = text.replace(/&ndash;/g, "-");
    text = text.replace(/&mdash;/g, "-");
    return text.replace(/\s+/g, " ").trim();
  };

  useEffect(() => {
    async function fetchSuggested() {
      try {
        const res = await fetch("/api/jobs/suggested");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
          setIsMatchingCompleted(data.isMatchingCompleted ?? true);
          if (data.profileDigest) {
            setProfileDigest(data.profileDigest);
          }
        } else {
          console.warn("Failed to load suggested jobs feed");
        }
      } catch (e) {
        console.error("Failed to fetch suggested jobs", e);
        setErrorMsg("An error occurred while fetching jobs.");
      } finally {
        setLoading(false);
      }
    }
    fetchSuggested();
  }, []);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSummary(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  async function handleStartReferral(company: CompanyGroup, job: SuggestedJob, contactId: string) {
    setStartingChat(job.id);
    try {
      const res = await fetch("/api/jobs/chat/init-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          jobId: job.id,
          company: company.company,
          jobTitle: job.title
        }),
      });
      const data = await res.json();
      
      if (data.walletWarning) {
        alert("Insufficient credits, but opening chat anyway.");
      }

      if (data.threadId) {
        window.open(`/jobs/chat/${data.threadId}`, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error(data.error || "Failed to start chat");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to start referral: " + (err.message || ""));
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setStartingChat(null);
    }
  }

  const handleFollowToggle = async (contactId: string, companyName: string, currentlyFollowed?: boolean) => {
    // Optimistic update
    setCompanies(prev => prev.map(c => {
      if (c.company === companyName) {
        return {
          ...c,
          referralContacts: c.referralContacts.map(rc => 
            rc.id === contactId ? { ...rc, is_followed: !currentlyFollowed } : rc
          )
        };
      }
      return c;
    }));

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ following_id: contactId }),
      });
      if (!res.ok) throw new Error("Failed to follow");
    } catch (e) {
      console.error(e);
      // Revert on error
      setCompanies(prev => prev.map(c => {
        if (c.company === companyName) {
          return {
            ...c,
            referralContacts: c.referralContacts.map(rc => 
              rc.id === contactId ? { ...rc, is_followed: currentlyFollowed } : rc
            )
          };
        }
        return c;
      }));
    }
  };

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
  const filteredCompanies = companies.filter(c => {
    if (!q) return true;
    return (
      c.company.toLowerCase().includes(q) ||
      c.jobs.some(j => j.title.toLowerCase().includes(q))
    );
  });

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

      {/* Target Company Management (Add & Remove Target Companies) */}
      <TargetCompanyManager
        onCompaniesChanged={async () => {
          try {
            const res = await fetch("/api/jobs/suggested");
            if (res.ok) {
              const data = await res.json();
              setCompanies(data.companies || []);
            }
          } catch (e) {}
        }}
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

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-tertiary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </span>
        <input
          type="text"
          placeholder="Search by company, job title, location, or keywords..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface hover:border-primary/50 focus:border-primary focus:outline-none transition-colors text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="card p-12 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px] justify-center bg-surface">
          <svg className="text-text-tertiary mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
          <p className="text-body text-text-secondary font-medium">No company matches found.</p>
          <p className="text-caption mt-1">Try updating your Bio on your profile, or adjust your search keywords.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCompanies.map((group) => (
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
                <button
                  onClick={() => {
                    router.push(`/qa?tab=network&company=${encodeURIComponent(group.company)}`);
                    window.dispatchEvent(new CustomEvent("tabchange", { detail: "/network" }));
                  }}
                  className="btn btn-sm btn-primary text-xs cursor-pointer font-bold px-3 py-1.5 rounded-lg"
                >
                  {group.contactsCount} Referrars available
                </button>
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
              {activeCompanyModal.jobs.map((job) => (
                <div key={job.id} className="p-4 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-sm text-[var(--color-text)] m-0">{job.title}</h4>
                    <span className="badge bg-primary/10 text-primary border border-primary/20 text-[10px] px-1.5 font-bold shrink-0">
                      {job.matchRate}% Match
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                    <span>📍 {job.location || "Remote"}</span>
                    {job.posted_at && (
                      <span>📅 {new Date(job.posted_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  {job.url && (
                    <a 
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary mt-2 text-center text-xs block py-1.5 no-underline"
                    >
                      Apply on Career Website
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
