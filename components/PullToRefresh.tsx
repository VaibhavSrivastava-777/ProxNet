"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 75; // px needed to trigger refresh

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 5 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const dy = currentY - touchStartY.current;

      if (dy > 0 && window.scrollY <= 5) {
        const resistance = Math.min(1, 100 / (dy + 50));
        const distance = Math.min(dy * resistance, 100);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(55);

        if (typeof window !== "undefined" && navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }

        try {
          // Revalidate SWR caches and Next.js router
          await mutate(() => true, undefined, { revalidate: true });
          router.refresh();
        } catch (err) {
          console.error(err);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 500);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, mutate, router]);

  const isTriggered = pullDistance >= PULL_THRESHOLD;

  return (
    <div className="relative min-h-screen">
      {/* Floating Pull-To-Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-transform duration-75 flex items-center justify-center"
          style={{
            transform: `translate(-50%, ${Math.min(pullDistance * 0.8, 65)}px)`,
            opacity: Math.min(pullDistance / 25, 1),
          }}
        >
          <div className="bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border-light)] shadow-xl px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md">
            {isRefreshing ? (
              <>
                <svg className="animate-spin w-4 h-4 text-[var(--color-primary)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                </svg>
                <span>Updating ProxNet...</span>
              </>
            ) : isTriggered ? (
              <>
                <span className="text-emerald-500 font-extrabold text-sm">✓</span>
                <span>Release to refresh</span>
              </>
            ) : (
              <>
                <span className="inline-block transition-transform duration-150" style={{ transform: `rotate(${Math.min(pullDistance * 2.5, 180)}deg)` }}>
                  ⬇️
                </span>
                <span>Pull to refresh</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main App Content Wrapper */}
      <div
        style={{
          transform: pullDistance > 0 ? `translate3d(0, ${pullDistance * 0.35}px, 0)` : "none",
          transition: isPulling.current ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
