"use client";

import { useState, useEffect } from "react";
import { cleanJobTitle } from "@/lib/jobs/job-filters";

export interface ColdOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    title: string;
    url?: string;
    description?: string;
    keywords?: string[];
    score?: number;
    label?: string;
    reason?: string;
  };
  company: string;
  userInviteCode?: string | null;
  onOpenLinkedIn: (searchUrl: string, searchLabel: string) => void;
}

export function ColdOutreachModal({
  isOpen,
  onClose,
  job,
  company,
  userInviteCode,
  onOpenLinkedIn,
}: ColdOutreachModalProps) {
  const [targetType, setTargetType] = useState<"recruiter" | "hiring_manager" | "peer">("recruiter");
  const [tone, setTone] = useState<"direct" | "value_add" | "casual">("value_add");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);

  const cleanedTitle = cleanJobTitle(job.title);

  useEffect(() => {
    if (isOpen) {
      generateOutreach(targetType, tone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetType, tone]);

  const generateOutreach = async (selectedTarget: string, selectedTone: string) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/jobs/generate-cold-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          company,
          jobTitle: cleanedTitle,
          jobDescription: job.description || "",
          jobKeywords: job.keywords || [],
          targetType: selectedTarget,
          tone: selectedTone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubject(data.subject || `${cleanedTitle} inquiry at ${company}`);
        setMessage(data.message || "");
        setHighlights(data.highlights || []);
      } else {
        throw new Error("Failed to fetch generated outreach");
      }
    } catch (err) {
      console.error("[ColdOutreachModal] Generation error:", err);
      // Fallback
      setSubject(`Inquiry regarding ${cleanedTitle} opening at ${company}`);
      setMessage(
        `Hi [Name], I noticed ${company} has an active opening for ${cleanedTitle}. My background and recent projects align closely with your team's requirements. Would you be open to a brief 10-minute chat next week to see if my profile could be a strong match?`
      );
      setHighlights([`Direct alignment with ${cleanedTitle}`, "Tailored outreach"]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  };

  const handleCopySubject = async () => {
    try {
      await navigator.clipboard.writeText(subject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2500);
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  };

  // Generate target-specific LinkedIn search query
  const getLinkedInSearchUrl = () => {
    const cleanComp = (company || "").trim();
    let query = `${cleanComp} recruiter ${cleanedTitle}`;
    if (targetType === "hiring_manager") {
      query = `${cleanComp} engineering manager OR hiring manager ${cleanedTitle}`;
    } else if (targetType === "peer") {
      query = `${cleanComp} ${cleanedTitle}`;
    }
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] w-full max-w-xl rounded-2xl shadow-2xl border border-[var(--color-border)] animate-scaleIn flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-gradient-to-r from-primary/10 via-[var(--color-surface-secondary)] to-amber-500/10 rounded-t-2xl shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">✉️</span>
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
                AI Cold Outreach Generator
              </h3>
              <span className="badge text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold rounded-full border border-emerald-500/30">
                FREE • 0 Credits
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] m-0">
              For Pioneer roles with no insider referrers: reach decision makers directly
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Job Context Strip */}
        <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--color-text)] truncate">{cleanedTitle}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)]">🏢 {company}</div>
          </div>
          {job.score && (
            <span className="badge text-[10px] px-2 py-0.5 font-bold rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
              {job.score}% Match
            </span>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Target Audience Tabs */}
          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block mb-1.5">
              Who are you messaging?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("recruiter")}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer font-semibold flex flex-col items-center gap-0.5 ${
                  targetType === "recruiter"
                    ? "bg-primary/15 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-primary/40 text-[var(--color-text-secondary)]"
                }`}
              >
                <span>🔍 Recruiter / TA</span>
                <span className="text-[9px] opacity-75">Talent acquisition team</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("hiring_manager")}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer font-semibold flex flex-col items-center gap-0.5 ${
                  targetType === "hiring_manager"
                    ? "bg-primary/15 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-primary/40 text-[var(--color-text-secondary)]"
                }`}
              >
                <span>🎯 Hiring Manager</span>
                <span className="text-[9px] opacity-75">Team Lead / Engineering Mgr</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("peer")}
                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer font-semibold flex flex-col items-center gap-0.5 ${
                  targetType === "peer"
                    ? "bg-primary/15 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border-light)] hover:border-primary/40 text-[var(--color-text-secondary)]"
                }`}
              >
                <span>👥 Team Peer</span>
                <span className="text-[9px] opacity-75">Engineer in same role</span>
              </button>
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider block mb-1.5">
              Outreach Tone
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTone("value_add")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  tone === "value_add"
                    ? "bg-primary text-white border-primary"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                💡 Value-Add (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setTone("direct")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  tone === "direct"
                    ? "bg-primary text-white border-primary"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                ⚡ Direct & Punchy
              </button>
              <button
                type="button"
                onClick={() => setTone("casual")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  tone === "casual"
                    ? "bg-primary text-white border-primary"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                🤝 Warm & Conversational
              </button>
            </div>
          </div>

          {/* Subject Line (useful for LinkedIn InMail / Email) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider">
                Subject Hook (For InMail / Email)
              </span>
              <button
                type="button"
                onClick={handleCopySubject}
                className="text-[10px] text-primary hover:underline font-semibold bg-transparent border-none cursor-pointer"
              >
                {copiedSubject ? "✓ Copied!" : "Copy Subject"}
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={generating}
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] focus:border-primary focus:outline-none"
            />
          </div>

          {/* Message Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] tracking-wider">
                Outreach Message (Ready for LinkedIn DM)
              </span>
              <button
                type="button"
                onClick={() => generateOutreach(targetType, tone)}
                disabled={generating}
                className="text-[10px] text-primary hover:underline font-semibold bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <span>✨</span> Regenerate
              </button>
            </div>

            {generating ? (
              <div className="p-8 rounded-xl border border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-2 animate-pulse">
                <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span className="text-xs text-primary font-medium">
                  Crafting personalized {targetType.replace("_", " ")} message...
                </span>
              </div>
            ) : (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] focus:border-primary focus:outline-none resize-none leading-relaxed transition-colors"
                placeholder="Drafting message..."
              />
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {highlights.map((h, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-medium"
                  >
                    ✓ {h}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pioneer Bounty reminder */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/25 flex items-start gap-2.5">
            <span className="text-base shrink-0">🏆</span>
            <div className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              <strong className="text-[var(--color-text)]">Pro-Tip (Pioneer Bounty):</strong> While messaging them, invite them to join ProxNet. If they join, you earn <strong className="text-amber-600 dark:text-amber-400">+10 Credits</strong>!
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex flex-wrap items-center justify-between gap-2.5 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={handleCopyMessage}
            disabled={generating || !message.trim()}
            className={`btn btn-sm text-xs font-bold px-4 py-2 rounded-xl border cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 ${
              copiedMessage
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border-[var(--color-border)]"
            }`}
          >
            <span>{copiedMessage ? "✓" : "📋"}</span>
            <span>{copiedMessage ? "Copied Message!" : "Copy Message"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const searchLabel =
                  targetType === "hiring_manager"
                    ? `Hiring Managers at ${company}`
                    : targetType === "peer"
                    ? `${cleanedTitle} Peers at ${company}`
                    : `Recruiters at ${company}`;
                onOpenLinkedIn(getLinkedInSearchUrl(), searchLabel);
              }}
              className="btn btn-sm bg-[#0077b5] hover:bg-[#005885] text-white font-bold text-xs px-4 py-2 rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              <span>Find {targetType === "hiring_manager" ? "Hiring Manager" : targetType === "peer" ? "Team Peer" : "Recruiter"} on LinkedIn ↗</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
