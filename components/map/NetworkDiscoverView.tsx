"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SwipeCardStack } from "./SwipeCardStack";
import { ProximityCardModal } from "@/components/profile/ProximityCardModal";
import { useDiscoverRanking, type RankedProfile } from "@/lib/hooks/useDiscoverRanking";
import type { CompanyJobBundle } from "@/app/api/jobs/discover-company-jobs/route";

interface NetworkDiscoverViewProps {
  people: any[];
  profile: any;
  center?: { lat: number; lng: number } | null;
  loading?: boolean;
  onStartChat: (person: any) => void;
  onFollowToggle?: (e: React.MouseEvent, person: any) => void;
  onSwitchViewMode?: (mode: "list" | "map") => void;
  onExpandRadius?: () => void;
  is2kmFilterActive?: boolean;
}

export function NetworkDiscoverView({
  people,
  profile,
  center,
  loading = false,
  onStartChat,
  onFollowToggle,
  onSwitchViewMode,
  onExpandRadius,
  is2kmFilterActive = true,
}: NetworkDiscoverViewProps) {
  const [companyJobsMap, setCompanyJobsMap] = useState<Record<string, CompanyJobBundle>>({});
  const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set());
  const [selectedPersonForModal, setSelectedPersonForModal] = useState<any | null>(null);
  const [graffitiCelebration, setGraffitiCelebration] = useState<{
    name: string;
    company?: string;
  } | null>(null);

  // Fetch jobs & competitor bundles
  useEffect(() => {
    let isMounted = true;
    async function loadJobs() {
      try {
        const res = await fetch("/api/jobs/discover-company-jobs");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.bundles) {
            setCompanyJobsMap(data.bundles);
          }
        }
      } catch (err) {
        console.warn("[NetworkDiscoverView] Failed to load discover company jobs:", err);
      }
    }
    loadJobs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute rankings - all profiles are retained, no candidate filtering out!
  const rankedProfiles = useDiscoverRanking({
    people,
    profile,
    companyJobsMap,
  });

  // Handle Celebrate action (Graffiti + Notification)
  const handleCelebrate = useCallback(
    async (ranked: RankedProfile) => {
      const targetId = ranked.person.id;
      const targetName = ranked.person.full_name || ranked.person.anonymous_name || "Neighbor";
      const targetCompany = ranked.person.company || "";

      // Mark celebrated locally
      setCelebratedIds((prev) => new Set([...prev, targetId]));

      // Display celebratory graffiti banner
      setGraffitiCelebration({
        name: targetName,
        company: targetCompany,
      });

      // Auto-hide graffiti banner after 4.5 seconds
      setTimeout(() => {
        setGraffitiCelebration((curr) => (curr?.name === targetName ? null : curr));
      }, 4500);

      try {
        await fetch("/api/profile-celebrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetId,
            graffitiNote: "celebrated your professional profile and contributions!",
          }),
        });
      } catch (err) {
        console.error("[NetworkDiscoverView] Error celebrating profile:", err);
      }
    },
    []
  );

  const showSkeleton = loading && people.length === 0;

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[520px] py-2 relative">
      {/* ── Top Instructions Banner ── */}
      <div className="w-full max-w-md px-4 mb-2 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-[var(--color-primary)]">
          <span>🃏</span>
          <span>Proximity Cards</span>
        </span>
        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] hidden sm:inline">
          Swipe or click Next to explore • Tap to expand
        </span>
      </div>

      {/* ── Floating Graffiti Celebration Toast Banner ── */}
      {graffitiCelebration && (
        <div className="fixed top-18 z-50 left-1/2 -translate-x-1/2 w-[92%] max-w-md px-2 animate-fadeInDown">
          <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border-2 border-white/30 flex items-center gap-3 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0 shadow-inner">
              🎉
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 bg-black/20 px-1.5 py-0.5 rounded">
                  Graffiti Cheer
                </span>
                <span className="text-[11px] font-semibold text-white/90">Notification Sent</span>
              </div>
              <p className="text-xs sm:text-sm font-extrabold truncate m-0 mt-0.5">
                You celebrated {graffitiCelebration.name}!
              </p>
              <p className="text-[10px] text-white/80 m-0">
                A graffiti notice has been delivered to their ProxNet profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGraffitiCelebration(null)}
              className="text-white/70 hover:text-white p-1 rounded-lg border-0 bg-transparent text-sm cursor-pointer shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Main Stack Container ── */}
      {showSkeleton ? (
        <div className="relative w-full max-w-md h-[580px] flex items-center justify-center">
          <div className="w-full h-full max-h-[580px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 flex flex-col justify-between shadow-lg animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-[var(--color-border-light)] rounded-full" />
              <div className="h-6 w-20 bg-[var(--color-border-light)] rounded-full" />
            </div>
            <div className="flex items-center gap-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-border-light)] shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-3/4 bg-[var(--color-border-light)] rounded" />
                <div className="h-4 w-1/2 bg-[var(--color-border-light)] rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-16 w-full bg-[var(--color-border-light)] rounded-2xl" />
              <div className="h-20 w-full bg-[var(--color-border-light)] rounded-2xl" />
            </div>
            <div className="flex justify-around pt-4">
              <div className="w-20 h-10 rounded-full bg-[var(--color-border-light)]" />
              <div className="w-20 h-10 rounded-full bg-[var(--color-border-light)]" />
              <div className="w-20 h-10 rounded-full bg-[var(--color-border-light)]" />
            </div>
          </div>
        </div>
      ) : rankedProfiles.length > 0 ? (
        <SwipeCardStack
          profiles={rankedProfiles}
          onCelebrate={handleCelebrate}
          onOpenDetails={(rp) => setSelectedPersonForModal(rp.person)}
          onStartChat={onStartChat}
          celebratedIds={celebratedIds}
        />
      ) : (
        /* Only shown in the absolute edge case where people array is completely empty from database query */
        <div className="w-full max-w-md bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-4 shadow-sm animate-fadeIn my-6">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-3xl shadow-inner">
            📍
          </div>

          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)] m-0">
              No Profiles in Immediate Radius
            </h3>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs mx-auto">
              Expand your search radius or switch to list view to explore all verified professionals in your city.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
            {is2kmFilterActive && onExpandRadius && (
              <button
                type="button"
                onClick={onExpandRadius}
                className="btn btn-sm bg-[var(--color-primary)] text-white font-bold text-xs py-2.5 rounded-xl border-0 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-95 transition-all"
              >
                <span>🌍</span>
                <span>Expand Search Radius</span>
              </button>
            )}

            {onSwitchViewMode && (
              <button
                type="button"
                onClick={() => onSwitchViewMode("list")}
                className="btn btn-sm bg-[var(--color-surface-secondary)] text-[var(--color-text)] font-semibold text-xs py-2.5 rounded-xl border border-[var(--color-border-light)] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-all"
              >
                <span>📋</span>
                <span>View Full Directory</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Full Proximity Card Modal on Tap ── */}
      {selectedPersonForModal && (
        <ProximityCardModal
          person={selectedPersonForModal}
          currentUserProfile={profile}
          onClose={() => setSelectedPersonForModal(null)}
          onStartChat={onStartChat}
          onFollowToggle={onFollowToggle}
        />
      )}
    </div>
  );
}
