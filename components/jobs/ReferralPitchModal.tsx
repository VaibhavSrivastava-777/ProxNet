"use client";

import { useState, useEffect } from "react";
import { cleanJobTitle } from "@/lib/jobs/job-filters";

interface ReferralPitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (customMessage: string) => void;
  job: {
    id: string;
    title: string;
    url: string;
    description?: string;
    keywords?: string[];
    score?: number;
    label?: string;
    reason?: string;
  };
  company: string;
  referrerAlias: string;
  isSending: boolean;
}

export function ReferralPitchModal({
  isOpen,
  onClose,
  onSend,
  job,
  company,
  referrerAlias,
  isSending,
}: ReferralPitchModalProps) {
  const [pitch, setPitch] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (isOpen && !generated) {
      generatePitch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const generatePitch = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/jobs/generate-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          company,
          jobTitle: cleanJobTitle(job.title),
          jobDescription: job.description || "",
          jobKeywords: job.keywords || [],
          referrerAlias,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPitch(data.pitch || "");
        setHighlights(data.highlights || []);
        setGenerated(true);
      }
    } catch (err) {
      console.error("Failed to generate pitch:", err);
      // Set a basic fallback
      setPitch(`Hi! I came across the ${cleanJobTitle(job.title)} role at ${company} and believe my background aligns well. Would you be open to referring my profile or sharing insights about the team? I'd really appreciate it!`);
      setGenerated(true);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] w-full max-w-lg rounded-xl shadow-xl border border-[var(--color-border)] animate-scaleIn flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] rounded-t-xl shrink-0">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-bold text-[var(--color-text)] m-0 flex items-center gap-1.5">
              <span>🤝</span> Ask for Referral
            </h3>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              Connecting you with {referrerAlias}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border-0 bg-transparent cursor-pointer p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Job Summary Card */}
        <div className="p-4 border-b border-[var(--color-border-light)]">
          <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-[var(--color-text)] truncate">{cleanJobTitle(job.title)}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">🏢 {company}</span>
              </div>
              {job.score && job.label && (
                <span className={`badge text-[10px] px-2 py-0.5 font-bold shrink-0 ${
                  job.label === "Strong Match"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : job.label === "Good Match"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                }`}>
                  {job.score}% {job.label}
                </span>
              )}
            </div>
            {highlights.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {highlights.map((h, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                    ✓ {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pitch Editor */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Your Referral Message
            </label>
            {generated && (
              <button
                type="button"
                onClick={generatePitch}
                disabled={generating}
                className="text-[10px] text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium flex items-center gap-1"
              >
                <span>✨</span> Regenerate
              </button>
            )}
          </div>

          {generating ? (
            <div className="p-6 rounded-lg border border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 animate-pulse">
              <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span className="text-xs text-primary font-medium">Crafting a personalized pitch based on your profile...</span>
            </div>
          ) : (
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text)] focus:border-primary focus:outline-none resize-none transition-colors leading-relaxed"
              placeholder="Your referral message will appear here..."
            />
          )}

          <p className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1">
            <span>💡</span>
            This AI-crafted pitch highlights your relevant experience. Feel free to edit it before sending.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--color-border-light)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[10px]">
              -1 Credit
            </span>
            <span>to initiate referral</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border-light)] text-[var(--color-text)] border border-[var(--color-border-light)] text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSend(pitch)}
              disabled={isSending || generating || !pitch.trim()}
              className="btn btn-sm btn-primary text-xs font-bold px-5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              {isSending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>🤝</span>
                  <span>Send & Start Chat</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
