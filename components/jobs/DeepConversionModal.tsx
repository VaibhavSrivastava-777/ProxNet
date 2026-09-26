"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ConversionBlueprint } from "@/lib/jobs/deep-conversion-miner";

interface DeepConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: number;
  hasResume: boolean;
  onBlueprintsFetched: (blueprints: ConversionBlueprint[], newWallet: number) => void;
  onOpenResumeUpload?: () => void;
}

interface MiningPhase {
  id: number;
  title: string;
  subtitle: string;
  triggerSecond: number; // when this phase becomes active
}

const PHASES: MiningPhase[] = [
  {
    id: 1,
    title: "Candidate Profile & Resume Ingestion",
    subtitle: "Analyzing leadership experience, tenure, domain skills & candidate preferences...",
    triggerSecond: 0,
  },
  {
    id: 2,
    title: "Dynamic Target & Peer Ecosystem Discovery",
    subtitle: "Mapping target companies and industry competitors matched to candidate domain...",
    triggerSecond: 4,
  },
  {
    id: 3,
    title: "Live Enterprise ATS & Career Portal Crawling",
    subtitle: "Fetching real-time openings directly from target ATS boards, Workday & verified feeds...",
    triggerSecond: 10,
  },
  {
    id: 4,
    title: "Conversion Playbook & Action Plan Synthesis",
    subtitle: "Synthesizing custom resume anchors, ATS keyword optimization & interview objection handlers...",
    triggerSecond: 18,
  },
  {
    id: 5,
    title: "Warm Insider Mapping & Pitch Drafting",
    subtitle: "Identifying ProxNet community insiders, alumni bridges & crafting high-conversion outreach notes...",
    triggerSecond: 28,
  },
];

