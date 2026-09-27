"use client";

import React, { useState } from "react";
import { LeadingIndicatorCard } from "./LeadingIndicatorCard";

export interface DashboardStatsData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    totalJobs: number;
    freshJobs7d: number;
    totalCarpools: number;
    totalNetworkCompanies: number;
    mappedNetworkCompanies: number;
    unmappedNetworkCompanies: number;
  };
  leadingIndicators: {
    embeddings: {
      readyCount: number;
      missingCount: number;
      coveragePct: number;
      status: "healthy" | "warning" | "critical";
      actionTitle: string;
      endpoint: string;
      method: string;
    };
    atsCoverage: {
      totalNetworkCompanies: number;
      mappedCount: number;
      unmappedCount: number;
      coveragePct: number;
      status: "healthy" | "warning" | "critical";
      actionTitle: string;
      endpoint: string;
      method: string;
    };
    jobFreshness: {
      totalJobs: number;
      freshJobs7d: number;
      freshPct: number;
      latestJobDate: string | null;
      status: "healthy" | "warning";
      actionTitle: string;
      endpoint: string;
      method: string;
    };
    profileCompleteness: {
      completeCount: number;
      incompleteCount: number;
      completenessPct: number;
      status: "healthy" | "warning";
      actionTitle: string;
      endpoint: string;
      method: string;
    };
    geocoding: {
      missingCount: number;
      status: "healthy" | "warning";
      actionTitle: string;
      endpoint: string;
      method: string;
    };
  };
  unmappedCompanies: { name: string; userCount: number }[];
  cronStatus?: any;
}

interface OperationsCockpitProps {
  stats: DashboardStatsData | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onNavigateTab: (tab: "overview" | "ats" | "users" | "broadcast") => void;
}

interface ActionLog {
  id: string;
  time: string;
  action: string;
  status: "success" | "error" | "info";
  message: string;
}

