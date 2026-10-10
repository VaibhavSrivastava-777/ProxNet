"use client";

import { useState, useEffect, useCallback } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { JobDetailSheet, JobItem, PreparationData } from "./JobDetailSheet";

interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id?: string | null;
  company: string;
  job_title: string;
  job_url?: string | null;
  stage: "applied" | "interview" | "pipe" | "offer" | "rejected";
  is_prepared?: boolean;
  match_score?: number | null;
  applied_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export function AppliedJobsTab() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "prepared" | "applied" | "interview" | "pipe" | "offer" | "rejected">("all");
  
  // Drawer state for viewing opportunity details & saved playbook
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [selectedPreparation, setSelectedPreparation] = useState<PreparationData | null>(null);
  const [initialDrawerTab, setInitialDrawerTab] = useState<"overview" | "prepare">("overview");
  const [userWallet, setUserWallet] = useState(0);

  // Link checking state & toast
  const [checkingLinkId, setCheckingLinkId] = useState<string | null>(null);
  const [linkNoticeToast, setLinkNoticeToast] = useState<{ message: string; fallbackUrl?: string } | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/jobs/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
      // Also get wallet
      const pRes = await fetch("/api/profile");
      if (pRes.ok) {
        const pData = await pRes.json();
        setUserWallet(pData.wallet ?? 0);
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
    const handleUpdate = () => fetchApplications();
    window.addEventListener("job_application_updated", handleUpdate);
    return () => window.removeEventListener("job_application_updated", handleUpdate);
  }, [fetchApplications]);

  const updateStage = async (id: string, newStage: ApplicationRecord["stage"]) => {
    try {
      const res = await fetch("/api/jobs/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id, stage: newStage }),
      });
      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) => (app.id === id ? { ...app, stage: newStage } : app))
        );
        window.dispatchEvent(new CustomEvent("job_application_updated", { detail: { applicationId: id, stage: newStage } }));
      }
    } catch (err) {
      console.error("Failed to update application stage:", err);
    }
  };

  const deleteApplication = async (id: string) => {
    if (!confirm("Remove this opportunity from your tracker?")) return;
    try {
      const res = await fetch(`/api/jobs/applications?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setApplications((prev) => prev.filter((app) => app.id !== id));
        window.dispatchEvent(new CustomEvent("job_application_updated", { detail: { applicationId: id, deleted: true } }));
      }
    } catch (err) {
      console.error("Failed to delete application:", err);
    }
  };

  // Open details anytime with option to anchor directly to Playbook or Overview
  const openSavedPlaybook = (app: ApplicationRecord) => openOpportunityDetails(app, "prepare");
  const openOpportunityDetails = (app: ApplicationRecord, tab: "overview" | "prepare" = "overview") => {
    let prepData: PreparationData | null = null;
    if (app.notes) {
      try {
        const parsed = JSON.parse(app.notes);
        if (parsed.strengths) prepData = parsed;
      } catch {}
    }

    const jobItem: JobItem = {
      id: app.job_id || app.id,
      title: app.job_title,
      company: app.company,
      location: prepData?.location || "India",
      url: app.job_url || "",
      description: prepData?.jobDescription || "Opportunity details from your tracker. View role requirements, ATS links, or review preparation playbook.",
      matchRate: app.match_score || 85,
    };

    setSelectedJob(jobItem);
    setSelectedPreparation(prepData);
    setInitialDrawerTab(tab);
  };

  // Smart link handler that verifies health and catches 404 / closed redirects
  const handleOpenLink = async (app: ApplicationRecord) => {
    if (!app.job_url) return;

    setCheckingLinkId(app.id);
    setLinkNoticeToast(null);

    let urlToOpen = app.job_url;
    try {
      const res = await fetch(
        `/api/jobs/check-link?url=${encodeURIComponent(app.job_url)}&company=${encodeURIComponent(app.company)}&title=${encodeURIComponent(app.job_title)}&jobId=${encodeURIComponent(app.job_id || "")}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.isExpired) {
          urlToOpen = data.fallbackUrl || app.job_url;
          setLinkNoticeToast({
            message: `Notice: This specific requisition has closed on the ATS portal (${data.reason}). Opened active search fallback for '${app.job_title}' at ${app.company}.`,
            fallbackUrl: data.fallbackUrl,
          });
        }
      }
    } catch {}

    setCheckingLinkId(null);
    window.open(urlToOpen, "_blank", "noopener,noreferrer");
  };

  // Filter items
  const filteredApps = applications.filter((app) => {
    if (filter === "prepared") {
      return Boolean(app.is_prepared || (app.notes && app.notes.includes("strengths")));
    }
    if (filter === "all") return true;
    return app.stage === filter;
  });

  const preparedCount = applications.filter((a) => a.is_prepared || (a.notes && a.notes.includes("strengths"))).length;
  const appliedCount = applications.filter((a) => a.stage === "applied").length;
  const interviewCount = applications.filter((a) => a.stage === "interview").length;
  const pipeCount = applications.filter((a) => a.stage === "pipe").length;
  const offerCount = applications.filter((a) => a.stage === "offer").length;
  const rejectedCount = applications.filter((a) => a.stage === "rejected").length;

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--color-border-light)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight m-0 flex items-center gap-2">
            <span>Opportunity Tracker</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {applications.length} Saved
            </span>
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
            Your persistent pipeline of direct applications and AI-unlocked preparation playbooks.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: "all", label: `All (${applications.length})` },
            { id: "prepared", label: `⚡ Prepared (${preparedCount})` },
            { id: "applied", label: `🚀 Applied (${appliedCount})` },
            { id: "interview", label: `🎯 Interview (${interviewCount})` },
            { id: "pipe", label: `⏳ Pipe (${pipeCount})` },
            { id: "offer", label: `🎉 Offer (${offerCount})` },
            { id: "rejected", label: `❌ Rejected (${rejectedCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                filter === f.id
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 404 / Expired Link Notification Toast */}
      {linkNoticeToast && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span className="font-semibold">{linkNoticeToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setLinkNoticeToast(null)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 text-inherit border-none cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3 py-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-[var(--color-surface-secondary)]/60 animate-pulse border border-[var(--color-border-light)]"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredApps.length === 0 && (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)]/20">
          <span className="text-3xl mb-2 block">📋</span>
          <h3 className="text-sm font-bold text-[var(--color-text)]">
            {filter === "all" ? "No tracked opportunities yet" : "No opportunities matching this filter"}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto mt-1 mb-4">
            Browse the Jobs tab to prepare with AI (1 ⚡) or apply directly. All actions automatically appear here!
          </p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("tabchange", { detail: "/jobs" }));
              window.history.pushState(null, "", "/jobs");
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all cursor-pointer border-none"
          >
            Explore 7,000+ Opportunities
          </button>
        </div>
      )}

      {/* List of Applications */}
      {!loading && filteredApps.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredApps.map((app) => {
            const hasPlaybook = Boolean(app.is_prepared || (app.notes && app.notes.includes("strengths")));
            const isChecking = checkingLinkId === app.id;

            return (
              <div
                key={app.id}
                className="p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-border)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                {/* Left: Company & Details */}
                <div
                  className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                  onClick={() => openOpportunityDetails(app, hasPlaybook ? "prepare" : "overview")}
                  title="Click to view details & preparation playbook"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-xs">
                    <CompanyLogo company={app.company} className="w-9 h-9 object-contain" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--color-text-secondary)] truncate">
                        {app.company}
                      </span>

                      {/* Independent Prepared Status Badge */}
                      {hasPlaybook && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          ⚡ Prepared
                        </span>
                      )}

                      {/* Pipeline Stage Badge */}
                      {app.stage === "applied" && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          🚀 Applied
                        </span>
                      )}
                      {app.stage === "interview" && (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          🎯 Interview
                        </span>
                      )}
                      {app.stage === "pipe" && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                          ⏳ In Pipe
                        </span>
                      )}
                      {app.stage === "offer" && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/40">
                          🎉 Offer
                        </span>
                      )}
                      {app.stage === "rejected" && (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                          ❌ Rejected
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] truncate m-0 mt-0.5 hover:text-[var(--color-primary)] transition-colors">
                      {app.job_title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] mt-1">
                      <span>Saved {new Date(app.updated_at || app.created_at).toLocaleDateString()}</span>
                      {app.match_score && (
                        <>
                          <span>&bull;</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{app.match_score}% Match</span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span className="text-[var(--color-primary)] hover:underline font-semibold">
                        View Details &rarr;
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                  {/* View saved preparation playbook */}
                  {hasPlaybook && (
                    <button
                      type="button"
                      onClick={() => openOpportunityDetails(app, "prepare")}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/30 cursor-pointer flex items-center gap-1"
                      title="Check prepared playbook anytime"
                    >
                      <span>⚡ View Playbook</span>
                    </button>
                  )}

                  {/* General Details button */}
                  <button
                    type="button"
                    onClick={() => openOpportunityDetails(app, "overview")}
                    className="px-3 py-1.5 rounded-xl font-semibold text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all border border-[var(--color-border-light)] cursor-pointer"
                    title="View full opportunity details"
                  >
                    Details
                  </button>

                  {/* Smart Open Link with 404 / closed ATS detection */}
                  {app.job_url && (
                    <button
                      type="button"
                      onClick={() => handleOpenLink(app)}
                      disabled={isChecking}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all border border-[var(--color-border-light)] cursor-pointer flex items-center gap-1 disabled:opacity-60"
                      title="Open verified job opening"
                    >
                      {isChecking ? (
                        <>
                          <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-[var(--color-text)] border-t-transparent rounded-full" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <span>Open Link</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}

                  {/* Pipeline Stage Dropdown: Strictly Applied, Interview, Pipe, Offer, Rejected */}
                  <select
                    value={app.stage || "pipe"}
                    onChange={(e) => updateStage(app.id, e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] cursor-pointer focus:outline-none"
                    title="Update pipeline stage"
                  >
                    <option value="applied">🚀 Applied</option>
                    <option value="interview">🎯 Interview</option>
                    <option value="pipe">⏳ Pipe</option>
                    <option value="offer">🎉 Offer</option>
                    <option value="rejected">❌ Rejected</option>
                  </select>

                  {/* Delete / Archive */}
                  <button
                    type="button"
                    onClick={() => deleteApplication(app.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors border-none bg-transparent cursor-pointer"
                    title="Remove from tracker"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-over Opportunity Detail Drawer with direct playbook access */}
      <JobDetailSheet
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => {
          setSelectedJob(null);
          setSelectedPreparation(null);
        }}
        userWallet={userWallet}
        cachedPreparation={selectedPreparation}
        initialTab={initialDrawerTab}
      />
    </div>
  );
}
