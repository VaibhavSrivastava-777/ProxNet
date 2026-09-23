"use client";

import React from "react";
import type { User } from "@/lib/types";
import { CompanyLogo } from "@/components/qa/QuestionList";

interface ProfilePreviewProps {
  user: User;
  onEditClick: () => void;
  instituteAffiliation?: string | null;
}

export function ProfilePreview({
  user,
  onEditClick,
  instituteAffiliation,
}: ProfilePreviewProps) {
  const visibility = user.visibility || {
    showCompany: true,
    showTitle: true,
    showPhoto: true,
  };

  const getInitials = (name?: string) => {
    if (!name) return "N";
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const chatPrefLabels: Record<string, { label: string; icon: string }> = {
    chai: { label: "Down for a 15-min chai", icon: "☕" },
    walk: { label: "Evening walk & talk", icon: "🚶" },
    weekend_coffee: { label: "Weekend coffee friendly", icon: "🥐" },
    dm_only: { label: "Direct messages preferred", icon: "💬" },
  };

  const pref = user.quick_chat_preference
    ? chatPrefLabels[user.quick_chat_preference] || {
        label: user.quick_chat_preference,
        icon: "☕",
      }
    : { label: "Down for a 15-min chai", icon: "☕" };

  const displayName = user.full_name || user.anonymous_name || "Neighbor Professional";
  const displayCompany = visibility.showCompany
    ? user.company || "Independent / Startup"
    : "Company Protected";
  const displayTitle = visibility.showTitle
    ? user.job_title || "Professional"
    : "Title Protected";
  const showPhoto = visibility.showPhoto && !!user.profile_photo_url;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 animate-fadeIn">
      {/* Proximity Map Card Preview */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden">
        {/* Banner with proximity badge */}
        <div className="h-28 w-full bg-gradient-to-r from-blue-500/20 via-teal-500/20 to-purple-500/25 p-4 flex items-start justify-between border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/40 text-white backdrop-blur-sm border border-white/10">
              <span>📍</span> Network Proximity View
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Within 2km
            </span>
          </div>

          <div className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface)]/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-[var(--color-border)]">
            Preview Mode
          </div>
        </div>

        {/* Profile Details */}
        <div className="px-6 pb-6 pt-0 relative -mt-10">
          <div className="flex items-end justify-between mb-4">
            <div className="relative">
              {showPhoto ? (
                <img
                  src={user.profile_photo_url!}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-[var(--color-surface)] shadow-md bg-[var(--color-surface-secondary)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl border-4 border-[var(--color-surface)] shadow-md">
                  {getInitials(displayName)}
                </div>
              )}
              {user.company && visibility.showCompany && (
                <div className="absolute -bottom-1 -right-1 bg-[var(--color-surface)] p-1 rounded-lg shadow-sm border border-[var(--color-border)]">
                  <CompanyLogo company={user.company} size={20} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <span>{pref.icon}</span> {pref.label}
              </span>
            </div>
          </div>

          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--color-text)] m-0">
                {displayName}
              </h2>
              {user.anonymous_name && (
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                  @{user.anonymous_name}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-[var(--color-text-secondary)] m-0">
              {displayTitle} {visibility.showCompany && user.company ? `at ${displayCompany}` : ""}
            </p>

            {(user.society_name || instituteAffiliation) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--color-text-tertiary)]">
                {user.society_name && (
                  <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    <span>🏡</span> {user.society_name}
                  </span>
                )}
                {instituteAffiliation && (
                  <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                    <span>🎓</span> {instituteAffiliation}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Professional Bio */}
          {(user.professional_bio || user.about) && (
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
              {user.professional_bio || user.about}
            </div>
          )}

          {/* Neighbor Scrapbook Tags */}
          <div className="space-y-3 pt-1 border-t border-[var(--color-border-light)]">
            {user.help_offers && user.help_offers.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1.5">
                  I Can Help With:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.help_offers.map((offer, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    >
                      🤝 {offer}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {user.tinkering_with && user.tinkering_with.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1.5">
                  Tinkering With:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.tinkering_with.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                    >
                      🛠️ {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {user.ask_me_about && user.ask_me_about.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1.5">
                  Ask Me About:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.ask_me_about.map((topic, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    >
                      💬 {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Simulated Neighbor Actions */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border-light)] flex items-center gap-3 opacity-80">
            <div className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl bg-[var(--color-primary)] text-white shadow-sm pointer-events-none">
              👋 Say Hi / Invite for Chai
            </div>
            <div className="flex-1 py-2.5 text-center text-xs font-semibold rounded-xl bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] pointer-events-none">
              + Follow
            </div>
          </div>
          <div className="text-[10px] text-center text-[var(--color-text-tertiary)] mt-2">
            (Action buttons above are simulated as seen by neighboring users)
          </div>
        </div>
      </div>
    </div>
  );
}
