"use client";

import { cleanJobTitle } from "@/lib/jobs/job-filters";

export interface CompanyResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: string;
  jobTitle?: string;
  similarCompaniesWithReferrers?: Array<{
    company: string;
    contactsCount: number;
    openingsCount: number;
  }>;
  onSelectSimilarCompany?: (companyName: string) => void;
  onOpenColdOutreach?: () => void;
  onOpenLinkedInSearch?: (type: "recruiter" | "hiring_manager" | "company") => void;
}

export function CompanyResearchModal({
  isOpen,
  onClose,
  company,
  jobTitle = "Software Professional",
  similarCompaniesWithReferrers = [],
  onSelectSimilarCompany,
  onOpenColdOutreach,
  onOpenLinkedInSearch,
}: CompanyResearchModalProps) {
  if (!isOpen) return null;

  const cleanedTitle = cleanJobTitle(jobTitle);

  // Heuristic estimation based on role title
  const isSenior = /senior|lead|principal|staff|head|director|manager/i.test(cleanedTitle);
  const isAiOrData = /ai|ml|machine learning|data|nlp|vision|research/i.test(cleanedTitle);

  const salaryRange = isSenior
    ? isAiOrData
      ? "$180,000 – $260,000 + Equity"
      : "$160,000 – $220,000 + Equity"
    : isAiOrData
    ? "$135,000 – $175,000"
    : "$120,000 – $160,000";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--color-border)] animate-scaleIn flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-gradient-to-r from-blue-500/10 via-[var(--color-surface-secondary)] to-primary/10 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏢</span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
                Company Research Brief: {company}
              </h3>
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                Instant intelligence for Pioneer application & outreach
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Key Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                Estimated Compensation
              </span>
              <span className="text-xs font-bold text-[var(--color-text)] block mt-0.5">
                {salaryRange}
              </span>
              <span className="text-[9px] text-[var(--color-text-tertiary)]">Market baseline</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                ProxNet Insiders
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                0 Insiders (Pioneer)
              </span>
              <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80">+10 pts bounty</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                Hiring Signal
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                ⚡ Active ATS Requisition
              </span>
              <span className="text-[9px] text-[var(--color-text-tertiary)]">Live opening</span>
            </div>
          </div>

          {/* Interview Stages Heuristic */}
          <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] space-y-2">
            <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider block">
              Typical Interview Process for {cleanedTitle}
            </span>
            <div className="space-y-1.5 text-[11px] text-[var(--color-text-secondary)]">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                <div><strong>Recruiter Screen (20-30 min):</strong> Resume walk-through, motivation for {company}, timeline & compensation expectations.</div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                <div><strong>Technical / Domain Deep Dive (45-60 min):</strong> Hands-on technical screen, architecture discussion, or domain problem solving.</div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                <div><strong>Onsite Panel / Hiring Manager Loop (3-4 rounds):</strong> System design, cross-functional collaboration, team values & leadership principles.</div>
              </div>
            </div>
          </div>

          {/* Similar Companies with ProxNet Insiders */}
          {similarCompaniesWithReferrers.length > 0 && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border border-emerald-500/25 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🤝</span> Also Hiring with ProxNet Referrers
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">Warm Insider Path</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
                While exploring {company}, these peers in your sector have active ProxNet insiders ready to refer you:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {similarCompaniesWithReferrers.slice(0, 4).map((c) => (
                  <button
                    key={c.company}
                    type="button"
                    onClick={() => {
                      if (onSelectSimilarCompany) onSelectSimilarCompany(c.company);
                      onClose();
                    }}
                    className="p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:border-emerald-500/50 text-left transition-all cursor-pointer flex items-center justify-between gap-2 active:scale-95"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-[var(--color-text)] truncate">{c.company}</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {c.contactsCount} Insider Referrer{c.contactsCount > 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--color-text-tertiary)]">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Action Triggers */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
              Recommended Next Actions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onOpenColdOutreach && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenColdOutreach();
                  }}
                  className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>✉️</span> Draft AI Cold Outreach (FREE)
                </button>
              )}
              {onOpenLinkedInSearch && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLinkedInSearch("recruiter");
                  }}
                  className="p-2.5 rounded-xl bg-[#0077b5]/10 hover:bg-[#0077b5]/20 border border-[#0077b5]/25 text-[#0077b5] dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>🔍</span> Search Recruiters on LinkedIn
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            ✨ Free intelligence tool for Pioneer job seekers
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm px-4 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
