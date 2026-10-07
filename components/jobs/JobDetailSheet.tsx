"use client";

import { useState, useEffect } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { openExternalUrl, handleExternalLinkClick } from "@/lib/external-links";

export interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  posted_at?: string;
  experience?: string;
  matchRate: number;
  keywords?: string[];
  contactsCount?: number;
  referralContacts?: Array<{ id: string; alias: string; is_followed?: boolean }>;
  matchedSkills?: string[];
  missingSkills?: string[];
  skillCoveragePercent?: number;
  score?: number;
  label?: string;
  reason?: string;
}

export interface PreparationData {
  jobId: string;
  company: string;
  title: string;
  location?: string;
  matchScore: number;
  strengths: string[];
  weaknesses: string[];
  roleExpectations: string[];
  networkingPath: {
    proxnetInsiders: Array<{
      id: string;
      name: string;
      jobTitle: string;
      company: string;
      distanceKm: number | null;
      photoUrl: string | null;
    }>;
    hasProxnetInsiders: boolean;
    linkedinSearchUrl: string;
    customPitch: string;
  };
  jobDescription?: string;
  preparedAt: string;
}

export function cleanJobDescription(raw: string): string {
  if (!raw) return "No full job description provided by the ATS. Click 'Apply Directly' to view on official career site.";

  let text = raw;
  // Convert break and block tags to appropriate line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n\n");
  text = text.replace(/<li[^>]*>/gi, "• ");
  text = text.replace(/<\/li>/gi, "\n");

  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&bull;/gi, "•")
    .replace(/&middot;/gi, "·")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–");

  // Clean excessive spaces and multiple blank lines
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n\s*\n+/g, "\n\n");
  return text.trim();
}

