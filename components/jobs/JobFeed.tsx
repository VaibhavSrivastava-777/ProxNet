"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Referrar {
  id: string;
  alias: string;
}

interface Job {
  id: string;
  role: string;
  company: string;
  skills: string;
  created_at: string;
  url?: string;
  description?: string;
}

interface CompanyData {
  company: string;
  jobCount: number;
  referrarCount: number;
  referrars: Referrar[];
  jobs: Job[];
}

export function JobFeed({ refreshKey }: { refreshKey: number }) {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // Pagination for expanded jobs
  const [page, setPage] = useState(1);
  const jobsPerPage = 5;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      fetch(`/api/jobs/feed`)
        .then((res) => res.json())
        .then((data) => {
          setCompanies(data.companies || []);
          setCurrentUserId(data.currentUserId || null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    fetchData();
  }, [refreshKey]);

  // Filter companies
  const filteredCompanies = companies.filter(c => 
    c.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCompData = expandedCompany ? companies.find(c => c.company === expandedCompany) : null;
  const paginatedJobs = selectedCompData ? selectedCompData.jobs.slice((page - 1) * jobsPerPage, page * jobsPerPage) : [];
  const totalPages = selectedCompData ? Math.ceil(selectedCompData.jobs.length / jobsPerPage) : 1;

  async function handleStartChat(targetUserId: string) {
    if (targetUserId === currentUserId) {
      alert("You cannot message yourself.");
      return;
    }
    setStartingChat(targetUserId);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Hi, I am interested in a referral for your company.", targetUserId }),
      });
      const data = await res.json();
      
      if (!res.ok && res.status !== 402) {
         throw new Error(data.error || "Failed to start chat");
      }
      
      if (data.walletWarning) {
        alert(data.error || "Insufficient credits, but opening chat anyway.");
      }

      if (data.id) {
        router.push(`/qa/${data.id}`);
      } else if (res.status === 402) {
        setErrorMsg(data.error || "Insufficient credits to start a chat.");
      } else {
        throw new Error("Failed to start chat");
      }
    } catch (err: any) {
      setErrorMsg("Failed to start chat: " + (err.message || ""));
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setStartingChat(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-5 skeleton h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (expandedCompany && selectedCompData) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <button 
          onClick={() => { setExpandedCompany(null); setPage(1); }}
          className="btn btn-ghost btn-sm flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-primary mb-1 h-8 px-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Companies
        </button>

        {errorMsg && (
          <div className="alert alert-error">{errorMsg}</div>
        )}

        <div className="card p-4 sm:p-5 border border-[var(--color-border)] bg-[var(--color-surface-secondary)] rounded-xl">
          <h2 className="text-h3 sm:text-h2 capitalize mb-1.5">{selectedCompData.company}</h2>
          <div className="flex flex-wrap gap-2.5 sm:gap-4 text-xs sm:text-sm">
            <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {selectedCompData.referrarCount} Referrar{selectedCompData.referrarCount !== 1 ? 's' : ''} Available
            </span>
            <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              {selectedCompData.jobCount} Job{selectedCompData.jobCount !== 1 ? 's' : ''} Found
            </span>
          </div>
        </div>

        {/* Referrars Section */}
        {selectedCompData.referrars.length > 0 && (
          <div>
            <h3 className="text-body font-bold mb-2.5 flex items-center gap-1.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Available Referrars
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedCompData.referrars.map(ref => (
                <div key={ref.id} className="card p-3 rounded-xl flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex items-center justify-center font-bold text-xs">
                      {ref.alias.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text)]">{ref.alias}</p>
                      {ref.id === currentUserId && <p className="text-xs text-primary font-medium mt-0.5">This is you</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Jobs Section */}
        <div>
          <h3 className="text-body font-bold mb-2.5 flex items-center gap-1.5 mt-5">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
             Open Jobs
          </h3>
          {paginatedJobs.length === 0 ? (
            <div className="card p-8 text-center border-dashed text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)]">
              <p>No scraped jobs found for this company right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedJobs.map((job) => (
                <div key={job.id} className="card p-3 sm:p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-light)] transition-colors flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="flex-1 w-full">
                    <h4 className="font-semibold text-body sm:text-lg text-[var(--color-text)] leading-tight">{job.role}</h4>
                    <p className="text-[10px] sm:text-xs text-[var(--color-text-tertiary)] mt-1">
                      Posted • {new Date(job.created_at).toLocaleDateString()}
                    </p>
                    {job.skills && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(Array.isArray(job.skills) ? job.skills : (typeof job.skills === 'string' ? job.skills.split(",") : []))
                          .map((s: string) => s.trim()).filter(Boolean).slice(0, 4).map((skill: string) => (
                          <span key={skill} className="badge badge-sm border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
                    {selectedCompData.referrars.length > 0 && selectedCompData.referrars[0].id !== currentUserId && (
                      <button 
                        className="btn btn-sm btn-primary flex-1 sm:flex-none text-xs h-8 min-h-0"
                        onClick={async () => {
                          if (selectedCompData.referrars[0].id === currentUserId) return;
                          setStartingChat(job.id);
                          try {
                            const res = await fetch("/api/jobs/chat/init-referral", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                contactId: selectedCompData.referrars[0].id,
                                jobId: job.id,
                                company: selectedCompData.company,
                                jobTitle: job.role
                              }),
                            });
                            const data = await res.json();
                            if (data.walletWarning) alert("Insufficient credits, but opening chat anyway.");
                            if (data.threadId) window.open(`/jobs/chat/${data.threadId}`, '_blank', 'noopener,noreferrer');
                            else throw new Error(data.error || "Failed to start chat");
                          } catch (err: any) {
                            setErrorMsg("Failed to start referral: " + (err.message || ""));
                            setTimeout(() => setErrorMsg(""), 5000);
                          } finally {
                            setStartingChat(null);
                          }
                        }}
                        disabled={startingChat === job.id}
                      >
                        {startingChat === job.id ? "Opening..." : "Ask for Referral"}
                      </button>
                    )}
                    {job.url && (
                      <a 
                        href={job.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => { e.preventDefault(); window.open(job.url, '_blank', 'noopener,noreferrer'); }}
                        className="btn btn-sm btn-outline flex-1 sm:flex-none text-xs h-8 min-h-0 text-[var(--color-text-secondary)]"
                      >
                        Apply External
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button 
                className="btn btn-sm btn-ghost" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                Page {page} of {totalPages}
              </span>
              <button 
                className="btn btn-sm btn-ghost" 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center bg-[var(--color-surface-secondary)] p-3 rounded-xl shadow-inner">
        <h3 className="text-h4 font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6.75h1.5m-1.5 3h1.5m-1.5 3h1.5" />
          </svg>
          Companies
        </h3>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search companies..." 
            className="input input-sm pr-8 bg-[var(--color-surface)] border-none shadow-sm rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="w-4 h-4 absolute right-2.5 top-2.5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCompanies.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[var(--color-text-secondary)] font-medium">
            No companies found matching "{searchQuery}"
          </div>
        ) : (
          filteredCompanies.map((comp, i) => (
            <div 
              key={comp.company} 
              onClick={() => { setExpandedCompany(comp.company); setPage(1); }}
              className={`card p-5 cursor-pointer relative overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:shadow-md animate-fadeInUp`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex items-center justify-center font-bold text-lg uppercase">
                    {comp.company.charAt(0)}
                  </div>
                  <h3 className="font-bold text-lg capitalize text-[var(--color-text)] truncate pr-2">
                    {comp.company}
                  </h3>
                </div>
                
                <div className="flex justify-between items-center mt-auto border-t border-[var(--color-border-light)] pt-4">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-[var(--color-text)] leading-none">{comp.jobCount}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] mt-1.5">Jobs</span>
                  </div>
                  <div className="h-8 w-px bg-[var(--color-border-light)]"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold text-[var(--color-text)] leading-none">{comp.referrarCount}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] mt-1.5">Referrars</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
