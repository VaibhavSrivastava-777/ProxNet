"use client";

import React, { useState } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";
import type { RankedProfile } from "@/lib/hooks/useDiscoverRanking";
import type { DiscoverJobItem } from "@/app/api/jobs/discover-company-jobs/route";

interface DiscoverCardProps {
  profile: RankedProfile;
  onCelebrate: () => void;
  onNext: () => void;
  onOpenDetails: () => void;
  onStartChat: (person: any) => void;
  dragOffset?: number; // horizontal drag in px
  isCelebrated?: boolean;
}

const CHAT_PREF_LABELS: Record<string, { label: string; icon: string }> = {
  chai: { label: "15-min chai", icon: "☕" },
  walk: { label: "Walk & talk", icon: "🚶" },
  weekend_coffee: { label: "Weekend coffee", icon: "🥐" },
  dm_only: { label: "DM preferred", icon: "💬" },
};

function formatDistance(meters?: number | null): string {
  if (meters == null || meters === undefined) return "Within 2km";
  if (meters < 1000) return `${Math.round(meters)}m away`;
  return `${(meters / 1000).toFixed(1)}km away`;
}

function getInitials(name?: string): string {
  if (!name) return "N";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DiscoverCard({
  profile,
  onCelebrate,
  onNext,
  onOpenDetails,
  onStartChat,
  dragOffset = 0,
  isCelebrated = false,
}: DiscoverCardProps) {
  const { person, score, primaryReason, reasons, jobsBundle } = profile;
  const [activeJobTab, setActiveJobTab] = useState<"exact" | "competitor">("exact");

  const visibility = person.visibility || {
    showCompany: true,
    showTitle: true,
    showPhoto: true,
  };

  const displayName = person.full_name || person.anonymous_name || "Neighbor Professional";
  const displayCompany = visibility.showCompany !== false
    ? person.company || "Independent / Startup"
    : "Company Protected";
  const displayTitle = visibility.showTitle !== false
    ? person.job_title || "Professional"
    : "Title Protected";
  const showPhoto = visibility.showPhoto !== false && Boolean(person.profile_photo_url);

  const pref = person.quick_chat_preference
    ? CHAT_PREF_LABELS[person.quick_chat_preference] || { label: person.quick_chat_preference, icon: "☕" }
    : null;

  const exactJobs: DiscoverJobItem[] = jobsBundle?.exactJobs || [];
  const competitorJobs: DiscoverJobItem[] = jobsBundle?.competitorJobs || [];
  const competitorNames: string[] = jobsBundle?.competitorNames || [];

  // Drag stamp opacity calculation (purely for navigation feedback)
  const prevOpacity = Math.min(1, Math.max(0, -dragOffset / 75));
  const nextOpacity = Math.min(1, Math.max(0, dragOffset / 75));

  return (
    <div
      onClick={onOpenDetails}
      className="relative w-full h-full max-h-[72vh] sm:max-h-[640px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-xl overflow-hidden flex flex-col select-none cursor-pointer transition-shadow hover:shadow-2xl"
      style={{
        boxShadow: "0 20px 40px -15px rgba(0,0,0,0.15), 0 0 1px 1px rgba(0,0,0,0.05)",
      }}
    >
      {/* ── Visual Stamp Overlays on Swipe Drag (Navigation Only) ── */}
      {prevOpacity > 0 && (
        <div
          className="absolute top-6 left-6 z-30 pointer-events-none transform -rotate-12 border-3 border-zinc-500 rounded-xl px-4 py-1.5 bg-zinc-500/20 backdrop-blur-xs shadow-lg transition-opacity"
          style={{ opacity: prevOpacity }}
        >
          <span className="text-zinc-600 dark:text-zinc-300 font-black tracking-wider text-xl uppercase flex items-center gap-1.5">
            ⬅ PREV
          </span>
        </div>
      )}

      {nextOpacity > 0 && (
        <div
          className="absolute top-6 right-6 z-30 pointer-events-none transform rotate-12 border-3 border-indigo-500 rounded-xl px-4 py-1.5 bg-indigo-500/20 backdrop-blur-xs shadow-lg transition-opacity"
          style={{ opacity: nextOpacity }}
        >
          <span className="text-indigo-500 dark:text-indigo-400 font-black tracking-wider text-xl uppercase flex items-center gap-1.5">
            NEXT ➔
          </span>
        </div>
      )}

      {/* ── Top Bar: Distance & Pertinence Score ── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 bg-gradient-to-b from-[var(--color-surface-secondary)]/80 to-transparent shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>📍 {formatDistance(person.distance)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isCelebrated && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-amber-900 bg-amber-300 dark:bg-amber-400 border border-amber-500/40 shadow-xs animate-bounce flex items-center gap-1">
              <span>🎉</span>
              <span>Celebrated!</span>
            </span>
          )}
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 shadow-sm">
            <span>✨</span>
            <span>{score}% Match</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body Area ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4 scrollbar-thin">
        {/* Profile Header */}
        <div className="flex items-start gap-3.5 pt-1">
          {/* Avatar */}
          <div className="relative shrink-0">
            {showPhoto ? (
              <img
                src={person.profile_photo_url}
                alt={displayName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--color-border)] shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center font-bold text-xl shadow-md border-2 border-white/20">
                {getInitials(displayName)}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-0.5 shadow-xs">
              <CompanyLogo company={person.company} size={22} />
            </div>
          </div>

          {/* Titles & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)] truncate m-0">
                {displayName}
              </h3>
              <span className="text-blue-500 text-sm shrink-0" title="Verified Member">✓</span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-[var(--color-primary)] truncate m-0">
              {displayTitle}
            </p>

            <p className="text-xs text-[var(--color-text-secondary)] truncate flex items-center gap-1 mt-0.5 m-0 font-medium">
              <span>🏢 {displayCompany}</span>
            </p>
          </div>
        </div>

        {/* Badges Pill Row */}
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {person.institute_name && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1 border border-indigo-500/20">
              <span>🎓</span>
              <span className="truncate max-w-[170px]">{person.institute_name}</span>
            </span>
          )}
          {person.society_name && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1 border border-emerald-500/20">
              <span>🏡</span>
              <span className="truncate max-w-[170px]">{person.society_name}</span>
            </span>
          )}
          {pref && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1 border border-amber-500/20">
              <span>{pref.icon}</span>
              <span>{pref.label}</span>
            </span>
          )}
        </div>

        {/* ── Action Buttons Row (Placed Above Why Connect) ── */}
        <div
          className="flex items-center justify-between gap-2 pt-1 pb-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Next Profile Button */}
          <button
            type="button"
            onClick={onNext}
            className="flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] active:scale-95 transition-all border border-[var(--color-border-light)] shadow-xs font-bold text-xs cursor-pointer"
            title="Next Profile"
            aria-label="Next Profile"
          >
            <span>Next</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Say Hi / Direct Chat Button */}
          <button
            type="button"
            onClick={() => onStartChat(person)}
            className="flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 bg-[var(--color-surface-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95 transition-all border border-[var(--color-primary)]/20 shadow-xs font-bold text-xs cursor-pointer"
            title="Direct Message"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Say Hi</span>
          </button>

          {/* Celebrate Button (Graffiti & Notification Trigger - Explicit Click Only) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCelebrate();
            }}
            className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs shadow-md transition-all cursor-pointer border-0 ${
              isCelebrated
                ? "bg-amber-500 text-white shadow-amber-500/25"
                : "bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white hover:opacity-95 active:scale-95 shadow-rose-500/25"
            }`}
            title="Celebrate Profile (Sends Graffiti Cheer)"
            aria-label="Celebrate Profile"
          >
            <span>🎉</span>
            <span>{isCelebrated ? "Celebrated!" : "Celebrate"}</span>
          </button>
        </div>

        {/* ── Why Connect (Primary Pertinence Callout) ── */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/10 via-[var(--color-primary)]/5 to-transparent border border-[var(--color-primary)]/20 flex items-start gap-2.5">
          <span className="text-lg shrink-0 mt-0.5">💡</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] m-0">
              Why Connect
            </p>
            <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5 m-0 leading-snug">
              {primaryReason}
            </p>
          </div>
        </div>

        {/* ── What They Can Do For You (Scrapbook Superpowers) ── */}
        {((person.help_offers && person.help_offers.length > 0) ||
          (person.ask_me_about && person.ask_me_about.length > 0) ||
          (person.tinkering_with && person.tinkering_with.length > 0)) && (
          <div className="p-3.5 rounded-2xl bg-[var(--color-surface-secondary)]/70 border border-[var(--color-border-light)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1">
                <span>⚡</span>
                <span>Scrapbook & Superpowers</span>
              </span>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">Derived from bio</span>
            </div>

            {person.help_offers && person.help_offers.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                  🤝 Can help you with:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {person.help_offers.map((item: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {person.ask_me_about && person.ask_me_about.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
                  💬 Ask them about:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {person.ask_me_about.map((item: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-500/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {person.tinkering_with && person.tinkering_with.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                  🔬 Tinkering with:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {person.tinkering_with.map((item: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Open Positions (Exact Company & Competitors) ── */}
        {(exactJobs.length > 0 || competitorJobs.length > 0) && (
          <div className="p-3.5 rounded-2xl bg-[var(--color-surface-secondary)]/70 border border-[var(--color-border-light)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1">
                <span>💼</span>
                <span>Open Opportunities</span>
              </span>

              {/* Exact vs Competitor Tab if both exist */}
              {exactJobs.length > 0 && competitorJobs.length > 0 && (
                <div className="flex bg-[var(--color-surface)] p-0.5 rounded-lg border border-[var(--color-border-light)] text-[10px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveJobTab("exact");
                    }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                      activeJobTab === "exact"
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {person.company || "Company"} ({exactJobs.length})
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveJobTab("competitor");
                    }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                      activeJobTab === "competitor"
                        ? "bg-violet-600 text-white"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    Competitors ({competitorJobs.length})
                  </button>
                </div>
              )}
            </div>

            {/* Exact Company Jobs */}
            {(exactJobs.length > 0 && (activeJobTab === "exact" || competitorJobs.length === 0)) && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                  🔥 Hiring at {person.company} (Direct Referral Opportunity):
                </span>
                {exactJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex items-center justify-between gap-2 hover:border-[var(--color-primary)] transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--color-text)] truncate m-0">
                        {job.role}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] truncate m-0">
                        {job.skills || "Relevant skillset match"}
                      </p>
                    </div>
                    {job.url ? (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-md text-[10px] font-bold text-white bg-[var(--color-primary)] hover:opacity-90 shrink-0"
                      >
                        Apply
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartChat(person);
                        }}
                        className="px-2 py-1 rounded-md text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 shrink-0 border-0"
                      >
                        Ask Referral
                      </button>
                    )}
                  </div>
                ))}
                {exactJobs.length > 3 && (
                  <p className="text-[10px] text-[var(--color-primary)] font-bold text-center m-0 pt-0.5">
                    +{exactJobs.length - 3} more open positions
                  </p>
                )}
              </div>
            )}

            {/* Competitor Company Jobs */}
            {(competitorJobs.length > 0 && (activeJobTab === "competitor" || exactJobs.length === 0)) && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                    ⚔️ Open at Competitors ({competitorNames.slice(0, 3).join(", ")})
                  </span>
                </div>
                {competitorJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] flex items-center justify-between gap-2 hover:border-violet-500 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--color-text)] truncate m-0">
                          {job.role}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-violet-500/10 text-violet-700 dark:text-violet-300 shrink-0">
                          {job.company}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-secondary)] truncate m-0">
                        {job.skills || "Competitor opening"}
                      </p>
                    </div>
                    {job.url ? (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded-md text-[10px] font-bold text-white bg-violet-600 hover:opacity-90 shrink-0"
                      >
                        View
                      </a>
                    ) : null}
                  </div>
                ))}
                {competitorJobs.length > 3 && (
                  <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold text-center m-0 pt-0.5">
                    +{competitorJobs.length - 3} more competitor roles
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tap hint */}
        <div className="text-center pt-2 pb-2">
          <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors">
            Tap anywhere on card to view full profile & bio →
          </span>
        </div>
      </div>
    </div>
  );
}
