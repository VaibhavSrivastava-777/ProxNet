"use client";

import { useEffect, useState, useRef } from "react";

export interface ValuePropData {
  tab: string;
  badge: string;
  icon: string;
  headline: string;
  description: string;
  highlights: string[];
  accentColor: string;
  badgeBg: string;
}

export const SCREEN_VALUE_PROPOSITIONS: Record<string, ValuePropData> = {
  "/jobs": {
    tab: "/jobs",
    badge: "ANONYMOUS REFERRALS",
    icon: "💼",
    headline: "Get Referred Directly by Insiders",
    description: "Skip the ATS black hole. Connect with verified colleagues and neighbors inside top tech companies who can refer you directly.",
    highlights: ["⚡ 9x Higher Interview Rate", "🔒 100% Identity Protected", "🏢 Top Tech Clusters"],
    accentColor: "var(--color-primary)",
    badgeBg: "rgba(0, 102, 255, 0.12)",
  },
  "/network": {
    tab: "/network",
    badge: "HYPERLOCAL NETWORK",
    icon: "🗺️",
    headline: "Your Professional Neighborhood",
    description: "Discover verified software engineers, product managers, and leaders living and working within your neighborhood radius.",
    highlights: ["📍 Hyperlocal Radius", "🛡️ Spam-Free & Verified", "🤝 Peer-to-Peer"],
    accentColor: "#10b981",
    badgeBg: "rgba(16, 185, 129, 0.12)",
  },
  "/qa": {
    tab: "/qa",
    badge: "ENCRYPTED CAREER Q&A",
    icon: "💬",
    headline: "Candid, Anonymous Career Discussions",
    description: "Ask awkward questions about compensation, team culture, or interviews without putting your reputation on the line.",
    highlights: ["🔒 1-on-1 Encrypted", "👤 Reveal Only When Ready", "⚡ Direct Verified Answers"],
    accentColor: "#8b5cf6",
    badgeBg: "rgba(139, 92, 246, 0.12)",
  },
  "/forum": {
    tab: "/forum",
    badge: "LOCAL TECH COMMUNITY",
    icon: "☕",
    headline: "Neighborhood Tech Forum & Meetups",
    description: "Join local discussions on tech trends, neighborhood AMA sessions, and weekend in-person coffee meetups with nearby peers.",
    highlights: ["☕ Local Meetups", "💬 Candid Discussions", "🚀 Local Tech Community"],
    accentColor: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.12)",
  },
  "/grow": {
    tab: "/grow",
    badge: "NETWORK MULTIPLIER",
    icon: "🌱",
    headline: "Grow Your Local Network & Earn Status",
    description: "Invite verified peers and neighbors from your company and local community to unlock more job referrals and mutual connections.",
    highlights: ["🌱 Invite Rewards", "🏆 Tier Upgrades", "🤝 Local Network"],
    accentColor: "#059669",
    badgeBg: "rgba(5, 150, 105, 0.12)",
  },
};

export const DEFAULT_VALUE_PROP: ValuePropData = {
  tab: "default",
  badge: "PROXNET",
  icon: "🚀",
  headline: "Your Neighborhood Career Network",
  description: "Anonymous job referrals, candid career chats, and verified professional peers living right near you.",
  highlights: ["🔒 100% Anonymous", "🛡️ Google Verified", "📍 Hyperlocal Network"],
  accentColor: "var(--color-primary)",
  badgeBg: "rgba(0, 102, 255, 0.12)",
};

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

/**
 * Check if the user has opened this screen for the first time.
 */
export function isFirstTimeScreenOpening(tab: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  const cleanTab = tab.split("?")[0] || tab;
  return storage.getItem(`proxnet_screen_vp_seen_${cleanTab}`) !== "true";
}

/**
 * Mark that the user has seen the first-time value proposition for this screen.
 */
export function markScreenOpeningSeen(tab: string) {
  const storage = getLocalStorage();
  if (!storage) return;
  const cleanTab = tab.split("?")[0] || tab;
  storage.setItem(`proxnet_screen_vp_seen_${cleanTab}`, "true");
}

/**
 * Reset first-time screen tracking (useful for testing or re-onboarding).
 */
export function resetScreenOpeningSeen(tab?: string) {
  const storage = getLocalStorage();
  if (!storage) return;
  if (tab) {
    const cleanTab = tab.split("?")[0] || tab;
    storage.removeItem(`proxnet_screen_vp_seen_${cleanTab}`);
  } else {
    ["/jobs", "/network", "/qa", "/forum", "/grow"].forEach((t) => {
      storage.removeItem(`proxnet_screen_vp_seen_${t}`);
    });
  }
}

interface TabValueTransitionProps {
  activeTab: string;
  isLoading?: boolean;
  minDisplayDurationMs?: number; // Defaults to 5000ms (5s) for first-time screen opening
  onTransitionComplete?: () => void;
}

