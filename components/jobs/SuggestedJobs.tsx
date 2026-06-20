"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SuggestedJob {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  keywords: string[];
  similarity: number;
  referralContacts: Array<{ id: string; alias: string }>;
}

export function SuggestedJobs() {
  const [jobs, setJobs] = useState<SuggestedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [requireReferral, setRequireReferral] = useState(false);
  const router = useRouter();

  // Helper to dynamically clean old messy DB descriptions
  const decodeHtml = (html: string) => {
    if (!html) return "";
    let text = html.replace(/<[^>]*>?/gm, ' ');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&rsquo;/g, "'");
    text = text.replace(/&lsquo;/g, "'");
    text = text.replace(/&rdquo;/g, '"');
    text = text.replace(/&ldquo;/g, '"');
    text = text.replace(/&ndash;/g, '-');
    text = text.replace(/&mdash;/g, '-');
    return text.replace(/\s+/g, ' ').trim();
  };

  useEffect(() => {
    async function fetchSuggested() {
      try {
        const res = await fetch("/api/jobs/suggested");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (e) {
        console.error("Failed to fetch suggested jobs", e);
      } finally {
        setLoading(false);
      }
    }
    fetchSuggested();
  }, []);

  async function handleStartReferral(job: SuggestedJob, contactId: string) {
    setStartingChat(job.id);
    try {
      const res = await fetch("/api/jobs/chat/init-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          jobId: job.id,
          company: job.company,
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
      setErrorMsg("Failed to start chat: " + (err.message || ""));
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setStartingChat(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 skeleton h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children max-w-3xl mx-auto">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">
          {errorMsg}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-h2 text-primary">Your AI Matches</h2>
        <p className="text-body-sm text-text-secondary">
          These active job postings have been semantically matched to your profile. Every listing here has at least one ProxNet professional working at the company who can refer you.
        </p>
      </div>

      <div className="flex justify-end items-center mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            className="toggle toggle-primary"
            checked={requireReferral}
            onChange={(e) => setRequireReferral(e.target.checked)}
          />
          <span className="text-sm font-medium text-text">ProxNet Refer Available</span>
        </label>
      </div>

      {(() => {
        const filteredJobs = requireReferral ? jobs.filter(j => j.referralContacts.length > 0) : jobs;
        
        if (filteredJobs.length === 0) {
          return (
            <div className="card p-8 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px]">
              <p className="text-body text-text-secondary font-medium">No highly matched jobs found.</p>
              <p className="text-caption mt-1">Try updating your Bio on your profile to get better AI matches, or check back later!</p>
            </div>
          );
        }

        return filteredJobs.map((job) => (
          <div key={job.id} className="card p-5 animate-fadeInUp flex flex-col gap-4 border border-primary/20 bg-surface">
            <div>
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wide text-xs px-2">
                      {Math.round(job.similarity * 100)}% Match
                    </span>
                    <h4 className="text-h3 text-text line-clamp-1">{job.title}</h4>
                  </div>
                  <div className="text-body-sm font-medium text-text mt-1">
                    {job.company}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-caption text-text-secondary mt-2">
                <span className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {job.location || "Remote"}
                </span>
                {job.posted_at && (
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Posted {new Date(job.posted_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              {job.keywords && job.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.keywords.map((kw, i) => (
                    <span key={i} className="badge bg-surface-elevated text-text-secondary border border-border text-[10px] uppercase font-semibold">
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {job.description && (
                <div className="text-caption text-text-secondary mt-3 line-clamp-2">
                  {decodeHtml(job.description).substring(0, 200)}...
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-border-light gap-4">
              <a 
                href={job.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:underline text-sm font-semibold flex items-center gap-1"
              >
                Apply Externally
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              </a>

              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary">
                  {job.referralContacts.length === 0 
                    ? "No internal referrals available yet" 
                    : `${job.referralContacts.length} Contact${job.referralContacts.length > 1 ? "s" : ""} Available`}
                </span>
                <button
                  className={`btn btn-sm flex items-center gap-2 ${job.referralContacts.length === 0 ? "bg-surface-elevated text-text-muted cursor-not-allowed border border-border" : "btn-accent"}`}
                  onClick={() => job.referralContacts.length > 0 && handleStartReferral(job, job.referralContacts[0].id)}
                  disabled={startingChat === job.id || job.referralContacts.length === 0}
                  title={job.referralContacts.length === 0 ? "You need a ProxNet professional at this company to request a referral" : ""}
                >
                  {startingChat === job.id ? (
                    <><span className="spinner-sm" /> Connecting...</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Message Professional
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ));
      })()}
    </div>
  );
}
