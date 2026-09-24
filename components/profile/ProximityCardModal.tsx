"use client";

import React, { useState } from "react";
import { CompanyLogo } from "@/components/qa/QuestionList";

export interface ProximityCardModalProps {
  person: any;
  currentUserProfile?: any;
  onClose: () => void;
  onStartChat?: (person: any) => void;
  onFollowToggle?: (e: React.MouseEvent, person: any) => void;
  onJoinBeacon?: (beacon: any, person: any) => void;
  userBeacon?: any;
}

const CHAT_PREF_LABELS: Record<string, { label: string; icon: string }> = {
  chai: { label: "Down for a 15-min chai", icon: "☕" },
  walk: { label: "Evening walk & talk", icon: "🚶" },
  weekend_coffee: { label: "Weekend coffee friendly", icon: "🥐" },
  dm_only: { label: "Direct messages preferred", icon: "💬" },
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

function computeReasonToEngage(myProfile: any, targetPerson: any): { reason: string; category: string } | null {
  if (!myProfile || !targetPerson) return null;

  const myCompany = (myProfile.company || "").trim().toLowerCase();
  const targetCompany = (targetPerson.company || "").trim().toLowerCase();

  // 1. Same Company
  if (myCompany && targetCompany && myCompany === targetCompany && myCompany.length > 1) {
    return {
      reason: `Both of you work at ${targetPerson.company}`,
      category: "company",
    };
  }

  // 2. Shared Institute / Alumni Network
  const myInst = (myProfile.institute_name || "").trim().toLowerCase();
  const targetInst = (targetPerson.institute_name || "").trim().toLowerCase();
  if (myInst && targetInst && myInst === targetInst) {
    return {
      reason: `Both of you are alumni of ${targetPerson.institute_name}`,
      category: "education",
    };
  }

  // 3. Shared Residential Society / Complex
  const mySoc = (myProfile.society_name || "").trim().toLowerCase();
  const targetSoc = (targetPerson.society_name || "").trim().toLowerCase();
  if (mySoc && targetSoc && mySoc === targetSoc) {
    return {
      reason: `Both of you live in ${targetPerson.society_name}`,
      category: "society",
    };
  }

  // 4. Same Role / Occupation
  const myRole = (myProfile.job_title || "").trim().toLowerCase();
  const targetRole = (targetPerson.job_title || "").trim().toLowerCase();
  if (myRole && targetRole) {
    const roleKeywords = ["developer", "engineer", "designer", "product", "manager", "architect", "consultant", "analyst", "founder", "director", "marketer", "recruiter"];
    for (const kw of roleKeywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, "i");
      if (kwRegex.test(myRole) && kwRegex.test(targetRole)) {
        return {
          reason: `Both of you work in ${targetPerson.job_title} roles`,
          category: "occupation",
        };
      }
    }
  }

  return null;
}

