"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { calculateProfileCompleteness, getProfileCompletenessItems } from "@/lib/profile-validation";

export function ProfileTab() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setUser(data);
      })
      .catch((e) => console.error("Failed to load profile:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse p-4">
        <div className="h-44 rounded-2xl bg-[var(--color-surface-secondary)]" />
        <div className="h-64 rounded-2xl bg-[var(--color-surface-secondary)]" />
      </div>
    );
  }

  const completeness = user ? calculateProfileCompleteness(user) : 0;
  const items = user ? getProfileCompletenessItems(user) : [];
  const completedCount = items.filter((i) => i.completed).length;

  // SVG circular ring calculation (size 84, r 36)
  const radius = 36;
  const circumference = 2 * Math.PI * radius; // ~226.19
  const strokeDashoffset = circumference - (completeness / 100) * circumference;

  const ringColor =
    completeness >= 80 ? "#10b981" : completeness >= 50 ? "#3b82f6" : "#f59e0b";

  return (
    <div className="flex flex-col gap-6 animate-fadeIn max-w-2xl mx-auto pb-12">
      {/* Hero Profile Card with Peripheral Circle Ring */}
      <div className="p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
        {/* Avatar with Peripheral Circle Ring */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-24 h-24 -rotate-90 transform" viewBox="0 0 84 84">
            {/* Background Track */}
            <circle
              cx="42"
              cy="42"
              r={radius}
              stroke="var(--color-border-light)"
              strokeWidth="5"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="42"
              cy="42"
              r={radius}
              stroke={ringColor}
              strokeWidth="5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* User Image / Initials in Center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-xl flex items-center justify-center shadow-inner">
              {user?.profile_photo_url ? (
                <img
                  src={user.profile_photo_url}
                  alt={user?.full_name || "Profile"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{(user?.full_name || user?.userName || "U").charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>

          {/* % Badge Pill at bottom of circle */}
          <span
            className="absolute -bottom-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-xs"
            style={{ backgroundColor: ringColor }}
          >
            {completeness}%
          </span>
        </div>

        {/* User Metadata */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h2 className="text-xl font-bold text-[var(--color-text)] truncate m-0">
              {user?.full_name || "Professional"}
            </h2>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              ✓ Verified
            </span>
          </div>

          <p className="text-sm font-semibold text-[var(--color-text-secondary)] mt-1 mb-0.5 truncate">
            {user?.job_title ? `${user.job_title} @ ${user.company || "Stealth"}` : "Profile setup in progress"}
          </p>

          <p className="text-xs text-[var(--color-text-tertiary)] m-0">
            📍 {user?.home_name || "Neighborhood set"} &bull; ⚡ {user?.wallet ?? 0} Credits Available
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-4">
            <Link
              href="/profile"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-xs no-underline"
            >
              Edit Full Profile
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("openProfileWizard"))}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] transition-all cursor-pointer"
            >
              Complete Wizard
            </button>
          </div>
        </div>
      </div>

      {/* Profile Completeness Checklist */}
      <div className="p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)] m-0">
              Profile Completeness
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
              Completed {completedCount} of {items.length} sections ({completeness}% total)
            </p>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full border"
            style={{
              color: ringColor,
              backgroundColor: `${ringColor}15`,
              borderColor: `${ringColor}40`,
            }}
          >
            {completeness === 100 ? "All Complete 🎉" : `${100 - completeness}% to go`}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completeness}%`, backgroundColor: ringColor }}
          />
        </div>

        {/* Checklist items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {items.map((item) => (
            <div
              key={item.key}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                item.completed
                  ? "bg-emerald-500/5 border-emerald-500/20 text-[var(--color-text)]"
                  : "bg-[var(--color-surface-secondary)]/50 border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  item.completed ? "bg-emerald-500 text-white" : "bg-[var(--color-border)] text-transparent"
                }`}>
                  ✓
                </span>
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <span className="text-[10px] font-bold opacity-75">+{item.weight}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
