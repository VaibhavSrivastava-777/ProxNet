"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  previous_streak: number;
  status: "started" | "continued" | "broken" | "already_checked_in";
  just_incremented: boolean;
  just_broke: boolean;
  is_milestone: boolean;
  message: string;
}

export function useStreakTracker() {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const hasTriggeredRef = useRef(false);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    async function checkIn() {
      try {
        setLoading(true);
        const res = await fetch("/api/streak/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          // If unauthorized or error, silently exit
          return;
        }

        const data: StreakData = await res.json();
        setStreakData(data);

        // Check whether banner was already shown in this browser session today
        const todayStr = new Date().toISOString().split("T")[0];
        const lastShownSession = sessionStorage.getItem("proxnet_streak_shown_date");

        // Always show if:
        // 1. Never shown in this session today, OR
        // 2. Just broke (urgent feedback), OR
        // 3. Just incremented or hit milestone
        const shouldShow =
          lastShownSession !== todayStr ||
          data.just_broke ||
          data.just_incremented ||
          data.is_milestone;

        if (shouldShow && data.current_streak > 0) {
          sessionStorage.setItem("proxnet_streak_shown_date", todayStr);
          setShowBanner(true);
        }
      } catch (err) {
        console.warn("[useStreakTracker] Check-in error:", err);
      } finally {
        setLoading(false);
      }
    }

    checkIn();
  }, []);

  return {
    streakData,
    showBanner,
    dismissBanner,
    loading,
  };
}
