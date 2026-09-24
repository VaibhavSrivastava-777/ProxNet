"use client";

import { useState } from "react";

interface DeepFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: number;
  hasResume: boolean;
  onMatchesFetched: (matches: any[], newWallet: number) => void;
  onOpenResumeUpload?: () => void;
}

export function DeepFetchModal({
  isOpen,
  onClose,
  wallet,
  hasResume,
  onMatchesFetched,
  onOpenResumeUpload,
}: DeepFetchModalProps) {
  const maxCredits = Math.max(1, Math.min(wallet, 25));
  const [credits, setCredits] = useState<number>(() => Math.min(3, maxCredits));
  const [isFetching, setIsFetching] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleStartFetch = async () => {
    if (!hasResume) {
      if (onOpenResumeUpload) {
        onClose();
        onOpenResumeUpload();
      } else {
        alert("Please upload your resume first to run Deep ATS Hunter.");
      }
      return;
    }

    if (wallet <= 0) {
      setErrorMsg("Your wallet has 0 credits. Earn credits by sharing jobs or onboarding colleagues!");
      return;
    }

    setIsFetching(true);
    setErrorMsg("");
    setCurrentStep(1);

    const stepTimer1 = setTimeout(() => setCurrentStep(2), 2200);
    const stepTimer2 = setTimeout(() => setCurrentStep(3), 4800);

    try {
      const res = await fetch("/api/jobs/deep-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });

      const data = await res.json();

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        if (data.error === "NO_RESUME") {
          setErrorMsg("Please upload your resume to run Deep ATS Hunter.");
        } else if (data.error === "INSUFFICIENT_CREDITS") {
          setErrorMsg(data.message || "Insufficient wallet credits.");
        } else {
          setErrorMsg(data.error || data.message || "Failed to fetch deep matches.");
        }
        setIsFetching(false);
        return;
      }

      onMatchesFetched(data.matches || [], data.remainingWallet ?? wallet - (data.creditsExpended || 0));
      onClose();
    } catch (err: unknown) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      const msg = err instanceof Error ? err.message : "Failed to connect to Deep ATS Hunter";
      setErrorMsg(msg);
      setIsFetching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-border-light)] flex items-center justify-between bg-gradient-to-r from-primary/10 via-[var(--color-surface)] to-emerald-500/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-xl shadow-xs">
              🎯
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                Deep ATS Match Hunter
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Live crawl across Greenhouse, Lever, Ashby & partner boards
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isFetching}
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            title="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-[var(--color-text)]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-medium">
              {errorMsg}
            </div>
          )}

          {isFetching ? (
            /* Active Crawling Animation State */
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl animate-pulse">
                  ⚡
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Hunting Strong Matches (&gt;70% Fit)
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-xs mx-auto">
                  {currentStep === 1 && "📡 Querying live external ATS endpoints (Greenhouse, Lever, Ashby, Workable)..."}
                  {currentStep === 2 && "🧠 Parsing job requirements & reranking vs candidate resume with AI..."}
                  {currentStep >= 3 && "🏆 Enforcing strict >70% fit threshold & attaching Pioneer bounties..."}
                </p>
              </div>

              <div className="flex items-center gap-1.5 pt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${currentStep >= 1 ? "bg-primary" : "bg-[var(--color-border-light)]"}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${currentStep >= 2 ? "bg-primary" : "bg-[var(--color-border-light)]"}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${currentStep >= 3 ? "bg-primary" : "bg-[var(--color-border-light)]"}`} />
              </div>
            </div>
          ) : (
            /* Configuration State */
            <>
              {/* Resume Check Alert */}
              {!hasResume && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <span>No resume linked. Resume is required to evaluate functional fit.</span>
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

              {/* Wallet Credits Overview */}
              <div className="p-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider">
                    Available Balance
                  </span>
                  <div className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-1.5 mt-0.5">
                    <span>🪙</span>
                    <span>{wallet} Credits</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                    ✓ Fair Billing Protection
                  </span>
                  <span className="text-[9px] text-[var(--color-text-tertiary)] block">
                    Only charged for actual &gt;70% matches
                  </span>
                </div>
              </div>

              {/* Credit Selector Stepper */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[var(--color-text)] flex items-center gap-1.5">
                    <span>Select credits to expend:</span>
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                      {credits} {credits === 1 ? "Opportunity" : "Opportunities"}
                    </span>
                  </label>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">Max: {maxCredits}</span>
                </div>

                {/* Quick Selection Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 5, 10].map((amt) => {
                    const disabled = amt > maxCredits;
                    const isSelected = credits === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        disabled={disabled}
                        onClick={() => setCredits(amt)}
                        className={`py-2 px-1 rounded-xl border font-bold text-center transition-all ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20"
                            : disabled
                            ? "bg-[var(--color-surface)] border-[var(--color-border-light)] text-[var(--color-text-tertiary)] opacity-40 cursor-not-allowed"
                            : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-primary/50 text-[var(--color-text)]"
                        }`}
                      >
                        {amt} {amt === 1 ? "credit" : "credits"}
                      </button>
                    );
                  })}
                </div>

                {/* Slider */}
                {maxCredits > 1 && (
                  <div className="pt-2">
                    <input
                      type="range"
                      min={1}
                      max={maxCredits}
                      value={credits}
                      onChange={(e) => setCredits(parseInt(e.target.value, 10))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)] mt-1">
                      <span>1 Match</span>
                      <span>{Math.round(maxCredits / 2)} Matches</span>
                      <span>{maxCredits} Matches</span>
                    </div>
                  </div>
                )}
              </div>

              {/* What You Get Box */}
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <span className="font-bold text-emerald-700 dark:text-emerald-300 block text-xs">
                  🎯 Guaranteed Output:
                </span>
                <ul className="space-y-1.5 text-[11px] text-[var(--color-text-secondary)]">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    <span>System crawls live ATS boards and returns up to <strong>{credits} verified opportunities</strong> with <strong>&gt;70% match score</strong>.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    <span>Every opportunity includes a concise <strong>AI fit reason</strong> explaining domain and seniority alignment.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    <span>Results presented in <strong>descending order of match rate</strong> across companies.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    <span>Companies without ProxNet members are tagged with <strong>🏆 Pioneer +10 pts Bounty</strong> so you can invite colleagues to earn credits back.</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isFetching && (
          <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/30 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--color-border-light)] text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-surface-hover)] transition-colors text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={wallet <= 0 || !hasResume}
              onClick={handleStartFetch}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-600 text-white font-bold text-xs shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>🚀</span>
              <span>Fetch {credits} {credits === 1 ? "Match" : "Matches"} ({credits} {credits === 1 ? "Credit" : "Credits"})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