export function TabValueTransition({
  activeTab,
  isLoading = true,
  minDisplayDurationMs = 5000,
  onTransitionComplete,
}: TabValueTransitionProps) {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [progress, setProgress] = useState(0);
  const completeFiredRef = useRef(false);

  useEffect(() => {
    // Only display value proposition for the first time screen opening by user
    const firstTime = isFirstTimeScreenOpening(activeTab);
    if (!firstTime || !isLoading) {
      setVisible(false);
      if (!completeFiredRef.current) {
        completeFiredRef.current = true;
        onTransitionComplete?.();
      }
      return;
    }

    // First time opening this screen: keep displayed for at least 5 seconds irrespective of data load
    completeFiredRef.current = false;
    setVisible(true);
    setFadingOut(false);
    const duration = Math.max(5000, minDisplayDurationMs);
    setSecondsLeft(Math.ceil(duration / 1000));
    setProgress(0);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);

      const remainingSecs = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setSecondsLeft(remainingSecs);

      if (elapsed >= duration) {
        clearInterval(interval);
        markScreenOpeningSeen(activeTab);
        setFadingOut(true);
        setTimeout(() => {
          setVisible(false);
          setFadingOut(false);
          if (!completeFiredRef.current) {
            completeFiredRef.current = true;
            onTransitionComplete?.();
          }
        }, 300);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [activeTab, isLoading, minDisplayDurationMs, onTransitionComplete]);

  const handleSkip = () => {
    markScreenOpeningSeen(activeTab);
    setFadingOut(true);
    setTimeout(() => {
      setVisible(false);
      setFadingOut(false);
      if (!completeFiredRef.current) {
        completeFiredRef.current = true;
        onTransitionComplete?.();
      }
    }, 200);
  };

  if (!visible) return null;

  const cleanTab = activeTab.split("?")[0] || activeTab;
  const data = SCREEN_VALUE_PROPOSITIONS[cleanTab] || DEFAULT_VALUE_PROP;

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center p-4 bg-[var(--color-bg)]/95 backdrop-blur-md transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ top: "var(--nav-height, 56px)" }}
    >
      <div className="flex flex-col items-center max-w-md text-center animate-scaleIn">
        {/* Animated ProxNet Logo with Radial Glow & Pulse */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Subtle Outer Pulsing Wave */}
          <div
            className="absolute w-24 h-24 rounded-3xl opacity-30 animate-ping"
            style={{ backgroundColor: data.accentColor }}
          />

          {/* Glowing Radial Halo */}
          <div
            className="absolute w-28 h-28 rounded-full blur-xl opacity-40 transition-colors duration-500"
            style={{ backgroundColor: data.accentColor }}
          />

          {/* Logo Container with Smooth Breathing Motion */}
          <div
            className="relative w-16 h-16 rounded-2xl bg-[var(--color-surface)] p-2 shadow-2xl border border-[var(--color-border)] flex items-center justify-center animate-pulse"
            style={{
              boxShadow: `0 10px 30px -5px ${data.accentColor}40`,
            }}
          >
            <img
              src="/logo.png"
              alt="ProxNet"
              className="w-12 h-12 rounded-xl object-contain drop-shadow"
            />
          </div>
        </div>

        {/* Screen-Specific Value Proposition Pill Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-3 transition-all duration-300"
          style={{
            backgroundColor: data.badgeBg,
            color: data.accentColor,
            border: `1px solid ${data.accentColor}30`,
          }}
        >
          <span>{data.icon}</span>
          <span>{data.badge}</span>
        </div>

        {/* Bold Headline */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight mb-2 leading-snug">
          {data.headline}
        </h2>

        {/* Clear Value Proposition Description */}
        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed mb-5 max-w-sm">
          {data.description}
        </p>

        {/* Value Prop Feature Chips */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-6">
          {data.highlights.map((h) => (
            <span
              key={h}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] shadow-xs"
            >
              {h}
            </span>
          ))}
        </div>

        {/* 5-Second Progress Bar with Countdown & Skip Affordance */}
        <div className="flex flex-col items-center gap-2 w-56">
          <div className="w-full h-1.5 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden relative shadow-inner border border-[var(--color-border-light)]">
            <div
              className="h-full rounded-full transition-all duration-75 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundColor: data.accentColor,
                boxShadow: `0 0 10px ${data.accentColor}`,
              }}
            />
          </div>
          <div className="flex items-center justify-between w-full text-[11px] text-[var(--color-text-tertiary)] font-medium px-0.5">
            <span>{secondsLeft > 0 ? `Opening screen in ${secondsLeft}s...` : "Opening screen..."}</span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] underline cursor-pointer bg-transparent border-none text-[11px] font-semibold p-0"
              title="Skip transition"
            >
              Skip &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
