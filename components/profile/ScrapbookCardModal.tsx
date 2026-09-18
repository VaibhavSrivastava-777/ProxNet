"use client";

import { useState } from "react";
import type { User } from "@/lib/types";

interface ScrapbookCardModalProps {
  person: Partial<User> & {
    institute_affiliation?: string | null;
    is_verified_alumni?: boolean;
    distance_meters?: number;
  };
  onClose: () => void;
  onStartChat?: (personId: string, initialMessage?: string) => void;
}

export function ScrapbookCardModal({
  person,
  onClose,
  onStartChat,
}: ScrapbookCardModalProps) {
  const [copied, setCopied] = useState(false);

  const formatDistance = (meters?: number) => {
    if (meters == null) return null;
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
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

  const pref = person.quick_chat_preference
    ? chatPrefLabels[person.quick_chat_preference] || { label: person.quick_chat_preference, icon: "☕" }
    : { label: "Down for a quick chai", icon: "☕" };

  const handleCopyProfile = () => {
    const shareUrl = `${window.location.origin}/society/${encodeURIComponent(
      person.society_name || "neighborhood"
    )}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-[var(--color-surface)] shadow-2xl transition-all animate-scaleIn"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card Header with warm playful vintage-yearbook banner */}
        <div className="relative h-28 w-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-indigo-500/25 p-4 flex items-start justify-between border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/40 text-white backdrop-blur-sm border border-white/10">
              <span>📖</span> Neighbor Scrapbook
            </span>
            {person.distance_meters != null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {formatDistance(person.distance_meters)}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center transition-colors border-none cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="px-6 pb-6 pt-0 relative -mt-10">
          <div className="flex items-end justify-between mb-4">
            <div className="relative">
              {person.profile_photo_url ? (
                <img
                  src={person.profile_photo_url}
                  alt={person.full_name || "Neighbor"}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-[var(--color-surface)] shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-2xl flex items-center justify-center border-4 border-[var(--color-surface)] shadow-lg">
                  {getInitials(person.full_name)}
                </div>
              )}
            </div>

            {/* Quick Chat Preference Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-semibold shadow-sm">
              <span>{pref.icon}</span>
              <span>{pref.label}</span>
            </div>
          </div>

          {/* Name & Headline */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-[var(--color-text)] m-0">
                {person.full_name || "Neighbor"}
              </h2>
              {person.is_verified_alumni && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">
                  ✅ Verified Alumni
                </span>
              )}
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] m-0 mt-1 font-medium">
              {person.job_title ? person.job_title : "Professional"}
              {person.company ? ` @ ${person.company}` : ""}
            </p>

            {/* Location / Society & Alumni Tag */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {person.society_name && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-surface-secondary)] text-[var(--color-text)] border border-[var(--color-border)] font-medium flex items-center gap-1">
                  <span>🏢</span> {person.society_name}
                </span>
              )}
              {person.institute_affiliation && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 font-semibold flex items-center gap-1">
                  <span>🎓</span> {person.institute_affiliation}
                </span>
              )}
            </div>
          </div>

          <div className="my-5 border-t border-[var(--color-border)]" />

          {/* Humble Scrapbook Sections */}
          <div className="flex flex-col gap-4">
            {/* 1. What I can help with */}
            {person.help_offers && person.help_offers.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1.5">
                  <span>🤝</span> What I can help neighbors with
                </h4>
                <div className="flex flex-wrap gap-2">
                  {person.help_offers.map((offer, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                    >
                      {offer}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Tinkering with after 6 PM */}
            {person.tinkering_with && person.tinkering_with.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1.5">
                  <span>⚡</span> Tinkering with after 6 PM
                </h4>
                <div className="flex flex-wrap gap-2">
                  {person.tinkering_with.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Ask me about */}
            {person.ask_me_about && person.ask_me_about.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1.5">
                  <span>💬</span> Ask me about...
                </h4>
                <div className="flex flex-wrap gap-2">
                  {person.ask_me_about.map((topic, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Default state if user hasn't filled prompts */}
            {(!person.help_offers || person.help_offers.length === 0) &&
              (!person.tinkering_with || person.tinkering_with.length === 0) &&
              (!person.ask_me_about || person.ask_me_about.length === 0) && (
                <div className="p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-center">
                  <p className="text-xs text-[var(--color-text-secondary)] m-0">
                    This neighbor is active in the proximity network. Say hi or invite them for a 15-min chai!
                  </p>
                </div>
              )}
          </div>

          {/* Action Footer */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex items-center gap-3">
            {onStartChat && person.id && (
              <button
                type="button"
                onClick={() => onStartChat(person.id!)}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold shadow-md cursor-pointer"
              >
                <span>💬</span> Say Hi / Start Chat
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyProfile}
              className="btn btn-secondary flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer border border-[var(--color-border)]"
              title="Share community directory"
            >
              <span>{copied ? "✓ Copied!" : "🔗 Share"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
