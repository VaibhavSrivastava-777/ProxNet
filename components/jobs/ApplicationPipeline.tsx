"use client";

import React, { useState, useEffect, useCallback } from "react";

export interface JobApplication {
  id: string;
  user_id: string;
  job_id?: string | null;
  company: string;
  job_title: string;
  job_url?: string | null;
  stage: "saved" | "applied" | "referral_sent" | "referral_responded" | "interview" | "offer" | "rejected" | "withdrawn";
  referral_thread_id?: string | null;
  notes?: string | null;
  match_score?: number | null;
  applied_at?: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES: Array<{ id: JobApplication["stage"]; label: string; icon: string; color: string }> = [
  { id: "saved", label: "Saved", icon: "🔖", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { id: "referral_sent", label: "Referral Asked", icon: "🤝", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  { id: "referral_responded", label: "Referrer Replied", icon: "💬", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  { id: "applied", label: "Applied", icon: "📤", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { id: "interview", label: "Interview", icon: "🎯", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  { id: "offer", label: "Offer", icon: "🏆", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
];

interface ApplicationPipelineProps {
  onRefreshNeeded?: () => void;
}

export const ApplicationPipeline: React.FC<ApplicationPipelineProps> = ({ onRefreshNeeded }) => {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeStageFilter, setActiveStageFilter] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        setStageCounts(data.stageCounts || {});
      }
    } catch (err) {
      console.error("Failed to load application pipeline:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const updateStage = async (id: string, newStage: JobApplication["stage"]) => {
    setUpdatingId(id);
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
        fetchApplications();
        if (onRefreshNeeded) onRefreshNeeded();
      }
    } catch (err) {
      console.error("Failed to update application stage:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteApplication = async (id: string) => {
    if (!confirm("Remove this job from your pipeline?")) return;
    try {
      const res = await fetch(`/api/jobs/applications?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setApplications((prev) => prev.filter((app) => app.id !== id));
        fetchApplications();
      }
    } catch (err) {
      console.error("Failed to delete application:", err);
    }
  };

  const totalCount = applications.length;

  if (loading) {
    return null;
  }

  // If user has 0 saved applications and pipeline is collapsed, show subtle prompt
  if (totalCount === 0 && !isExpanded) {
    return (
      <div className="p-3.5 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/60 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2">
          <span>📋</span>
          <span><strong>Application Tracker:</strong> Bookmark jobs with 🔖 <em>Save</em> to track referrals and interviews.</span>
        </div>
      </div>
    );
  }

  const displayedApps = activeStageFilter
    ? applications.filter((a) => a.stage === activeStageFilter)
    : applications;

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border-light)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] m-0">
              My Job Pipeline ({totalCount})
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-primary hover:underline bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"
        >
          <span>{isExpanded ? "Collapse" : "View Pipeline"}</span>
          <span>{isExpanded ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* Stage Counter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {STAGES.map((s) => {
          const count = stageCounts[s.id] || 0;
          const isSelected = activeStageFilter === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setIsExpanded(true);
                setActiveStageFilter(isSelected ? null : s.id);
              }}
              className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? "bg-primary text-white border-primary shadow-xs"
                  : count > 0
                  ? `${s.color}`
                  : "bg-[var(--color-surface)] border-[var(--color-border-light)] text-[var(--color-text-secondary)] opacity-60 hover:opacity-100"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                isSelected ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/10"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded Pipeline Detail List */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex flex-col gap-2 animate-fadeInUp">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
            <span>
              {activeStageFilter
                ? `Showing ${displayedApps.length} in ${STAGES.find((s) => s.id === activeStageFilter)?.label}`
                : `All ${displayedApps.length} tracked roles`}
            </span>
            {activeStageFilter && (
              <button
                type="button"
                onClick={() => setActiveStageFilter(null)}
                className="text-[11px] text-primary hover:underline bg-transparent border-0 cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>

          {displayedApps.length === 0 ? (
            <div className="text-center py-4 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] rounded-lg border border-[var(--color-border-light)]">
              No roles in this stage. Click 🔖 <strong>Save</strong> on any job card to add it here.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {displayedApps.map((app) => (
                <div
                  key={app.id}
                  className="p-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--color-text)] truncate">
                        {app.job_title}
                      </span>
                      {app.match_score && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          app.match_score >= 85
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                        }`}>
                          🔥 {app.match_score}%
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-2 mt-0.5">
                      <span className="font-semibold text-[var(--color-text)]">{app.company}</span>
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Open Req</span>
                          <span className="text-[9px]">↗</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Stage Selector & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={app.stage}
                      disabled={updatingId === app.id}
                      onChange={(e) => updateStage(app.id, e.target.value as JobApplication["stage"])}
                      className="text-xs py-1 px-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] cursor-pointer"
                    >
                      <option value="saved">🔖 Saved</option>
                      <option value="referral_sent">🤝 Referral Asked</option>
                      <option value="referral_responded">💬 Referrer Replied</option>
                      <option value="applied">📤 Applied</option>
                      <option value="interview">🎯 Interview</option>
                      <option value="offer">🏆 Offer</option>
                      <option value="rejected">❌ Rejected</option>
                      <option value="withdrawn">⏸ Withdrawn</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => deleteApplication(app.id)}
                      className="text-[var(--color-text-secondary)] hover:text-rose-500 text-xs p-1 bg-transparent border-0 cursor-pointer"
                      title="Remove from pipeline"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