function CreditDeductionBanner({
  prevBalance,
  newBalance,
  onClose,
}: {
  prevBalance: number;
  newBalance: number;
  onClose: () => void;
}) {
  const [animatedBalance, setAnimatedBalance] = useState(prevBalance);
  const [isDeducted, setIsDeducted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setAnimatedBalance(newBalance);
      setIsDeducted(true);
    }, 450);
    return () => clearTimeout(t);
  }, [newBalance]);

  useEffect(() => {
    const autoCloseTimer = setTimeout(() => {
      onClose();
    }, 8500);
    return () => clearTimeout(autoCloseTimer);
  }, [onClose]);

  return (
    <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 shadow-md animate-fadeIn">
      {/* Top row: Animation and dismiss cross button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-xl shrink-0 font-bold shadow-inner">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                1 Credit Deducted
              </span>
              <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-white animate-pulse">
                -1 ⚡
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Wallet Balance:</span>
              <div className="flex items-center gap-1 font-extrabold text-base text-[var(--color-text)]">
                <span className={`transition-all duration-500 ${isDeducted ? "line-through text-red-500/70 scale-95" : "text-amber-500 font-bold"}`}>
                  {prevBalance}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">➔</span>
                <span className={`transition-all duration-500 ${isDeducted ? "text-emerald-500 scale-110 font-black" : "text-[var(--color-text)]"}`}>
                  {animatedBalance} ⚡
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cross button */}
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors flex items-center justify-center border-none cursor-pointer shrink-0"
          aria-label="Close notification"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Ways to earn more credits */}
      <div className="mt-3 pt-3 border-t border-amber-500/20">
        <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1.5 flex items-center gap-1.5">
          <span>💡</span>
          <span>Ways to increase your credit points:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
            <span>👤</span>
            <span>Complete profile sections <strong>(+5 ⚡)</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
            <span>🤝</span>
            <span>Invite colleagues & neighbors <strong>(+10 ⚡)</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
            <span>💬</span>
            <span>Answer questions in Forum <strong>(+2 ⚡)</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
            <span>🔥</span>
            <span>Daily check-in streak <strong>(+1 ⚡)</strong></span>
          </div>
        </div>
      </div>

      {/* Auto-closing animated progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/20 overflow-hidden">
        <div 
          className="h-full bg-amber-500" 
          style={{ 
            animation: "autoCloseCountdown 8.5s linear forwards",
          }} 
        />
      </div>
      <style jsx>{`
        @keyframes autoCloseCountdown {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
}

interface JobDetailSheetProps {
  job: JobItem | null;
  isOpen: boolean;
  onClose: () => void;
  userWallet: number;
  onWalletUpdated?: (newBalance: number) => void;
  cachedPreparation?: PreparationData | null;
  initialTab?: "overview" | "prepare";
}

export function JobDetailSheet({
  job,
  isOpen,
  onClose,
  userWallet,
  onWalletUpdated,
  cachedPreparation,
  initialTab,
}: JobDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "prepare">(initialTab || (cachedPreparation ? "prepare" : "overview"));
  const [preparing, setPreparing] = useState(false);
  const [preparation, setPreparation] = useState<PreparationData | null>(cachedPreparation || null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedBridgeNote, setCopiedBridgeNote] = useState(false);
  const [directApplied, setDirectApplied] = useState(false);
  const [creditDeductionInfo, setCreditDeductionInfo] = useState<{ prev: number; current: number } | null>(null);
  const [linkNotice, setLinkNotice] = useState<{ message: string; url?: string } | null>(null);
  const [checkingLink, setCheckingLink] = useState(false);

  useEffect(() => {
    if (cachedPreparation) {
      setPreparation(cachedPreparation);
      setActiveTab(initialTab || "prepare");
    } else {
      setPreparation(null);
      setActiveTab(initialTab || "overview");
    }
    setPrepareError(null);
    setDirectApplied(false);
    setCreditDeductionInfo(null);
    setLinkNotice(null);
  }, [job, cachedPreparation, initialTab]);

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

  if (!isOpen || !job) return null;

  const handlePrepareMe = async () => {
    if (preparation) {
      setActiveTab("prepare");
      return;
    }

    if (userWallet < 1) {
      setPrepareError("You need at least 1 credit to generate your preparation playbook. Recharge or complete profile steps to earn credits!");
      return;
    }

    setPreparing(true);
    setPrepareError(null);

    try {
      const res = await fetch("/api/jobs/prepare-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          company: job.company,
          title: job.title,
          description: cleanJobDescription(job.description),
          url: job.url,
          location: job.location,
          matchScore: job.matchRate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to generate preparation playbook.");
      }

      if (data.liveDescription) {
        job.description = data.liveDescription;
      }

      setPreparation(data.preparation);
      setActiveTab("prepare");

      if (typeof data.newWalletBalance === "number" && onWalletUpdated) {
        onWalletUpdated(data.newWalletBalance);
        window.dispatchEvent(
          new CustomEvent("proxnet:wallet-updated", { detail: { newBalance: data.newWalletBalance } })
        );

        if (!data.alreadyPrepared) {
          const prevBal = typeof userWallet === "number" && userWallet > 0 ? userWallet : (data.newWalletBalance + 1);
          setCreditDeductionInfo({
            prev: prevBal,
            current: data.newWalletBalance,
          });
        }
      }

      // Notify other tabs that an application was saved/prepared
      window.dispatchEvent(new CustomEvent("job_application_updated"));
    } catch (err: any) {
      setPrepareError(err.message || "An unexpected error occurred.");
    } finally {
      setPreparing(false);
    }
  };

  const handleApplyDirectly = async () => {
    if (!job.url) return;

    setCheckingLink(true);
    setLinkNotice(null);

    let finalUrlToOpen = job.url;
    try {
      const checkRes = await fetch(
        `/api/jobs/check-link?url=${encodeURIComponent(job.url)}&company=${encodeURIComponent(job.company)}&title=${encodeURIComponent(job.title)}&jobId=${encodeURIComponent(job.id)}`
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.isExpired) {
          setLinkNotice({
            message: `This opportunity is no longer available on the employer's career site (${checkData.reason}).`,
            url: checkData.fallbackUrl,
          });
          setCheckingLink(false);
          return;
        }

        if (checkData.description && !job.description) {
          job.description = checkData.description;
        }
      }
    } catch {}

    setCheckingLink(false);

    // 1. Open official active job opportunity in external browser/new window
    openExternalUrl(finalUrlToOpen);

    setDirectApplied(true);

    // 2. Persist to job_applications pipeline preserving any existing preparation notes
    try {
      await fetch("/api/jobs/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          company: job.company,
          jobTitle: job.title,
          jobUrl: job.url,
          stage: "applied",
          matchScore: job.matchRate,
          notes: JSON.stringify({
            ...(preparation || cachedPreparation || {}),
            appliedDirectlyAt: new Date().toISOString(),
            sourceUrl: job.url,
            location: job.location,
            isPrepared: Boolean(preparation || cachedPreparation),
          }),
        }),
      });
      window.dispatchEvent(new CustomEvent("job_application_updated"));
    } catch (e) {
      console.warn("Failed to record direct application:", e);
    }
  };

  const copyOutreachPitch = () => {
    if (!preparation?.networkingPath?.customPitch) return;
    navigator.clipboard.writeText(preparation.networkingPath.customPitch);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  const matchColor =
    job.matchRate >= 90
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
      : job.matchRate >= 75
      ? "text-blue-500 bg-blue-500/10 border-blue-500/30"
      : "text-amber-500 bg-amber-500/10 border-amber-500/30";

  return (
    <div
      className="fixed inset-0 z-[100000] flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-6 overflow-y-auto pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[calc(100dvh-3rem)] my-auto rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-50 shrink-0 bg-[var(--color-surface)]/98 backdrop-blur-md border-b border-[var(--color-border-light)] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-sm">
              <CompanyLogo company={job.company} className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate m-0">
                {job.title}
              </h2>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] truncate m-0">
                {job.company} &bull; <span className="font-normal">{job.location}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] shadow-sm transition-all cursor-pointer shrink-0 hover:scale-105 active:scale-95"
            aria-label="Close modal"
            title="Close (Esc)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto overscroll-contain">
          {/* Metadata badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${matchColor}`}>
              🎯 {job.matchRate}% Match
            </span>
            {job.experience && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
                💼 {job.experience}
              </span>
            )}
            {job.posted_at && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
                🕒 {job.posted_at}
              </span>
            )}
            {job.location && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
                📍 {job.location}
              </span>
            )}
            {preparation && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                ⚡ Prepared Playbook Unlocked
              </span>
            )}
          </div>

          {/* Action Callout Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[var(--color-primary-subtle)]/30 to-[var(--color-surface-secondary)] border border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--color-text)]">Take Action</span>
                {directApplied && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ✓ Recorded to Applied
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
                Prepare for this specific interview (1 ⚡) or apply on the official ATS board.
              </p>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={handlePrepareMe}
                disabled={preparing}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-105 active:scale-95 transition-all shadow-sm cursor-pointer border-none disabled:opacity-50"
              >
                {preparing ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Analyzing...</span>
                  </>
                ) : preparation ? (
                  <>
                    <span>⚡</span> View Playbook
                  </>
                ) : (
                  <>
                    <span>⚡</span> Prepare Me (1 ⚡)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleApplyDirectly}
                disabled={checkingLink}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:scale-95 transition-all shadow-sm cursor-pointer border-none disabled:opacity-75"
              >
                {checkingLink ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    <span>Verifying Link...</span>
                  </>
                ) : (
                  <>
                    <span>Apply Directly</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {linkNotice && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex flex-col gap-1.5 animate-fadeIn">
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0">⚠️</span>
                <span className="font-semibold leading-relaxed">{linkNotice.message}</span>
              </div>
              {linkNotice.url && (
                <div className="pl-6 pt-0.5">
                  <a
                    href={linkNotice.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-amber-700 dark:text-amber-300 hover:opacity-80"
                  >
                    Open Live Requisitions on Google Search &rarr;
                  </a>
                </div>
              )}
            </div>
          )}

          {creditDeductionInfo && (
            <CreditDeductionBanner
              prevBalance={creditDeductionInfo.prev}
              newBalance={creditDeductionInfo.current}
              onClose={() => setCreditDeductionInfo(null)}
            />
          )}

          {prepareError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
              ⚠️ {prepareError}
            </div>
          )}

          {/* Sub Tabs: Overview vs Prepare Me Playbook (Always visible) */}
          <div className="flex border-b border-[var(--color-border-light)] gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer bg-transparent border-none ${
                activeTab === "overview"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              📋 Job Description
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prepare")}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5 ${
                activeTab === "prepare"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400"
                  : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              <span>⚡</span>
              <span>Prepared Playbook</span>
              {preparation ? (
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Ready
                </span>
              ) : (
                <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
                  (1 ⚡)
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-5">
              {/* Method 1: Hard Skill & Tooling Coverage */}
              {((job.matchedSkills && job.matchedSkills.length > 0) || (job.missingSkills && job.missingSkills.length > 0) || typeof job.skillCoveragePercent === "number") && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--color-surface-secondary)]/70 via-[var(--color-surface-secondary)]/40 to-transparent border border-[var(--color-border-light)] flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text)] m-0">
                        Skill & Tooling Alignment
                      </h4>
                    </div>
                    {typeof job.skillCoveragePercent === "number" && (
                      <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        job.skillCoveragePercent >= 75
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : job.skillCoveragePercent >= 50
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}>
                        {job.skillCoveragePercent}% Coverage
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {typeof job.skillCoveragePercent === "number" && (
                    <div className="w-full h-1.5 rounded-full bg-[var(--color-border-light)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          job.skillCoveragePercent >= 75
                            ? "bg-emerald-500"
                            : job.skillCoveragePercent >= 50
                            ? "bg-blue-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, job.skillCoveragePercent))}%` }}
                      />
                    </div>
                  )}

                  {/* Matched Skills */}
                  {job.matchedSkills && job.matchedSkills.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                        <span>✓</span>
                        <span>Matched in your profile ({job.matchedSkills.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {job.matchedSkills.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 text-xs rounded-lg font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1"
                          >
                            <span className="text-[10px] font-bold">✓</span>
                            <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Skills / Gaps */}
                  {job.missingSkills && job.missingSkills.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                        <span>•</span>
                        <span>Target role requirements not in your resume ({job.missingSkills.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {job.missingSkills.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 text-xs rounded-lg font-medium bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/25 flex items-center gap-1"
                          >
                            <span className="text-[10px] font-bold opacity-60">•</span>
                            <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {job.keywords && job.keywords.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                    Core Competencies & Keywords
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {job.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 text-xs rounded-lg font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text)] border border-[var(--color-border-light)]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                  Role Description
                </h4>
                {job.description && job.description.length > 50 && !job.description.toLowerCase().startsWith("no full job description") ? (
                  <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--color-surface-secondary)]/30 p-4 rounded-xl border border-[var(--color-border-light)] font-sans">
                    {cleanJobDescription(job.description)}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[var(--color-surface-secondary)]/30 border border-[var(--color-border-light)] flex flex-col gap-2.5">
                    <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
                      Full description was not indexed in the ATS summary feed. You can review all role qualifications directly on the employer career portal.
                    </p>
                    <button
                      type="button"
                      onClick={handleApplyDirectly}
                      disabled={checkingLink}
                      className="self-start text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    >
                      <span>{checkingLink ? "Checking link..." : `Open Requisition on ${job.company} Career Site →`}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Prepare Me Playbook - Unprepared State */}
          {activeTab === "prepare" && !preparation && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-[var(--color-surface-secondary)] to-orange-500/5 border border-amber-500/30 text-center flex flex-col items-center gap-3 animate-fadeIn">
              <span className="text-3xl">⚡</span>
              <h3 className="text-base font-bold text-[var(--color-text)] m-0">Generate Your Prepared Playbook</h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md m-0 leading-relaxed">
                Unlock custom interview strengths, role expectations, and company insider networking paths specifically crafted for <strong>{job.title}</strong> at <strong>{job.company}</strong>.
              </p>
              <button
                type="button"
                onClick={handlePrepareMe}
                disabled={preparing}
                className="mt-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-105 transition-all shadow-md cursor-pointer border-none disabled:opacity-50"
              >
                {preparing ? "Generating Playbook..." : "⚡ Prepare Me (1 ⚡)"}
              </button>
            </div>
          )}

          {/* Tab 2: Prepare Me Playbook - Unlocked State */}
          {activeTab === "prepare" && preparation && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              {/* 1. Strengths */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                  <h3 className="text-sm font-bold text-[var(--color-text)] m-0">Your Strengths & Core Anchors</h3>
                </div>
                <ul className="m-0 pl-5 flex flex-col gap-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {preparation.strengths.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* 2. Weaknesses & Objection Handlers */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold">
                    !
                  </span>
                  <h3 className="text-sm font-bold text-[var(--color-text)] m-0">Skill Gaps & Objection Handlers</h3>
                </div>
                <ul className="m-0 pl-5 flex flex-col gap-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {preparation.weaknesses.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {/* 3. Role Expectations */}
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                    🎯
                  </span>
                  <h3 className="text-sm font-bold text-[var(--color-text)] m-0">Role Expectations & First 90 Days</h3>
                </div>
                <ul className="m-0 pl-5 flex flex-col gap-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {preparation.roleExpectations.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>

              {/* 4. Networking Path */}
              <div className="p-4 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">
                      🤝
                    </span>
                    <h3 className="text-sm font-bold text-[var(--color-text)] m-0">Networking Path</h3>
                  </div>
                  {preparation.networkingPath.hasProxnetInsiders ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Nearby ProxNet Insiders Found
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                      LinkedIn Bridge Path
                    </span>
                  )}
                </div>

                {/* Direct ProxNet Insiders */}
                {preparation.networkingPath.hasProxnetInsiders ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-[var(--color-text-secondary)] m-0">
                      Verified professionals from your ProxNet local neighborhood working at <strong>{job.company}</strong>:
                    </p>
                    <div className="flex flex-col gap-2 mt-1">
                      {preparation.networkingPath.proxnetInsiders.map((insider) => (
                        <div
                          key={insider.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                              {insider.photoUrl ? (
                                <img src={insider.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                insider.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[var(--color-text)] truncate m-0">
                                {insider.name}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] truncate m-0">
                                {insider.jobTitle} &bull; {insider.distanceKm != null ? `${insider.distanceKm} km away` : "Nearby"}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/qa?userId=${insider.id}&company=${encodeURIComponent(job.company)}&title=${encodeURIComponent(job.title)}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all shrink-0 no-underline"
                          >
                            Chat / Ask
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)] m-0">
                    No direct ProxNet neighbor currently listed at <strong>{job.company}</strong>. Traverse via targeted LinkedIn search below:
                  </p>
                )}

                {/* Pre-filtered LinkedIn Traverse Button */}
                <div className="mt-2 flex flex-col gap-2">
                  <a
                    href={preparation.networkingPath.linkedinSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleExternalLinkClick(preparation.networkingPath.linkedinSearchUrl)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0A66C2] text-white hover:bg-[#004182] transition-all shadow-sm no-underline"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                    </svg>
                    <span>Traverse LinkedIn: Find {job.company} Recruiters & Alumni</span>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* 2nd-Degree Warm Referral Chain (X -> Y -> Z) */}
                  <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-[var(--color-surface-secondary)] to-indigo-500/5 border border-blue-500/25 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
                          🔗
                        </span>
                        <h4 className="text-xs font-bold text-[var(--color-text)] m-0">2nd-Degree Referral Chain (X → Y → Z)</h4>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30">
                        Mutual Referral Bridge
                      </span>
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
                      Tap below to see your <strong>2nd-degree connections on LinkedIn</strong> who work at {job.company} via your mutual friends (Y):
                    </p>

                    <a
                      href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(job.company + " " + job.title)}&network=%5B"S"%5D`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleExternalLinkClick(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(job.company + " " + job.title)}&network=%5B"S"%5D`)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs bg-[#0A66C2] text-white hover:bg-[#004182] transition-all shadow-sm no-underline"
                    >
                      <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                      </svg>
                      <span>Find 2nd-Degree Connections (Y → Z) on LinkedIn</span>
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>

                    {/* Pre-drafted 1-click intro message for User X to send to mutual connection Y */}
                    <div className="p-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          1-Click Warm Bridge Intro (Send to Y to introduce Z)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const bridgeNote = `Hi [Name], hope you're having a great week! I saw you're connected with someone on the team at ${job.company}. I'm applying for their ${job.title} opening—would you be open to introducing us or putting in a brief word? Really appreciate your help!`;
                            navigator.clipboard.writeText(bridgeNote);
                            setCopiedBridgeNote(true);
                            setTimeout(() => setCopiedBridgeNote(false), 2500);
                          }}
                          className="text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                          {copiedBridgeNote ? "✓ Copied to Clipboard!" : "Copy Intro Note"}
                        </button>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] italic leading-relaxed m-0 select-all">
                        "Hi [Name], hope you're having a great week! I saw you're connected with someone on the team at {job.company}. I'm applying for their ${job.title} opening—would you be open to introducing us or putting in a brief word? Really appreciate your help!"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