export function ProximityCardModal({
  person,
  currentUserProfile,
  onClose,
  onStartChat,
  onFollowToggle,
  onJoinBeacon,
  userBeacon,
}: ProximityCardModalProps) {
  const [copied, setCopied] = useState(false);

  if (!person) return null;

  const visibility = person.visibility || {
    showCompany: true,
    showTitle: true,
    showPhoto: true,
  };

  const pref = person.quick_chat_preference
    ? CHAT_PREF_LABELS[person.quick_chat_preference] || {
        label: person.quick_chat_preference,
        icon: "☕",
      }
    : { label: "Down for a 15-min chai", icon: "☕" };

  const displayName = person.full_name || person.anonymous_name || "Neighbor Professional";
  const displayCompany = visibility.showCompany !== false
    ? person.company || "Independent / Startup"
    : "Company Protected";
  const displayTitle = visibility.showTitle !== false
    ? person.job_title || "Professional"
    : "Title Protected";
  const showPhoto = visibility.showPhoto !== false && !!person.profile_photo_url;

  const engagement = computeReasonToEngage(currentUserProfile, person);
  const distanceStr = formatDistance(person.distance);

  const handleShare = () => {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/network` : "https://www.proxnet.in/network";
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-all animate-scaleIn max-h-[92vh] flex flex-col"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with proximity badge & Close Button */}
        <div className="h-28 w-full bg-gradient-to-r from-blue-500/20 via-teal-500/20 to-purple-500/25 p-4 flex items-start justify-between border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/40 text-white backdrop-blur-sm border border-white/10">
              <span>📍</span> Network Proximity View
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {distanceStr}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors border border-white/10 cursor-pointer text-sm font-bold shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Card Body */}
        <div className="px-6 pb-6 pt-0 relative -mt-10 overflow-y-auto flex-1">
          {/* Avatar and Quick Chat Preference Row */}
          <div className="flex items-end justify-between mb-4">
            <div className="relative">
              {showPhoto ? (
                <img
                  src={person.profile_photo_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-[var(--color-surface)] shadow-md bg-[var(--color-surface-secondary)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl border-4 border-[var(--color-surface)] shadow-md">
                  {getInitials(displayName)}
                </div>
              )}
              {person.company && visibility.showCompany !== false && (
                <div className="absolute -bottom-1 -right-1 bg-[var(--color-surface)] p-1 rounded-lg shadow-sm border border-[var(--color-border)]">
                  <CompanyLogo company={person.company} size={20} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <span>{pref.icon}</span> {pref.label}
              </span>
            </div>
          </div>

          {/* Name & Headline */}
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--color-text)] m-0">
                {displayName}
              </h2>
              {person.anonymous_name && (
                <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                  @{person.anonymous_name}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-[var(--color-text-secondary)] m-0">
              {displayTitle} {visibility.showCompany !== false && person.company ? `at ${displayCompany}` : ""}
            </p>

            {(person.society_name || person.institute_name || person.institute_affiliation) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--color-text-tertiary)]">
                {person.society_name && (
                  <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    <span>🏡</span> {person.society_name}
                  </span>
                )}
                {(person.institute_name || person.institute_affiliation) && (
                  <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    <span>🎓</span> {person.institute_name || person.institute_affiliation}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Reason to Engage Callout */}
          {engagement && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm animate-fadeIn mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">✨</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Reason to Engage
                </span>
              </div>
              <p className="text-xs font-serif italic leading-relaxed m-0 text-amber-800 dark:text-amber-100">
                "{engagement.reason}"
              </p>
            </div>
          )}

          {/* Live Beacon Callout (if active) */}
          {userBeacon && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    Live Beacon Active
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {userBeacon.activity === "chai" ? "☕ Ready for Chai" : userBeacon.activity === "walk" ? "🚶 Out for a Walk" : "🤝 Quick Meet"}
                    {userBeacon.note ? ` • "${userBeacon.note}"` : ""}
                  </span>
                </div>
              </div>
              {onJoinBeacon && (
                <button
                  type="button"
                  onClick={() => onJoinBeacon(userBeacon, person)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm border-none cursor-pointer transition-transform hover:scale-105"
                >
                  Join Now
                </button>
              )}
            </div>
          )}

          {/* Professional Bio / About */}
          {(person.professional_bio || person.about) && (
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
              <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold text-[var(--color-text)]">
                <span>📝</span> Professional Bio
              </div>
              {person.professional_bio || person.about}
            </div>
          )}

          {/* Neighbor Scrapbook Tags */}
          <div className="space-y-3 pt-1 border-t border-[var(--color-border-light)]">
            {person.help_offers && person.help_offers.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1.5">
                  I Can Help With:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {person.help_offers.map((offer: string, idx: number) => (
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

            {person.tinkering_with && person.tinkering_with.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1.5">
                  Tinkering With:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {person.tinkering_with.map((item: string, idx: number) => (
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

            {person.ask_me_about && person.ask_me_about.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1.5">
                  Ask Me About:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {person.ask_me_about.map((topic: string, idx: number) => (
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

            {/* Default state if user hasn't filled tags */}
            {(!person.help_offers || person.help_offers.length === 0) &&
              (!person.tinkering_with || person.tinkering_with.length === 0) &&
              (!person.ask_me_about || person.ask_me_about.length === 0) && (
                <div className="p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-center text-xs text-[var(--color-text-secondary)]">
                  Neighbor is active in the local proximity network. Say hi or invite them for a chai!
                </div>
              )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border-light)] flex items-center gap-3">
            {onStartChat && (
              <button
                type="button"
                onClick={() => onStartChat(person)}
                className="flex-1 py-2.5 px-4 text-center text-xs font-bold rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>👋</span> Say Hi / Chat
              </button>
            )}

            {onFollowToggle && (
              <button
                type="button"
                onClick={(e) => onFollowToggle(e, person)}
                className={`py-2.5 px-4 text-center text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  person.is_followed
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-[var(--color-primary)]/20"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {person.is_followed ? "✓ Following" : "+ Follow"}
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="py-2.5 px-3 text-center text-xs font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-all cursor-pointer flex items-center justify-center gap-1"
              title="Share profile"
            >
              <span>{copied ? "✓ Copied!" : "🔗 Share"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
