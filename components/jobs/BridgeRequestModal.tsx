"use client";

import { useState, useEffect } from "react";
import { cleanJobTitle } from "@/lib/jobs/job-filters";

export interface BridgeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: string;
  jobTitle?: string;
  userInviteCode?: string | null;
  onSuccess?: () => void;
}

export function BridgeRequestModal({
  isOpen,
  onClose,
  company,
  jobTitle = "",
  userInviteCode,
  onSuccess,
}: BridgeRequestModalProps) {
  const [note, setNote] = useState("");
  const [potentialAlumni, setPotentialAlumni] = useState<Array<{ id: string; name: string; title: string; company: string }>>([]);
  const [loadingAlumni, setLoadingAlumni] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const cleanedTitle = cleanJobTitle(jobTitle || "");

  useEffect(() => {
    if (isOpen && company) {
      setSubmitted(false);
      setNote(`Hey ProxNet network! I'm actively pursuing the ${cleanedTitle || "open role"} at ${company}. Does anyone know someone currently or previously on the team? Any intro or culture insight would be greatly appreciated!`);
      fetchAlumni();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, company]);

  const fetchAlumni = async () => {
    setLoadingAlumni(true);
    try {
      const res = await fetch(`/api/jobs/bridge-request?company=${encodeURIComponent(company)}`);
      if (res.ok) {
        const data = await res.json();
        setPotentialAlumni(data.potentialAlumni || []);
      }
    } catch (e) {
      console.warn("Could not check network alumni:", e);
    } finally {
      setLoadingAlumni(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/bridge-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          jobTitle: cleanedTitle,
          note,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      console.error("Bridge request submission failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyShareText = async () => {
    const inviteUrl = userInviteCode ? `${window.location.origin}/join/${userInviteCode}` : `${window.location.origin}/grow`;
    const shareText = `Looking for an intro or insights at ${company} for the ${cleanedTitle || "team"}! If you work there or know someone, join our verified ProxNet circle here: ${inviteUrl}`;
    try {
      await navigator.clipboard.writeText(shareText);
      alert("✓ Copied shareable bridge note to clipboard!");
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

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
        <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-gradient-to-r from-emerald-500/10 via-[var(--color-surface-secondary)] to-primary/10 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌉</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
                  Bridge Request: Ask the Network
                </h3>
                <span className="badge text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                  FREE • 0 Credits
                </span>
              </div>
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                Connect with 2nd-degree peers or alumni connected to {company}
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

        {/* Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {submitted ? (
            <div className="py-8 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl">
                ✓
              </div>
              <h4 className="text-sm font-bold text-[var(--color-text)] m-0">
                Bridge Request Published!
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm m-0 leading-relaxed">
                Your request for <strong>{company}</strong> has been pinned to your profile & network feed. ProxNet members connected to this company will be alerted.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 w-full justify-center">
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold border-none cursor-pointer hover:opacity-90 transition-opacity"
                >
                  📋 Copy Shareable Link (+10 pts Bounty)
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-xs font-semibold border border-[var(--color-border)] cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Alumni / Connected Peers Discovery */}
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider flex items-center gap-1.5">
                    <span>👥</span> ProxNet Network Proximity
                  </span>
                  <span className="text-[10px] text-primary font-semibold">2nd-Degree Search</span>
                </div>
                {loadingAlumni ? (
                  <div className="text-[11px] text-[var(--color-text-tertiary)] animate-pulse">
                    Scanning ProxNet alumni for {company}...
                  </div>
                ) : potentialAlumni.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
                      Found {potentialAlumni.length} ProxNet member{potentialAlumni.length > 1 ? "s" : ""} with ties or past experience at {company}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {potentialAlumni.map((a) => (
                        <span
                          key={a.id}
                          className="px-2 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] text-[11px] font-medium text-[var(--color-text)] flex items-center gap-1"
                        >
                          <span>👤</span>
                          <span>{a.name} ({a.title})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--color-text-secondary)] m-0 leading-relaxed">
                    No direct alumni registered yet. Posting a Bridge Request prompts your fellow ProxNet members to check their LinkedIn network for warm connections!
                  </p>
                )}
              </div>

              {/* Request Note Editor */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block">
                  Your Bridge Request Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] focus:border-primary focus:outline-none resize-none leading-relaxed transition-colors"
                  placeholder="What kind of intro or insight are you looking for?"
                />
              </div>

              {/* Bounty incentive notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <span className="text-base shrink-0">🏆</span>
                <p className="text-[11px] text-[var(--color-text-secondary)] m-0 leading-relaxed">
                  When a peer introduces an employee from {company} who joins ProxNet, both of you earn the <strong>Pioneer Bounty (+10 Credits)</strong>.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex justify-between items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !note.trim()}
              className="btn btn-sm btn-primary px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
            >
              {submitting ? (
                <span>Posting...</span>
              ) : (
                <>
                  <span>🌉</span>
                  <span>Post Bridge Request</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
