"use client";

import { useEffect, useState } from "react";

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
};

const DEFAULT_VALUE_PROP: ValuePropData = {
  tab: "default",
  badge: "PROXNET",
  icon: "🚀",
  headline: "Your Neighborhood Career Network",
  description: "Anonymous job referrals, candid career chats, and verified professional peers living right near you.",
  highlights: ["🔒 100% Anonymous", "🛡️ Google Verified", "📍 Hyperlocal Network"],
  accentColor: "var(--color-primary)",
  badgeBg: "rgba(0, 102, 255, 0.12)",
};

interface TabValueTransitionProps {
  activeTab: string;
  isLoading: boolean;
  minDisplayDurationMs?: number;
  onTransitionComplete?: () => void;
}

export function TabValueTransition({
  activeTab,
  isLoading,
  minDisplayDurationMs = 500,
  onTransitionComplete,
}: TabValueTransitionProps) {
  const [visible, setVisible] = useState(isLoading);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setFadingOut(false);
    } else if (visible && !fadingOut) {
      // Keep visible for minDisplayDurationMs so animation is smooth, then fade out
      const timer = setTimeout(() => {
        setFadingOut(true);
        const exitTimer = setTimeout(() => {
          setVisible(false);
          setFadingOut(false);
          onTransitionComplete?.();
        }, 300);
        return () => clearTimeout(exitTimer);
      }, minDisplayDurationMs);

      return () => clearTimeout(timer);
    }
  }, [isLoading, visible, fadingOut, minDisplayDurationMs, onTransitionComplete]);

  if (!visible) return null;

  const data = SCREEN_VALUE_PROPOSITIONS[activeTab] || DEFAULT_VALUE_PROP;

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center p-4 bg-[var(--color-bg)]/90 backdrop-blur-md transition-opacity duration-300 ${
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

        {/* Sleek Iridescent Indeterminate Loading Progress Bar */}
        <div className="w-48 h-1 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden relative shadow-inner">
          <div
            className="absolute top-0 bottom-0 w-24 rounded-full animate-indeterminate"
            style={{
              background: `linear-gradient(90deg, transparent, ${data.accentColor}, transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