export function OperationsCockpit({ stats, loading, onRefresh, onNavigateTab }: OperationsCockpitProps) {
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActionLog[]>([]);

  function addLog(action: string, status: "success" | "error" | "info", message: string) {
    const newLog: ActionLog = {
      id: Math.random().toString(36).substring(7),
      time: new Date().toLocaleTimeString(),
      action,
      status,
      message,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 19)]);
  }

  // Action Handlers
  async function handleBackfillEmbeddings() {
    setExecutingAction("embeddings");
    addLog("AI Embeddings", "info", "Starting vector embedding generation for users missing embeddings...");
    try {
      const res = await fetch("/api/admin/backfill-embeddings", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog("AI Embeddings", "success", `Successfully generated embeddings for ${data.count || 0} user(s).`);
        await onRefresh();
      } else {
        addLog("AI Embeddings", "error", `Failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      addLog("AI Embeddings", "error", `Error: ${e.message || e}`);
    } finally {
      setExecutingAction(null);
    }
  }

  async function handleSeedAts() {
    setExecutingAction("ats");
    addLog("ATS Discovery", "info", "Scanning and auto-discovering ATS strategies for unmapped network companies...");
    try {
      const res = await fetch("/api/admin/seed-ats", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog("ATS Discovery", "success", data.message || `Processed unmapped company batch.`);
        await onRefresh();
      } else {
        addLog("ATS Discovery", "error", `Failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      addLog("ATS Discovery", "error", `Error: ${e.message || e}`);
    } finally {
      setExecutingAction(null);
    }
  }

  async function handleRunScraper() {
    setExecutingAction("scraper");
    addLog("3-Agent Scraper", "info", "Executing 3-Agent job scraping pipeline (identifying strategies, validating & embedding matching)...");
    try {
      const res = await fetch("/api/admin/scrape-jobs", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog("3-Agent Scraper", "success", `Pipeline run finished. Added ${data.totalAdded || 0} fresh jobs matching candidates in ${(data.durationMs / 1000).toFixed(1)}s.`);
        await onRefresh();
      } else {
        addLog("3-Agent Scraper", "error", `Failed: ${data.error || "Pipeline failed"}`);
      }
    } catch (e: any) {
      addLog("3-Agent Scraper", "error", `Error: ${e.message || e}`);
    } finally {
      setExecutingAction(null);
    }
  }

  async function handleCandidateNudges() {
    setExecutingAction("nudges");
    addLog("Candidate Nudges", "info", "Evaluating candidate profiles against jobs with vector similarity and LLM reranker...");
    try {
      const res = await fetch("/api/admin/nudges", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog("Candidate Nudges", "success", `Nudges sent: ${data.totalNudgesSent || 0} strong match (>=75%) notifications dispatched.`);
      } else {
        addLog("Candidate Nudges", "error", `Failed: ${data.error || "Nudge dispatch failed"}`);
      }
    } catch (e: any) {
      addLog("Candidate Nudges", "error", `Error: ${e.message || e}`);
    } finally {
      setExecutingAction(null);
    }
  }

  async function handleSendProfileReminders() {
    setExecutingAction("reminders");
    addLog("Profile Reminders", "info", "Checking incomplete profiles and dispatching in-app reminders...");
    try {
      const res = await fetch("/api/admin/remind-profiles", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog("Profile Reminders", "success", `Reminders sent to ${data.sent || 0} user(s).`);
        if (data.emails && data.emails.length > 0) {
          const bccList = data.emails.join(",");
          const subject = encodeURIComponent("Complete your ProxNet Profile!");
          const body = encodeURIComponent(
            "Hi there,\n\nYou are missing out on local professional networking opportunities because your ProxNet profile is incomplete. Please complete your profile by adding your name, email, designation, and company name to unlock full access!\n\nBest,\nThe ProxNet Team"
          );
          const mailtoUrl = `mailto:?bcc=${bccList}&subject=${subject}&body=${body}`;
          window.location.href = mailtoUrl;
        }
        await onRefresh();
      } else {
        addLog("Profile Reminders", "error", `Failed: ${data.error || "Reminder failed"}`);
      }
    } catch (e: any) {
      addLog("Profile Reminders", "error", `Error: ${e.message || e}`);
    } finally {
      setExecutingAction(null);
    }
  }

  async function handleBackfillLocations() {
    setExecutingAction("locations");
    addLog("Location Geocoding", "info", "Reverse geocoding GPS coordinates to neighborhood names via Nominatim...");
    try {
      const res = await fetch("/api/admin/backfill-locations");
      const data = await res.json();
      if (res.ok) {
        addLog("Location Geocoding", "success", `Updated ${data.count || 0} user localities to human-readable neighborhood names.`);
        await onRefresh();
      } else {
        addLog("Location Geocoding", "error", `Failed: ${data.error || "Geocoding failed"}`);
      }
    } catch (e: any) {
      addLog("Location Geocoding", "error", `Error: ${e.message || e}`);
    } finally {
      setExecutingAction(null);
    }
  }

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-light)]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-light)]" />
          ))}
        </div>
      </div>
    );
  }

  const ind = stats?.leadingIndicators;
  const summary = stats?.summary;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Executive Health Ribbon */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">System Operations Pulse</h2>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Real-time monitoring of match readiness, company pipeline coverage, and candidate conversion velocity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh Diagnostics
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-[var(--color-border-light)]">
          <div className="bg-[var(--color-surface-hover)]/40 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Total Users</div>
            <div className="text-xl font-extrabold text-[var(--color-text-primary)] mt-1">
              {summary?.totalUsers || 0}
              <span className="text-xs font-normal text-[var(--color-text-secondary)] ml-1.5">({summary?.activeUsers || 0} active)</span>
            </div>
          </div>
          <div className="bg-[var(--color-surface-hover)]/40 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Active Scraped Jobs</div>
            <div className="text-xl font-extrabold text-[var(--color-text-primary)] mt-1">
              {summary?.totalJobs || 0}
              <span className="text-xs font-semibold text-emerald-600 ml-1.5">+{summary?.freshJobs7d || 0} this wk</span>
            </div>
          </div>
          <div className="bg-[var(--color-surface-hover)]/40 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Network Companies</div>
            <div className="text-xl font-extrabold text-[var(--color-text-primary)] mt-1">
              {summary?.totalNetworkCompanies || 0}
              <span className="text-xs font-normal text-[var(--color-text-secondary)] ml-1.5">({summary?.mappedNetworkCompanies || 0} mapped)</span>
            </div>
          </div>
          <div className="bg-[var(--color-surface-hover)]/40 p-3 rounded-xl">
            <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Carpool Community</div>
            <div className="text-xl font-extrabold text-[var(--color-text-primary)] mt-1">
              {summary?.totalCarpools || 0}
              <span className="text-xs font-normal text-[var(--color-text-secondary)] ml-1.5">active posts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leading Indicators 6-Card Matrix */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">Key Leading Indicators & Action Triggers</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Direct administrative levers designed around the core UX principle: <em>Information + Immediate Action</em>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Match Engine Embeddings */}
          <LeadingIndicatorCard
            title="Match Engine Readiness"
            value={`${ind?.embeddings.coveragePct || 0}%`}
            subtitle={`${ind?.embeddings.readyCount || 0} of ${summary?.activeUsers || 0} Users with AI Vector`}
            badge={{
              label: ind?.embeddings.missingCount === 0 ? "Optimal (100%)" : `${ind?.embeddings.missingCount} Missing Vector`,
              variant: ind?.embeddings.status === "healthy" ? "success" : "warning",
            }}
            progressPct={ind?.embeddings.coveragePct}
            rationale="Candidates without OpenAI vector embeddings cannot be matched to candidate referral opportunities or proximity queries."
            actionText={ind?.embeddings.actionTitle || "Generate Embeddings"}
            onAction={handleBackfillEmbeddings}
            loading={executingAction === "embeddings"}
            disabled={ind?.embeddings.missingCount === 0}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            }
          />

          {/* 2. Target Company ATS Coverage */}
          <LeadingIndicatorCard
            title="ATS Pipeline Coverage"
            value={`${ind?.atsCoverage.coveragePct || 0}%`}
            subtitle={`${ind?.atsCoverage.mappedCount || 0} of ${ind?.atsCoverage.totalNetworkCompanies || 0} Companies Mapped`}
            badge={{
              label: ind?.atsCoverage.unmappedCount === 0 ? "Full Coverage" : `${ind?.atsCoverage.unmappedCount} Unmapped`,
              variant: (ind?.atsCoverage.unmappedCount || 0) <= 5 ? "success" : "warning",
            }}
            progressPct={ind?.atsCoverage.coveragePct}
            rationale="Unmapped network companies create dead zones where candidates receive zero peer job matches."
            actionText={ind?.atsCoverage.actionTitle || "Auto-Discover & Seed ATS"}
            onAction={handleSeedAts}
            loading={executingAction === "ats"}
            secondaryActionText="View Details →"
            onSecondaryAction={() => onNavigateTab("ats")}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            }
          />

          {/* 3. Job Velocity & Freshness */}
          <LeadingIndicatorCard
            title="Job Freshness Velocity"
            value={`${ind?.jobFreshness.freshJobs7d || 0}`}
            subtitle={`${ind?.jobFreshness.freshPct || 0}% fresh jobs added in last 7 days`}
            badge={{
              label: (ind?.jobFreshness.freshJobs7d || 0) > 50 ? "Active Inflow" : "Stale Warning",
              variant: (ind?.jobFreshness.freshJobs7d || 0) > 50 ? "success" : "warning",
            }}
            progressPct={ind?.jobFreshness.freshPct}
            rationale="Fresh job postings drive candidate return visits and high referral conversation velocity."
            actionText={ind?.jobFreshness.actionTitle || "Run 3-Agent Scraper"}
            onAction={handleRunScraper}
            loading={executingAction === "scraper"}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            }
          />

          {/* 4. Candidate Match Nudge Queue */}
          <LeadingIndicatorCard
            title="Candidate Match Nudge Queue"
            value=">=75% Match"
            subtitle="AI Reranked High-Probability Matches"
            badge={{
              label: "Ready to Dispatch",
              variant: "info",
            }}
            rationale="Candidates who receive timely match alerts have an 8x higher response and peer referral rate."
            actionText="Dispatch Candidate Job Nudges"
            onAction={handleCandidateNudges}
            loading={executingAction === "nudges"}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5" />
              </svg>
            }
          />

          {/* 5. Profile Completion Bottleneck */}
          <LeadingIndicatorCard
            title="Profile Activation Bottleneck"
            value={`${ind?.profileCompleteness.completenessPct || 0}%`}
            subtitle={`${ind?.profileCompleteness.incompleteCount || 0} Incomplete Profiles`}
            badge={{
              label: (ind?.profileCompleteness.incompleteCount || 0) === 0 ? "100% Complete" : `${ind?.profileCompleteness.incompleteCount} Incomplete`,
              variant: (ind?.profileCompleteness.incompleteCount || 0) <= 10 ? "success" : "warning",
            }}
            progressPct={ind?.profileCompleteness.completenessPct}
            rationale="Incomplete profiles drop out of discovery; users need name, role, company & contact to connect."
            actionText={ind?.profileCompleteness.actionTitle || "Send Profile Reminders"}
            onAction={handleSendProfileReminders}
            loading={executingAction === "reminders"}
            disabled={(ind?.profileCompleteness.incompleteCount || 0) === 0}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A9.642 9.642 0 0018 20c1.371 0 2.684-.28 3.879-.783M15 8.25a3 3 0 11-6 0 3 3 0 016 0zM8.625 15.429a3.375 3.375 0 00-3.375 3.375 9.75 9.75 0 00.912 4.113M11.378 14.885a11.53 11.53 0 014.244 0M11.378 14.885a3.375 3.375 0 00-3.375 3.375M11.378 14.885V18a3.375 3.375 0 003.375 3.375H18" />
              </svg>
            }
          />

          {/* 6. Location Geocoding Health */}
          <LeadingIndicatorCard
            title="Locality Geocoding Health"
            value={(ind?.geocoding.missingCount || 0) === 0 ? "100%" : `${ind?.geocoding.missingCount} Missing`}
            subtitle="Reverse geocode GPS to neighborhood names"
            badge={{
              label: (ind?.geocoding.missingCount || 0) === 0 ? "Optimal" : `${ind?.geocoding.missingCount} Need Geocode`,
              variant: (ind?.geocoding.missingCount || 0) === 0 ? "success" : "info",
            }}
            progressPct={(ind?.geocoding.missingCount || 0) === 0 ? 100 : 85}
            rationale="Neighborhood locality names (e.g. Indiranagar, HSR) make local peer discovery relatable and accurate."
            actionText={ind?.geocoding.actionTitle || "Backfill Locality Names"}
            onAction={handleBackfillLocations}
            loading={executingAction === "locations"}
            disabled={(ind?.geocoding.missingCount || 0) === 0}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Operations Console / Live Execution Logs */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">💻</span>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Operations Execution Log</h3>
            <span className="badge badge-primary text-[10px] px-1.5 py-0.2">Live Session</span>
          </div>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              Clear log
            </button>
          )}
        </div>

        <div className="bg-[var(--color-bg)] border border-[var(--color-border-light)] rounded-xl p-3.5 font-mono text-xs max-h-48 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-[var(--color-text-tertiary)] italic py-2">
              Ready. Click any action button above (Generate Embeddings, Seed ATS, Run Scraper, etc.) to view real-time execution results.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5">
                <span className="text-[var(--color-text-tertiary)] shrink-0 font-sans">[{log.time}]</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    log.status === "success"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : log.status === "error"
                      ? "bg-rose-500/10 text-rose-600"
                      : "bg-blue-500/10 text-blue-600"
                  }`}
                >
                  {log.action}
                </span>
                <span className="text-[var(--color-text-secondary)] break-words flex-1">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
