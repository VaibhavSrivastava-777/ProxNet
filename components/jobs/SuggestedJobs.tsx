"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  referralContacts: Array<{ id: string; alias: string }>;
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
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
          if (data.profileDigest) {
            setProfileDigest(data.profileDigest);
          }
        } else {
          setErrorMsg("Failed to load suggested jobs feed");
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
      if (data.threadId) {
        router.push(`/jobs/chat/${data.threadId}`);
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

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 skeleton h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  // Filter companies/jobs by search query
  const q = searchQuery.toLowerCase().trim();
  const filteredCompanies = companies.filter(c => {
    if (!q) return true;
    const companyMatch = c.company.toLowerCase().includes(q);
    const jobMatch = c.jobs.some(j => 
      j.title.toLowerCase().includes(q) || 
      (j.description && j.description.toLowerCase().includes(q)) ||
      (j.location && j.location.toLowerCase().includes(q))
    );
    return companyMatch || jobMatch;
  });

  return (
    <div className="space-y-6 stagger-children max-w-3xl mx-auto pb-12">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">
          {errorMsg}
        </div>
      )}

      {/* Header & Bio Digest */}
      <div className="card p-6 border border-primary/20 bg-surface/60 backdrop-blur-md flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-primary">Referral-First Matches</h2>
          <p className="text-body-sm text-text-secondary">
            Grouped by companies with active professionals. Semantically matched with your profile.
          </p>
        </div>

        {profileDigest && (
          <div className="p-3.5 rounded-lg bg-surface-elevated/40 border border-border/50 text-caption flex flex-col gap-2">
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
        filteredCompanies.map((group) => (
          <div key={group.company} className="card p-5 animate-fadeInUp flex flex-col gap-4 border border-border bg-surface shadow-sm">
            
            {/* Company Header */}
            <div className="flex justify-between items-start border-b border-border/60 pb-3">
              <div>
                <h3 className="text-h3 font-bold text-text">{group.company}</h3>
                <div className="flex items-center gap-1.5 mt-1 text-caption text-text-secondary">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {group.contactsCount} Referral Contact{group.contactsCount > 1 ? "s" : ""} Available
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 items-center max-w-[200px] justify-end">
                {group.referralContacts.map(c => (
                  <span key={c.id} className="badge bg-surface-elevated text-text-secondary border border-border/80 text-[10px] px-2 py-0.5 rounded font-mono">
                    @{c.alias}
                  </span>
                ))}
              </div>
            </div>

            {/* Jobs List inside Company */}
            <div className="space-y-4">
              {group.jobs.map((job) => (
                <div key={job.id} className="p-4 rounded-lg bg-surface-elevated/20 border border-border/40 hover:border-primary/20 transition-all flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-body font-bold text-text">{job.title}</h4>
                        <span className="badge bg-primary/10 text-primary border border-primary/20 font-bold text-[10px] px-1.5 rounded">
                          {job.matchRate}% Match
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-caption text-text-secondary mt-1">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          {job.location || "Remote"}
                        </span>
                        {job.posted_at && (
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            {new Date(job.posted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {job.keywords && job.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {job.keywords.map((kw, i) => (
                        <span key={i} className="text-[10px] bg-surface-elevated text-text-secondary border border-border px-1.5 py-0.5 rounded uppercase font-semibold">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {job.description && (
                    <p className="text-caption text-text-secondary line-clamp-2">
                      {decodeHtml(job.description).substring(0, 180)}...
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-2.5 border-t border-border/30 mt-1 gap-4">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-secondary hover:text-primary transition-colors text-xs font-medium flex items-center gap-1"
                    >
                      View Posting External
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>

                    <button
                      className="btn btn-xs btn-primary font-bold px-3 py-1 rounded shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                      onClick={() => handleStartReferral(group, job, group.referralContacts[0].id)}
                      disabled={startingChat === job.id}
                    >
                      {startingChat === job.id ? (
                        <>Connecting...</>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          Ask for Referral
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ))
      )}
    </div>
  );
}
