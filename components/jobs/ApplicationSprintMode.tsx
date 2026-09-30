"use client";

import { useState, useEffect } from "react";

export interface SprintStats {
  appliedCount: number;
  outreachCount: number;
  referralsCount: number;
  goal: number;
}

export interface ApplicationSprintModeProps {
  userWallet: number | null;
  onWalletUpdated: (newWallet: number) => void;
  onOpenBatchOutreach?: () => void;
  onFilterPioneerJobs?: () => void;
  onSelectJob?: (job: { id: string; title: string; company: string; score?: number; url?: string }) => void;
  topSprintJobs?: Array<{
    id: string;
    title: string;
    company: string;
    score?: number;
    url?: string;
  }>;
}

export function ApplicationSprintMode({
  userWallet,
  onWalletUpdated,
  onFilterPioneerJobs,
  onSelectJob,
  topSprintJobs = [],
}: ApplicationSprintModeProps) {
  const [active, setActive] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [stats, setStats] = useState<SprintStats>({
    appliedCount: 0,
    outreachCount: 0,
    referralsCount: 0,
    goal: 15,
  });
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState("15");

  useEffect(() => {
    fetchSprintStatus();
  }, []);

  const fetchSprintStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/sprint-mode");
      if (res.ok) {
        const data = await res.json();
        setActive(data.active || false);
        setDaysRemaining(data.daysRemaining || 0);
        if (data.stats) {
          setStats(data.stats);
          setNewGoal(String(data.stats.goal || 15));
        }
      }
    } catch (e) {
      console.error("[SprintMode] failed to fetch status:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateSprint = async () => {
    setActivating(true);
    try {
      const res = await fetch("/api/jobs/sprint-mode", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to activate sprint. Please verify credit balance.");
        return;
      }

      setActive(true);
      setDaysRemaining(data.daysRemaining || 7);
      if (data.stats) setStats(data.stats);
      if (typeof data.remainingWallet === "number") {
        onWalletUpdated(data.remainingWallet);
      }
      showToast("🚀 Application Sprint activated for 7 days! Let's crush your goals.");
    } catch (e) {
      console.error("Sprint activation failed", e);
      alert("Network error activating sprint mode.");
    } finally {
      setActivating(false);
    }
  };

  const handleIncrement = async (action: "applied" | "outreach" | "referral") => {
    try {
      const res = await fetch("/api/jobs/sprint-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, delta: 1 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        const label =
          action === "outreach"
            ? "Cold DM logged! Great initiative."
            : action === "applied"
            ? "Application logged! Keep the momentum."
            : "Referral ask logged!";
        showToast(`✓ ${label}`);
      }
    } catch (e) {
      console.error("Failed to increment sprint stat:", e);
    }
  };

  const handleSaveGoal = async () => {
    const parsed = parseInt(newGoal, 10);
    if (isNaN(parsed) || parsed < 1) return;
    try {
      const res = await fetch("/api/jobs/sprint-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: parsed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        setIsEditingGoal(false);
        showToast(`Target goal updated to ${parsed} applications/week.`);
      }
    } catch (e) {
      console.error("Failed to update goal:", e);
    }
  };

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  const totalEfforts = stats.appliedCount + stats.outreachCount + stats.referralsCount;
  const progressPercent = Math.min(100, Math.round((totalEfforts / Math.max(1, stats.goal)) * 100));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface-secondary)] to-primary/5 p-4 sm:p-5 shadow-sm transition-all">
      {/* Toast Notification */}
      {actionToast && (
        <div className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs shadow-md animate-fadeIn flex items-center gap-1.5">
          <span>{actionToast}</span>
        </div>
      )}

      {/* Inactive State: Call-to-action */}
      {!active ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/20 border border-primary/20 flex items-center justify-center text-xl shrink-0">
              🚀
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--color-text)] m-0">
                  Application Sprint Mode
                </h4>
                <span className="badge text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
                  3 Credits / 7 Days
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed max-w-xl">
                Designed for professionals actively looking for their next career opportunity. Accelerate your outreach with high-velocity tracking, cold DM templates, and daily focused action targets.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-[var(--color-text-tertiary)]">
                <span className="flex items-center gap-1">⚡ <strong>Velocity Tracker</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">✉️ <strong>Cold DM Assistant</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">⏰ <strong>Follow-up Alerts</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1">🎯 <strong>Daily Top 3 Digest</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleActivateSprint}
            disabled={activating || loading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0 border-none"
          >
            {activating ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Activating...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Start Sprint (3 Credits)</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Active Sprint State: Dashboard */
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-light)]">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔥</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[var(--color-text)] m-0">
                    Application Sprint Active
                  </h4>
                  <span className="badge text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                    {daysRemaining} Day{daysRemaining === 1 ? "" : "s"} Remaining
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
                  Sprint Velocity: {totalEfforts} actions logged against your weekly target
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onFilterPioneerJobs && (
                <button
                  type="button"
                  onClick={onFilterPioneerJobs}
                  className="px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:border-primary/40 text-xs font-semibold text-[var(--color-text)] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>🏆</span>
                  <span>View Pioneer Target Roles</span>
                </button>
              )}
            </div>
          </div>

          {/* Velocity Progress Bar & Target */}
          <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[var(--color-text)]">
                <span>Weekly Sprint Progress</span>
                <span className="text-primary font-mono">({progressPercent}%)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                {isEditingGoal ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newGoal}
                      onChange={(e) => setNewGoal(e.target.value)}
                      className="w-14 px-1.5 py-0.5 rounded border border-primary text-xs bg-[var(--color-surface)] text-[var(--color-text)]"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={handleSaveGoal}
                      className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-bold border-none cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingGoal(false)}
                      className="text-[10px] text-[var(--color-text-tertiary)] bg-transparent border-none cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span>
                    Target: <strong>{stats.goal}</strong> actions/week{" "}
                    <button
                      type="button"
                      onClick={() => setIsEditingGoal(true)}
                      className="text-[10px] text-primary hover:underline bg-transparent border-none cursor-pointer p-0 ml-1 font-semibold"
                    >
                      Edit
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-2.5 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden border border-[var(--color-border-light)]">
              <div
                className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action Counters & Log Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Metric 1: Direct Applications */}
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                  Direct Applications
                </span>
                <span className="text-lg font-bold text-[var(--color-text)] font-mono">
                  {stats.appliedCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleIncrement("applied")}
                className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs border border-primary/25 cursor-pointer transition-colors active:scale-95"
                title="Log +1 completed job application"
              >
                +1 Log
              </button>
            </div>

            {/* Metric 2: Cold DMs Sent */}
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                  Cold Outreach Sent
                </span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {stats.outreachCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleIncrement("outreach")}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/30 cursor-pointer transition-colors active:scale-95"
                title="Log +1 LinkedIn DM or InMail sent"
              >
                +1 Log DM
              </button>
            </div>

            {/* Metric 3: Referrals Requested */}
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                  Referral Chats
                </span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {stats.referralsCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleIncrement("referral")}
                className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs border border-blue-500/25 cursor-pointer transition-colors active:scale-95"
                title="Log +1 referral request initiated"
              >
                +1 Log Ref
              </button>
            </div>
          </div>

          {/* Follow-up Reminders Banner */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-200">
            <span className="text-base shrink-0">⏰</span>
            <div className="leading-relaxed">
              <strong className="text-[var(--color-text)]">Follow-up Cadence:</strong> For applications or DMs sent more than 5 business days ago without a reply, send a gentle 2-sentence follow-up on LinkedIn. 40% of responses come from follow-ups!
            </div>
          </div>

          {/* Daily Sprint Recommendations Preview */}
          {topSprintJobs.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-[var(--color-text-tertiary)] tracking-wider flex items-center gap-1.5">
                  <span>🎯</span> Today&apos;s Sprint Priority Roles
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Top Fit Matches
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topSprintJobs.slice(0, 3).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => onSelectJob?.(job)}
                    className="p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:border-primary/50 flex flex-col justify-between gap-1.5 text-left transition-all cursor-pointer shadow-2xs hover:shadow-xs group w-full"
                    title={`View ${job.title} at ${job.company} in ProxNet`}
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--color-text)] group-hover:text-primary transition-colors truncate">
                        {job.title}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)]">
                        🏢 {job.company}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-[var(--color-border-light)]/40 w-full">
                      {job.score ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {job.score}% Fit
                        </span>
                      ) : (
                        <span className="text-[10px] text-primary font-semibold">Priority</span>
                      )}
                      <span className="text-[10px] text-primary font-bold flex items-center gap-0.5 group-hover:underline">
                        <span>View Role</span>
                        <span>↗</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