export function DeepConversionModal({
  isOpen,
  onClose,
  wallet,
  hasResume,
  onBlueprintsFetched,
  onOpenResumeUpload,
}: DeepConversionModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState(100);
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const [completedPhaseIds, setCompletedPhaseIds] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<ConversionBlueprint[] | null>(null);
  const [opportunityCount, setOpportunityCount] = useState<number>(1);
  const [creditsExpended, setCreditsExpended] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<number, "x" | "y" | "z">>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Handle Escape key to close modal anytime
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle 100s Countdown & Phase Progression
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = Math.max(0, 100 - elapsedSec);
        setCountdown(remaining);

        // Update active and completed phases
        const currentPhaseIdx = PHASES.findIndex((p, idx) => {
          const nextTrigger = PHASES[idx + 1]?.triggerSecond ?? 100;
          return elapsedSec >= p.triggerSecond && elapsedSec < nextTrigger;
        });

        if (currentPhaseIdx !== -1) {
          setActivePhaseIndex(currentPhaseIdx);
          const completed = PHASES.slice(0, currentPhaseIdx).map((p) => p.id);
          setCompletedPhaseIds(completed);
        } else if (elapsedSec >= 100) {
          setActivePhaseIndex(PHASES.length - 1);
          setCompletedPhaseIds(PHASES.map((p) => p.id));
        }
      }, 500);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isRunning]);

  // Handle Escape key to dismiss modal & lock background scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleStartMining = async () => {
    if (!hasResume) {
      if (onOpenResumeUpload) {
        onClose();
        onOpenResumeUpload();
      } else {
        alert("Please upload your resume first to run the Deep Career Conversion Miner.");
      }
      return;
    }

    setIsRunning(true);
    setCountdown(100);
    setActivePhaseIndex(0);
    setCompletedPhaseIds([]);
    setErrorMsg("");
    setResults(null);

    try {
      const res = await fetch("/api/jobs/deep-conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityCount }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "NO_RESUME") {
          setErrorMsg("Please upload your resume to run the conversion miner.");
        } else {
          setErrorMsg(data.message || data.error || "Failed to complete deep conversion run.");
        }
        setIsRunning(false);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);

      // Smoothly complete remaining phases with visible ticks
      const blueprints: ConversionBlueprint[] = data.blueprints || [];
      for (let p = 1; p <= PHASES.length; p++) {
        setCompletedPhaseIds((prev) => Array.from(new Set([...prev, p])));
        setActivePhaseIndex(p);
        await new Promise((r) => setTimeout(r, 200));
      }

      setCountdown(0);
      setResults(blueprints);
      if (data.creditsExpended !== undefined) {
        setCreditsExpended(data.creditsExpended);
      }
      setIsRunning(false);

      if (data.remainingWallet !== undefined) {
        onBlueprintsFetched(blueprints, data.remainingWallet);
      }
    } catch (err: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      const msg = err instanceof Error ? err.message : "Network error during deep conversion mining.";
      setErrorMsg(msg);
      setIsRunning(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const toggleTab = (jobIndex: number, tab: "x" | "y" | "z") => {
    setActiveTabMap((prev) => ({ ...prev, [jobIndex]: tab }));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xl overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] sm:h-[84dvh] sm:max-h-[84dvh] text-[var(--color-text)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header - Permanently Fixed at Top */}
        <div className="flex-none shrink-0 p-3 sm:p-4 border-b border-[var(--color-border-light)] flex items-center justify-between bg-[var(--color-surface)] z-30 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 text-white flex items-center justify-center text-lg sm:text-xl shadow-md shrink-0">
              🎯
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[var(--color-text)] truncate">
                  Deep Career Conversion Miner
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20 shrink-0">
                  3 Credits / Role
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] truncate">
                Recursive opportunity discovery & strategic conversion roadmaps
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs active:scale-95 group"
            title="Close (Esc)"
            aria-label="Close modal"
          >
            <span className="text-xs font-bold hidden sm:inline">Close</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:scale-110 transition-transform">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Modal Body - Strictly Scrollable between Header and Footer */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-5 text-xs text-[var(--color-text)] flex-1 min-h-0">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-medium">
              {errorMsg}
            </div>
          )}

          {/* STATE 1: ACTIVE MINING WITH PHASES TICKS & 100S COUNTDOWN */}
          {isRunning && (
            <div className="py-4 space-y-6 animate-fadeIn">
              {/* Prominent Countdown Header */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-[var(--color-surface-secondary)] to-emerald-500/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold animate-pulse">
                    ⏱️
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                      Autonomous Deep Run In Progress
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold text-[var(--color-text)]">
                      Tentative Finish in ~{countdown}s
                    </span>
                  </div>
                </div>

                <div className="w-full sm:w-48 space-y-1.5 text-right">
                  <div className="flex justify-between text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    <span>Overall Progress</span>
                    <span>{Math.min(100, Math.round(((100 - countdown) / 100) * 100))}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--color-border-light)] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(100, ((100 - countdown) / 100) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Phased Execution Checklist with Green Ticks */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
                  Active Execution Phases:
                </h4>

                <div className="space-y-2">
                  {PHASES.map((phase, idx) => {
                    const isCompleted = completedPhaseIds.includes(phase.id);
                    const isActive = activePhaseIndex === idx && !isCompleted;

                    return (
                      <div
                        key={phase.id}
                        className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                          isCompleted
                            ? "bg-emerald-500/5 border-emerald-500/30 text-[var(--color-text)]"
                            : isActive
                            ? "bg-primary/5 border-primary/40 shadow-xs text-[var(--color-text)]"
                            : "bg-[var(--color-surface)] border-[var(--color-border-light)] opacity-50 text-[var(--color-text-tertiary)]"
                        }`}
                      >
                        {/* Status Icon / Tick */}
                        <div className="pt-0.5 shrink-0">
                          {isCompleted ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs animate-scaleUp">
                              ✓
                            </div>
                          ) : isActive ? (
                            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-[var(--color-border-light)] flex items-center justify-center text-[10px] text-[var(--color-text-tertiary)]">
                              {phase.id}
                            </div>
                          )}
                        </div>

                        {/* Phase Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold ${
                                isCompleted
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : isActive
                                  ? "text-primary"
                                  : "text-[var(--color-text-secondary)]"
                              }`}
                            >
                              Phase {phase.id}: {phase.title}
                            </span>
                            {isCompleted && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                Completed ✓
                              </span>
                            )}
                            {isActive && (
                              <span className="text-[10px] font-bold text-primary shrink-0 animate-pulse">
                                Running...
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                            {phase.subtitle}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: RESULTS VIEW (EXECUTIVE DOSSIER BLUEPRINTS) */}
          {!isRunning && results && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🏆</span>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm">
                      Conversion Blueprints Ready ({results.length} {results.length === 1 ? "Opportunity" : "Opportunities"})
                    </h3>
                    <p className="text-[11px] opacity-90">
                      {creditsExpended !== null ? (
                        <span>🪙 Expended {creditsExpended} Credits (strictly 3 credits × {results.length} {results.length === 1 ? "role" : "roles"} unearthed) • Actionable roadmaps & connectors ready.</span>
                      ) : (
                        <span>Tailored resume anchors, ATS keywords and interview roadmaps generated.</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartMining}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shrink-0 cursor-pointer"
                >
                  Re-Mine
                </button>
              </div>

              {/* Blueprints List */}
              <div className="space-y-4">
                {results.map((bp, bIdx) => {
                  const activeTab = activeTabMap[bIdx] || "x";
                  const isProxNet = bp.connector.type === "proxnet";

                  return (
                    <div
                      key={bp.jobId || bIdx}
                      className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-xs overflow-hidden transition-all hover:border-primary/40 space-y-3 p-4"
                    >
                      {/* Job Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-border-light)]">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs">
                              {bp.company}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-[var(--color-text)]">
                              {bp.title}
                            </span>
                            {bp.reqId && (
                              <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)] px-1.5 py-0.5 rounded font-mono">
                                Req #{bp.reqId}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--color-text-secondary)] block mt-0.5">
                            📍 {bp.location}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border border-emerald-500/20">
                            {bp.matchScore}% Match
                          </span>
                          <a
                            href={bp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-[var(--color-surface-secondary)] hover:bg-primary hover:text-white text-[var(--color-text)] font-semibold text-xs border border-[var(--color-border-light)] transition-all flex items-center gap-1"
                          >
                            <span>Apply</span>
                            <span>↗</span>
                          </a>
                        </div>
                      </div>

                      {/* Why this opportunity */}
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed italic bg-[var(--color-surface-secondary)]/40 p-2.5 rounded-lg border border-[var(--color-border-light)]/60">
                        &quot;{bp.whyThisOpportunity}&quot;
                      </p>

                      {/* Strategy Tabs */}
                      <div className="space-y-2">
                        <div className="flex border-b border-[var(--color-border-light)] gap-1">
                          <button
                            type="button"
                            onClick={() => toggleTab(bIdx, "x")}
                            className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all cursor-pointer ${
                              activeTab === "x"
                                ? "border-primary text-primary"
                                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                            }`}
                          >
                            🎯 Resume Hook
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTab(bIdx, "y")}
                            className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all cursor-pointer ${
                              activeTab === "y"
                                ? "border-primary text-primary"
                                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                            }`}
                          >
                            ⚙️ ATS Keyword Optimization
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTab(bIdx, "z")}
                            className={`px-3 py-1.5 font-bold text-[11px] border-b-2 transition-all cursor-pointer ${
                              activeTab === "z"
                                ? "border-primary text-primary"
                                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                            }`}
                          >
                            🎙️ Interview Pitch & Strategy
                          </button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)]/50 border border-[var(--color-border-light)] text-[11px] space-y-2">
                          {activeTab === "x" && (
                            <div>
                              <span className="font-bold text-[var(--color-text)] block">
                                {bp.focusX.title}
                              </span>
                              <p className="text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                                {bp.focusX.description}
                              </p>
                            </div>
                          )}

                          {activeTab === "y" && (
                            <div className="space-y-2">
                              <span className="font-bold text-[var(--color-text)] block">
                                {bp.focusY.title}
                              </span>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {bp.focusY.keywordsToAdd.map((kw, kwIdx) => (
                                  <span
                                    key={kwIdx}
                                    className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[10px] font-semibold border border-primary/20"
                                  >
                                    +{kw}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                                {bp.focusY.description}
                              </p>
                            </div>
                          )}

                          {activeTab === "z" && (
                            <div className="space-y-2">
                              <div>
                                <span className="font-bold text-[var(--color-text)] block">
                                  {bp.focusZ.title}
                                </span>
                                <div className="mt-1 p-2 rounded bg-primary/5 border-l-2 border-primary text-[var(--color-text)] font-medium italic">
                                  &quot;{bp.focusZ.interviewPitch}&quot;
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] block">
                                  Objection Handler:
                                </span>
                                <p className="text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                                  {bp.focusZ.objectionHandler}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warm Connector Card (Mr. A) */}
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{isProxNet ? "🟢" : "🔵"}</span>
                            <span className="font-bold text-xs text-[var(--color-text)]">
                              {bp.connector.connectionPath}
                            </span>
                          </div>

                          {!isProxNet && bp.connector.linkedinAlumniUrl && (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={bp.connector.linkedinAlumniUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded bg-[#0077b5]/15 text-[#0077b5] dark:text-[#00a0dc] font-bold text-[10px] border border-[#0077b5]/30 hover:bg-[#0077b5] hover:text-white transition-all"
                              >
                                Alumni Search ↗
                              </a>
                              <a
                                href={bp.connector.linkedinSearchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded bg-[#0077b5]/15 text-[#0077b5] dark:text-[#00a0dc] font-bold text-[10px] border border-[#0077b5]/30 hover:bg-[#0077b5] hover:text-white transition-all"
                              >
                                Leaders ↗
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Pre-Drafted Outreach Note */}
                        <div className="relative p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] text-[11px] font-mono text-[var(--color-text-secondary)] leading-relaxed">
                          <div className="pr-16">{bp.connector.outreachMessage}</div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(bp.connector.outreachMessage, bIdx)}
                            className="absolute top-2 right-2 px-2 py-1 rounded bg-primary text-white font-bold text-[10px] shadow-xs hover:opacity-90 active:scale-95 transition-all"
                          >
                            {copiedIndex === bIdx ? "Copied! ✓" : "Copy Note"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* End of Dossier Action Card */}
                <div className="p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left mt-4">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text)]">
                      Finished reviewing your conversion blueprints?
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                      These roles and roadmaps are now saved in your opportunities feed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>✕ Close Dossier</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: PRE-RUN CONFIGURATION VIEW */}
          {!isRunning && !results && (
            <div className="space-y-5 animate-fadeIn">
              {/* Resume Check Alert */}
              {!hasResume && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <span>No resume linked. Resume is required for deep conversion synthesis.</span>
                  </div>
                  {onOpenResumeUpload && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenResumeUpload();
                      }}
                      className="px-3 py-1 rounded-lg bg-amber-500 text-white font-semibold text-xs shrink-0 hover:bg-amber-600 transition-colors"
                    >
                      Upload Resume
                    </button>
                  )}
                </div>
              )}

              {/* Opportunity Target Selector (3 Credits / Opportunity) */}
              <div className="p-4 rounded-xl border border-[var(--color-border-light)] bg-gradient-to-br from-[var(--color-surface-secondary)]/50 to-[var(--color-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                      Target Opportunity Quota
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-[var(--color-text)]">
                      How many high-conviction roles to mine?
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Strict 3 Cr / Role
                  </span>
                </div>

                {/* Option buttons: 1, 2, 3, 5 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { count: 1, label: "1 Role", credits: 3, badge: "Quick" },
                    { count: 2, label: "2 Roles", credits: 6, badge: "Popular" },
                    { count: 3, label: "3 Roles", credits: 9, badge: "Deep" },
                    { count: 5, label: "5 Roles", credits: 15, badge: "Executive" },
                  ].map((tier) => {
                    const isSelected = opportunityCount === tier.count;
                    return (
                      <button
                        key={tier.count}
                        type="button"
                        onClick={() => setOpportunityCount(tier.count)}
                        className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40 text-[var(--color-text)]"
                            : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-primary/40 text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-bold ${isSelected ? "text-primary" : ""}`}>
                            {tier.label}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            isSelected ? "bg-primary text-white" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]"
                          }`}>
                            {tier.badge}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-sm font-extrabold text-[var(--color-text)]">
                            {tier.credits}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            Credits
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Fair Billing Guarantee Notice */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <span className="text-sm shrink-0">🛡️</span>
                  <span>
                    <strong>Fair Billing Guarantee:</strong> You are charged strictly <strong>3 credits per opportunity unearthed</strong>. If fewer matching peer opportunities are discovered, you will only be charged for what is actually unearthed ({opportunityCount * 3} max).
                  </span>
                </div>
              </div>

              {/* Wallet Credits & Cost Card */}
              <div className="p-4 rounded-xl border border-[var(--color-border-light)] bg-gradient-to-br from-[var(--color-surface-secondary)]/60 to-[var(--color-surface)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider">
                    Available Wallet Balance
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-1.5 mt-0.5">
                    <span>🪙</span>
                    <span>{wallet} Credits</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs ${
                    wallet >= opportunityCount * 3
                      ? "bg-primary/10 border border-primary/20 text-primary"
                      : "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
                  }`}>
                    <span>Target Cost: {opportunityCount * 3} Credits</span>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-1">
                    {opportunityCount} {opportunityCount === 1 ? "role" : "roles"} × 3 credits each
                  </span>
                </div>
              </div>

              {/* What This Run Delivers */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  What This 100-Second Autonomous Run Delivers:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/30 space-y-1">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <span>🌐</span>
                      <span>Target & Peer Ecosystem Mining</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                      Scrapes live career boards of your target companies and industry competitors matched to your exact domain.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/30 space-y-1">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      <span>🎯</span>
                      <span>Resume Anchor (Hook)</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                      Identifies the exact leadership project from your CV to lead with to solve the hiring manager&apos;s primary challenge.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/30 space-y-1">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      <span>⚙️</span>
                      <span>ATS Keyword Optimization</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                      Injects high-yield domain terminology, frameworks, and metrics to reach 95%+ ATS parsing accuracy.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/30 space-y-1">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <span>🤝</span>
                      <span>Mr. A Connection Bridge</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                      Maps verified ProxNet insiders or LinkedIn alumni/leaders with a pre-crafted 300-char outreach pitch.
                    </p>
                  </div>
                </div>
              </div>

              {/* Execution Notice */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] flex items-start gap-2 leading-relaxed">
                <span className="text-base leading-none">ℹ️</span>
                <span>
                  This is a deep autonomous synthesis rather than an instant cached filter. The run takes approximately <strong>35–100 seconds</strong> to query external ATS boards and run multi-step AI reasoning.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Modal Footer - Permanently Fixed at Bottom, Always Visible */}
        <div className="flex-none shrink-0 p-3 sm:p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface)] z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
          {isRunning ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary min-w-0 truncate">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-ping shrink-0" />
                <span className="truncate">Mining {opportunityCount} {opportunityCount === 1 ? "Role" : "Roles"} (~{countdown}s remaining)...</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-surface-hover)] transition-colors text-xs cursor-pointer shrink-0"
              >
                Close & Run in Background
              </button>
            </>
          ) : results ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Close Dossier</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResults(null);
                  setOpportunityCount(1);
                }}
                className="px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <span>⚡</span>
                <span>Mine More Roles</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[var(--color-border-light)] text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-surface-hover)] transition-colors text-xs cursor-pointer shrink-0"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!hasResume || (wallet !== null && wallet !== undefined && wallet < opportunityCount * 3)}
                onClick={handleStartMining}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shrink-0"
              >
                <span>🚀</span>
                <span>Launch Deep Conversion Run ({opportunityCount * 3} Credits)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
