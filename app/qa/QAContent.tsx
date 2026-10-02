"use client";

import { JobsFeed } from "@/components/jobs/JobsFeed";
import { AppliedJobsTab } from "@/components/jobs/AppliedJobsTab";
import { NetworkChatTab } from "@/components/network/NetworkChatTab";
import { ProfileTab } from "@/components/profile/ProfileTab";
import { LocalForumFeed } from "@/components/home/LocalForumFeed";
import { GrowClient } from "@/components/grow/GrowClient";
import { TabValueTransition, isFirstTimeScreenOpening } from "@/components/common/TabValueTransition";
import { useStreakTracker } from "@/lib/hooks/useStreakTracker";
import { StreakGraffitiBanner } from "@/components/streak/StreakGraffitiBanner";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface QAContentProps {
  initialTab?: string;
}

const TAB_PATHS = ["/jobs", "/applied", "/network", "/profile", "/qa", "/forum", "/grow"];

export function QAContent({ initialTab }: QAContentProps) {
  const getComputedInitialTab = (): string => {
    if (initialTab) return initialTab;
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam) return `/${tabParam}`;
      const path = window.location.pathname;
      if (TAB_PATHS.includes(path)) return path;
    }
    return "/jobs";
  };

  const [activeTab, setActiveTab] = useState<string>(getComputedInitialTab);

  // Lazy-mount tabs: only initialize tabs that have been visited
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([getComputedInitialTab()]));

  // Screen-specific animated value proposition transition state
  const [isTransitioning, setIsTransitioning] = useState<boolean>(() => {
    return isFirstTimeScreenOpening(getComputedInitialTab());
  });

  const searchParams = useSearchParams();
  const router = useRouter();

  // Diligence Streak tracking & Graffiti banner
  const { streakData, showBanner, dismissBanner } = useStreakTracker();

  // Update visited tabs whenever activeTab changes
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Tab state listener and browser history sync
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const currentParamTab = tabParam ? `/${tabParam}` : "";

    if (currentParamTab && TAB_PATHS.includes(currentParamTab) && currentParamTab !== activeTab) {
      if (isFirstTimeScreenOpening(currentParamTab)) {
        setIsTransitioning(true);
      } else {
        setIsTransitioning(false);
      }
      setActiveTab(currentParamTab);
      const companyParam = searchParams.get("company");
      const suffix = companyParam ? `?company=${encodeURIComponent(companyParam)}` : "";
      window.history.replaceState(null, "", currentParamTab + suffix);
    }

    const handleTabChange = (e: Event) => {
      const targetTab = (e as CustomEvent).detail;
      if (TAB_PATHS.includes(targetTab) && targetTab !== activeTab) {
        if (isFirstTimeScreenOpening(targetTab)) {
          setIsTransitioning(true);
        } else {
          setIsTransitioning(false);
        }
        setActiveTab(targetTab);
      }
    };

    const handlePopState = () => {
      if (TAB_PATHS.includes(window.location.pathname) && window.location.pathname !== activeTab) {
        if (isFirstTimeScreenOpening(window.location.pathname)) {
          setIsTransitioning(true);
        } else {
          setIsTransitioning(false);
        }
        setActiveTab(window.location.pathname);
      }
    };

    window.addEventListener("tabchange", handleTabChange);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("tabchange", handleTabChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [searchParams, activeTab]);

  return (
    <div className="w-full relative">
      {/* Screen Load Animated Value Proposition & Logo */}
      <TabValueTransition
        key={activeTab}
        activeTab={activeTab}
        isLoading={isTransitioning}
        minDisplayDurationMs={600}
        onTransitionComplete={() => setIsTransitioning(false)}
      />

      {/* Daily Diligence Streak Graffiti Banner */}
      {!isTransitioning && showBanner && (
        <StreakGraffitiBanner
          streakData={streakData}
          onDismiss={dismissBanner}
        />
      )}

      {/* ── 1. Jobs Tab (Hero) ── */}
      {visitedTabs.has("/jobs") && (
        <div className={activeTab === "/jobs" ? "block" : "hidden"}>
          <div className="mx-auto max-w-4xl py-3 md:py-4 p-3 md:p-4 animate-fadeIn" style={{ paddingBottom: "4rem" }}>
            <JobsFeed />

            {/* Footer links */}
            <div className="mt-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-tertiary)] text-center">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <a href="/privacy" className="hover:text-[var(--color-accent)] transition-colors">Privacy</a>
                <span>&bull;</span>
                <a href="/delete-account" className="hover:text-[var(--color-accent)] transition-colors">Delete Account</a>
                <span>&bull;</span>
                <a href="/safety" className="hover:text-[var(--color-accent)] transition-colors">Safety</a>
                <span>&bull;</span>
                <a href="/disclaimer" className="hover:text-[var(--color-accent)] transition-colors">Disclaimer</a>
                <span>&bull;</span>
                <a href="https://www.instagram.com/proxnet.connect/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">Contact Us</a>
              </div>
              <div>&copy; ProxNet 2026</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Applied Tab ── */}
      {visitedTabs.has("/applied") && (
        <div className={activeTab === "/applied" ? "block" : "hidden"}>
          <div className="mx-auto max-w-4xl py-3 md:py-4 p-3 md:p-4 animate-fadeIn" style={{ paddingBottom: "4rem" }}>
            <AppliedJobsTab />
          </div>
        </div>
      )}

      {/* ── 3. Network & Chat Tab ── */}
      {(visitedTabs.has("/network") || visitedTabs.has("/qa")) && (
        <div className={activeTab === "/network" || activeTab === "/qa" ? "block" : "hidden"}>
          <div className="mx-auto max-w-4xl py-3 md:py-4 p-3 md:p-4 animate-fadeIn" style={{ paddingBottom: "4rem" }}>
            <NetworkChatTab />
          </div>
        </div>
      )}

      {/* ── 4. Profile Tab ── */}
      {visitedTabs.has("/profile") && (
        <div className={activeTab === "/profile" ? "block" : "hidden"}>
          <div className="mx-auto max-w-4xl py-3 md:py-4 p-3 md:p-4 animate-fadeIn" style={{ paddingBottom: "4rem" }}>
            <ProfileTab />
          </div>
        </div>
      )}

      {/* ── 5. Forum (Top Right Header Target) ── */}
      {visitedTabs.has("/forum") && (
        <div className={activeTab === "/forum" ? "block" : "hidden"}>
          <div className="mx-auto max-w-4xl p-0 md:p-4">
            <LocalForumFeed />
          </div>
        </div>
      )}

      {/* ── 6. Grow Tab ── */}
      {visitedTabs.has("/grow") && (
        <div className={activeTab === "/grow" ? "block" : "hidden"}>
          <GrowClient />
        </div>
      )}
    </div>
  );
}

export default function QAContentWrapper({ initialTab }: { initialTab?: string }) {
  return (
    <Suspense
      fallback={
        <TabValueTransition
          activeTab={initialTab || "/jobs"}
          isLoading={true}
          minDisplayDurationMs={600}
        />
      }
    >
      <QAContent initialTab={initialTab} />
    </Suspense>
  );
}
