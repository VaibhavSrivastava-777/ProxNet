"use client";

import { useState, useEffect } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";

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
  preparedAt: string;
}

interface JobDetailSheetProps {
  job: JobItem | null;
  isOpen: boolean;
  onClose: () => void;
  userWallet: number;
  onWalletUpdated?: (newBalance: number) => void;
  cachedPreparation?: PreparationData | null;
}

export function JobDetailSheet({
  job,
  isOpen,
  onClose,
  userWallet,
  onWalletUpdated,
  cachedPreparation,
}: JobDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "prepare">("overview");
  const [preparing, setPreparing] = useState(false);
  const [preparation, setPreparation] = useState<PreparationData | null>(cachedPreparation || null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [directApplied, setDirectApplied] = useState(false);

  useEffect(() => {
    if (cachedPreparation) {
      setPreparation(cachedPreparation);
      setActiveTab("prepare");
    } else {
      setPreparation(null);
      setActiveTab("overview");
    }
    setPrepareError(null);
    setDirectApplied(false);
  }, [job, cachedPreparation]);

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
          description: job.description,
          url: job.url,
          location: job.location,
          matchScore: job.matchRate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to generate preparation playbook.");
      }

      setPreparation(data.preparation);
      setActiveTab("prepare");

      if (typeof data.newWalletBalance === "number" && onWalletUpdated) {
        onWalletUpdated(data.newWalletBalance);
        window.dispatchEvent(
          new CustomEvent("proxnet:wallet-updated", { detail: { newBalance: data.newWalletBalance } })
        );
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
    // 1. Open official job opportunity in a new tab/browser
    if (job.url) {
      window.open(job.url, "_blank", "noopener,noreferrer");
    }

    setDirectApplied(true);

    // 2. Persist to job_applications pipeline as "applied"
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
            appliedDirectlyAt: new Date().toISOString(),
            sourceUrl: job.url,
            location: job.location,
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
      className="fixed inset-0 z-[1200] flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-[var(--color-surface)] h-full overflow-y-auto shadow-2xl border-l border-[var(--color-border)] flex flex-col animate-slideLeft overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-20 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border-light)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[var(--color-border-light)] bg-white flex items-center justify-center shadow-sm">
              <CompanyLogo company={job.company} className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate m-0">
                {job.title}
              </h2>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] truncate m-0">
                {job.company} &bull; <span className="font-normal">{job.location}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col gap-6">
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
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] active:scale-95 transition-all shadow-sm cursor-pointer border-none"
              >
                <span>Apply Directly</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          </div>

          {prepareError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
              ⚠️ {prepareError}
            </div>
          )}

          {/* Sub Tabs: Overview vs Prepare Me Playbook */}
          {preparation && (
            <div className="flex border-b border-[var(--color-border-light)] gap-4">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer bg-transparent border-none ${
                  activeTab === "overview"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                Job Description
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
                <span>⚡</span> AI Preparation Playbook
              </button>
            </div>
          )}

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-5">
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
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--color-surface-secondary)]/30 p-4 rounded-xl border border-[var(--color-border-light)] font-sans">
                  {job.description || "No full job description provided by the ATS. Click 'Apply Directly' to view on official career site."}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Prepare Me Playbook */}
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

                  {/* Tailored Outreach Pitch with 1-click copy */}
                  <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex flex-col gap-2 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        Tailored Outreach Note
                      </span>
                      <button
                        type="button"
                        onClick={copyOutreachPitch}
                        className="text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-none p-0"
                      >
                        {copiedPitch ? "✓ Copied to Clipboard!" : "Copy Note"}
                      </button>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] italic leading-relaxed m-0 select-all">
                      "{preparation.networkingPath.customPitch}"
                    </p>
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
