"use client";

import React, { useEffect, useState, useRef } from "react";
import type { StreakData } from "@/lib/hooks/useStreakTracker";
import { playNotificationSound } from "@/lib/sound";

interface StreakGraffitiBannerProps {
  streakData: StreakData | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

const QUOTES_CONTINUED = [
  "Consistency is the code that turns ambition into reality.",
  "Diligence compounds silently — until the results speak loud.",
  "Showing up every day separates the best from the rest.",
  "Your neighborhood notice board is paying attention. Keep moving!",
  "Great careers aren't made in leaps — they are built day by day.",
];

const QUOTES_BROKEN = [
  "Streak slipped, but your momentum remains. Build it back stronger!",
  "Day 1 is where every legend began. Time for a comeback.",
  "Consistency is not never falling, it's rising every single time.",
  "Today is your fresh slate. Let's start the next record streak.",
];

const QUOTES_MILESTONE = [
  "Legendary diligence! You are in the top tier of active professionals.",
  "Unstoppable momentum! A streak this strong opens serious doors.",
  "This level of consistency commands respect across the neighborhood.",
];

export function StreakGraffitiBanner({
  streakData,
  onDismiss,
  autoDismissMs = 6500,
}: StreakGraffitiBannerProps) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const elapsedRef = useRef(0);

  if (!streakData || streakData.current_streak <= 0) return null;

  const isBroken = streakData.just_broke || streakData.status === "broken";
  const isMilestone = streakData.is_milestone;
  const streakCount = streakData.current_streak;
  const brokenFromCount = streakData.previous_streak || 1;

  // Pick deterministic quote based on streak count
  const quote = isMilestone
    ? QUOTES_MILESTONE[streakCount % QUOTES_MILESTONE.length]
    : isBroken
    ? QUOTES_BROKEN[brokenFromCount % QUOTES_BROKEN.length]
    : QUOTES_CONTINUED[streakCount % QUOTES_CONTINUED.length];

  // Sound effect on mount
  useEffect(() => {
    try {
      if (isMilestone) {
        playNotificationSound("job_match");
      } else if (!isBroken) {
        playNotificationSound("chime");
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, [isMilestone, isBroken]);

  // Auto-dismiss countdown with pause support
  useEffect(() => {
    let animFrame: number;
    let lastTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;

      if (!isPaused) {
        elapsedRef.current += delta;
        const remaining = Math.max(0, autoDismissMs - elapsedRef.current);
        const pct = (remaining / autoDismissMs) * 100;
        setProgress(pct);

        if (remaining <= 0) {
          onDismiss();
          return;
        }
      }

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [autoDismissMs, isPaused, onDismiss]);

  // Color schemes based on streak state
  const themeStyles = isMilestone
    ? {
        gradientBg: "from-amber-600 via-yellow-500 to-emerald-600",
        tagBg: "bg-amber-950/40 text-amber-200 border-amber-300/40",
        glow: "shadow-[0_0_35px_rgba(234,179,8,0.45)]",
        flameEmoji: "✨",
        titlePrefix: "MILESTONE UNLOCKED 🏆",
      }
    : isBroken
    ? {
        gradientBg: "from-rose-700 via-pink-800 to-slate-900",
        tagBg: "bg-rose-950/50 text-rose-200 border-rose-400/40",
        glow: "shadow-[0_0_35px_rgba(244,63,94,0.4)]",
        flameEmoji: "💔",
        titlePrefix: "STREAK RESET NOTICE",
      }
    : {
        gradientBg: "from-orange-600 via-red-600 to-purple-700",
        tagBg: "bg-black/30 text-amber-200 border-amber-400/30",
        glow: "shadow-[0_0_35px_rgba(249,115,22,0.45)]",
        flameEmoji: "🔥",
        titlePrefix: "DAILY DILIGENCE",
      };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[94%] max-w-lg animate-fadeInDown"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${themeStyles.gradientBg} p-1 text-white ${themeStyles.glow} border border-white/25 backdrop-blur-xl transition-all duration-300 hover:scale-[1.01]`}
      >
        {/* Graffiti Splatter Background Texture */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative rounded-[22px] bg-black/25 p-4 sm:p-5 flex flex-col gap-3">
          {/* Top Bar: Graffiti Tag + Close Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] sm:text-[11px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full border ${themeStyles.tagBg} shadow-sm inline-flex items-center gap-1.5`}
              >
                <span>{themeStyles.flameEmoji}</span>
                <span>{themeStyles.titlePrefix}</span>
              </span>

              {streakData.longest_streak > 1 && (
                <span className="text-[10px] font-semibold text-white/80 bg-white/10 px-2 py-0.5 rounded-full">
                  Best: #{streakData.longest_streak}d
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 transition-all p-1.5 rounded-full border-0 cursor-pointer flex items-center justify-center w-7 h-7 shrink-0"
              aria-label="Dismiss streak banner"
            >
              ✕
            </button>
          </div>

          {/* Main Headline with High-Impact Graffiti Typography */}
          <div className="space-y-1">
            {isBroken ? (
              <div>
                <h3 className="text-base sm:text-lg font-black text-white leading-snug m-0 drop-shadow-md">
                  Your Diligence Streak of #{brokenFromCount} days broke, Streak count #1 now
                </h3>
                <p className="text-xs sm:text-sm text-rose-100/90 font-medium m-0 mt-1">
                  Don&apos;t look back — day 1 of your new record starts right now!
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-none m-0 drop-shadow-lg">
                    Your Diligence Streak #{streakCount} {streakCount === 1 ? "day" : "days"}
                  </h3>
                  <span className="text-xs sm:text-sm font-extrabold text-amber-300 uppercase tracking-wider">
                    {isMilestone ? "🔥 Milestone!" : "Active! 🔥"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-white/90 font-medium m-0 mt-1">
                  {streakData.just_incremented
                    ? "Streak extended! You checked in for another consecutive day."
                    : "You checked in today. Your diligence streak is protected!"}
                </p>
              </div>
            )}
          </div>

          {/* Motivational Graffiti Quote Pill */}
          <div className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] sm:text-xs text-white/90 italic flex items-center gap-2">
            <span className="text-amber-300 font-bold shrink-0">⚡</span>
            <span className="truncate sm:whitespace-normal">&ldquo;{quote}&rdquo;</span>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-white/70 font-mono">
              {streakCount >= 7 ? "🏅 7-day club unlocked" : "Daily check-in protects your streak"}
            </span>

            <button
              type="button"
              onClick={onDismiss}
              className="text-[11px] font-bold bg-white text-slate-900 px-3 py-1.5 rounded-full hover:bg-amber-100 transition-transform active:scale-95 shadow-md border-0 cursor-pointer"
            >
              Got it! 🚀
            </button>
          </div>

          {/* Smooth Auto-Dismiss Progress Bar */}
          <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-white transition-all ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
