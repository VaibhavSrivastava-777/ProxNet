"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { DiscoverCard } from "./DiscoverCard";
import type { RankedProfile } from "@/lib/hooks/useDiscoverRanking";

interface SwipeCardStackProps {
  profiles: RankedProfile[];
  onCelebrate: (profile: RankedProfile) => void;
  onOpenDetails: (profile: RankedProfile) => void;
  onStartChat: (person: any) => void;
  celebratedIds?: Set<string>;
}

const SWIPE_THRESHOLD = 80;

export function SwipeCardStack({
  profiles,
  onCelebrate,
  onOpenDetails,
  onStartChat,
  celebratedIds = new Set(),
}: SwipeCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [transitioning, setTransitioning] = useState<"next" | "prev" | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalScrollRef = useRef<boolean | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const total = profiles.length;
  // Get active 3 profiles with wrap-around so stack is always full
  const topProfile = profiles[currentIndex % total];
  const secondProfile = profiles[(currentIndex + 1) % total];
  const thirdProfile = profiles[(currentIndex + 2) % total];

  const activeProfiles = [
    { profile: topProfile, position: 0 },
    { profile: secondProfile, position: 1 },
    { profile: thirdProfile, position: 2 },
  ].filter((item) => item.profile != null);

  const advanceNext = useCallback(() => {
    if (transitioning || total === 0) return;
    setTransitioning("next");
    setDragOffset(0);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      setTransitioning(null);
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 200);
  }, [transitioning, total]);

  const advancePrev = useCallback(() => {
    if (transitioning || total === 0) return;
    setTransitioning("prev");
    setDragOffset(0);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      setTransitioning(null);
      setCurrentIndex((prev) => (prev - 1 + total) % total);
    }, 200);
  }, [transitioning, total]);

  const triggerCelebrate = useCallback(() => {
    if (!topProfile) return;
    onCelebrate(topProfile);
  }, [topProfile, onCelebrate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        advanceNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        advancePrev();
      } else if (e.key === " " || e.key === "Enter") {
        if (topProfile) {
          e.preventDefault();
          onOpenDetails(topProfile);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceNext, advancePrev, topProfile, onOpenDetails]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (transitioning || !topProfile) return;
    if ((e.target as HTMLElement)?.closest("button, a, select, input")) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isHorizontalScrollRef.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || transitioning) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - startXRef.current;
    const diffY = touch.clientY - startYRef.current;

    if (isHorizontalScrollRef.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalScrollRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalScrollRef.current) {
      setDragOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset < -SWIPE_THRESHOLD) {
      // Swiping left: navigate to previous profile in circular loop
      advancePrev();
    } else if (dragOffset > SWIPE_THRESHOLD) {
      // Swiping right: navigate to next profile in circular loop
      advanceNext();
    } else {
      setDragOffset(0);
    }
  };

  // Mouse Handlers for Desktop Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (transitioning || !topProfile) return;
    if ((e.target as HTMLElement)?.closest("button, a, select, input")) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || transitioning) return;
    const diffX = e.clientX - startXRef.current;
    setDragOffset(diffX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset < -SWIPE_THRESHOLD) {
      // Dragging left: navigate to previous profile
      advancePrev();
    } else if (dragOffset > SWIPE_THRESHOLD) {
      // Dragging right: navigate to next profile
      advanceNext();
    } else {
      setDragOffset(0);
    }
  };

  if (!topProfile) {
    return null;
  }

  const isTopCelebrated = topProfile ? celebratedIds.has(topProfile.person.id) : false;

  return (
    <div className="w-full flex flex-col items-center">
      {/* ── Carousel Stack Container ── */}
      <div
        className="relative w-full max-w-md mx-auto h-[640px] max-h-[76vh] flex items-center justify-center touch-pan-y"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {activeProfiles.map(({ profile: p, position }) => {
          const isTop = position === 0;
          const isSecond = position === 1;
          const isThird = position === 2;

          let transform = "";
          let opacity = 1;
          let transition =
            isDragging && isTop
              ? "none"
              : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease";

          if (isTop) {
            if (transitioning === "prev") {
              transform = "translate3d(-105%, 15px, 0) rotate(-15deg)";
              opacity = 0;
            } else if (transitioning === "next") {
              transform = "translate3d(105%, 15px, 0) rotate(15deg)";
              opacity = 0;
            } else if (isDragging) {
              const rot = Math.max(-12, Math.min(12, dragOffset * 0.05));
              transform = `translate3d(${dragOffset}px, ${Math.abs(dragOffset) * 0.03}px, 0) rotate(${rot}deg)`;
            } else {
              transform = "translate3d(0, 0, 0) rotate(0deg)";
              opacity = 1;
            }
          } else if (isSecond) {
            const progress = transitioning ? 1 : Math.min(1, Math.abs(dragOffset) / 120);
            const scale = 0.95 + 0.05 * progress;
            const translateY = 10 - 10 * progress;
            transform = `scale(${scale}) translateY(${translateY}px)`;
            opacity = 0.85 + 0.15 * progress;
          } else if (isThird) {
            const progress = transitioning ? 1 : Math.min(1, Math.abs(dragOffset) / 120);
            const scale = 0.9 + 0.05 * progress;
            const translateY = 20 - 10 * progress;
            transform = `scale(${scale}) translateY(${translateY}px)`;
            opacity = 0.65 + 0.2 * progress;
          }

          const zIndex = 30 - position * 10;
          const isCardCelebrated = celebratedIds.has(p.person.id);

          return (
            <div
              key={`${p.person.id}-${position}`}
              onTouchStart={isTop ? handleTouchStart : undefined}
              onTouchMove={isTop ? handleTouchMove : undefined}
              onTouchEnd={isTop ? handleTouchEnd : undefined}
              onTouchCancel={isTop ? handleTouchEnd : undefined}
              onMouseDown={isTop ? handleMouseDown : undefined}
              className="absolute inset-0 flex items-center justify-center p-2 sm:p-0 will-change-transform"
              style={{
                zIndex,
                transform,
                opacity,
                transition,
                pointerEvents: isTop ? "auto" : "none",
              }}
            >
              <DiscoverCard
                profile={p}
                onCelebrate={triggerCelebrate}
                onNext={advanceNext}
                onOpenDetails={() => onOpenDetails(p)}
                onStartChat={onStartChat}
                dragOffset={isTop ? dragOffset : 0}
                isCelebrated={isCardCelebrated}
              />
            </div>
          );
        })}
      </div>

      {/* ── Carousel Stack Navigation Indicator & Controls ── */}
      <div className="w-full max-w-md px-6 pt-3 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <button
          type="button"
          onClick={advancePrev}
          className="flex items-center gap-1 font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] bg-transparent border-0 cursor-pointer transition-colors p-1"
          title="Previous Profile"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Prev</span>
        </button>

        <div className="flex items-center gap-1.5 font-bold text-[11px] bg-[var(--color-surface-secondary)] px-3 py-1 rounded-full border border-[var(--color-border-light)]">
          <span>Profile {(currentIndex % total) + 1} of {total}</span>
          <span className="text-[var(--color-text-tertiary)]">• Best Matches First</span>
        </div>

        <button
          type="button"
          onClick={advanceNext}
          className="flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:opacity-80 bg-transparent border-0 cursor-pointer transition-colors p-1"
          title="Next Profile"
        >
          <span>Next</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
