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
  stage: "saved" | "applied" | "prepared" | "interview" | "offer" | "rejected" | "withdrawn";
  match_score?: number | null;
  applied_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export function AppliedJobsTab() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "prepared" | "applied" | "active">("all");
  
  // Drawer state for viewing saved preparation
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [selectedPreparation, setSelectedPreparation] = useState<PreparationData | null>(null);
  const [userWallet, setUserWallet] = useState(0);

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
      }
    } catch (err) {
      console.error("Failed to delete application:", err);
    }
  };

  // Open saved preparation in JobDetailSheet
  const openSavedPlaybook = (app: ApplicationRecord) => {
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
      description: "Saved preparation playbook from your tracker.",
      matchRate: app.match_score || 85,
    };

    setSelectedJob(jobItem);
    setSelectedPreparation(prepData);
  };

  // Filter items
  const filteredApps = applications.filter((app) => {
    if (filter === "prepared") {
      return app.stage === "prepared" || (app.notes && app.notes.includes("strengths"));
    }
    if (filter === "applied") {
      return app.stage === "applied";
    }
    if (filter === "active") {
      return ["applied", "prepared", "interview", "offer"].includes(app.stage);
    }
    return true;
  });

  const preparedCount = applications.filter((a) => a.stage === "prepared" || (a.notes && a.notes.includes("strengths"))).length;
  const appliedCount = applications.filter((a) => a.stage === "applied").length;

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
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { id: "all", label: `All (${applications.length})` },
            { id: "prepared", label: `⚡ Prepared (${preparedCount})` },
            { id: "applied", label: `🚀 Applied (${appliedCount})` },
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
            const hasPlaybook = app.notes && app.notes.includes("strengths");

            return (
              <div
                key={app.id}
                className="p-4 rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-border)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                {/* Left: Company & Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-xs">
                    <CompanyLogo company={app.company} className="w-9 h-9 object-contain" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-secondary)] truncate">
                        {app.company}
                      </span>
                      {hasPlaybook && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          ⚡ AI Playbook Saved
                        </span>
                      )}
                      {app.stage === "applied" && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          ✓ Applied Directly
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] truncate m-0 mt-0.5">
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
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* View saved preparation playbook */}
                  {hasPlaybook && (
                    <button
                      type="button"
                      onClick={() => openSavedPlaybook(app)}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all border border-amber-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <span>⚡ View Playbook</span>
                    </button>
                  )}

                  {/* Open official URL */}
                  {app.job_url && (
                    <a
                      href={app.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all border border-[var(--color-border-light)] no-underline flex items-center gap-1"
                    >
                      <span>Open Link</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

                  {/* Stage Dropdown */}
                  <select
                    value={app.stage}
                    onChange={(e) => updateStage(app.id, e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] cursor-pointer focus:outline-none"
                  >
                    <option value="prepared">Prepared</option>
                    <option value="applied">Applied</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
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

      {/* Slide-over Opportunity Detail Drawer for saved playbooks */}
      <JobDetailSheet
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => {
          setSelectedJob(null);
          setSelectedPreparation(null);
        }}
        userWallet={userWallet}
        cachedPreparation={selectedPreparation}
      />
    </div>
  );
}
