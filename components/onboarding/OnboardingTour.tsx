"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ONBOARDING_STEPS, OnboardingStep } from "@/lib/onboarding-steps";

const TOUR_STORAGE_KEY = "proxnet_tour_completed";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Finds the first VISIBLE DOM element matching a given CSS selector.
 * Prevents targeting hidden elements (e.g. desktop nav elements on mobile viewports).
 */

function getVisibleElement(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const elements = document.querySelectorAll<HTMLElement>(selector);
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    ) {
      return el;
    }
  }
  return null;
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top?: number; left?: number; bottom?: number } | null>(null);

  const currentStep: OnboardingStep | undefined = ONBOARDING_STEPS[stepIndex];

  // Start tour function
  const startTour = useCallback((fromFirstStep = true) => {
    if (fromFirstStep) {
      setStepIndex(0);
    }
    setActive(true);
  }, []);

  // Check if tour should auto-run on mount or via custom event trigger
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY) === "true";

    const handleOpenTour = () => {
      startTour(true);
    };

    window.addEventListener("open-proxnet-tour", handleOpenTour);

    if (!tourCompleted) {
      const timer = setTimeout(() => {
        startTour(true);
      }, 800);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("open-proxnet-tour", handleOpenTour);
      };
    }

    return () => {
      window.removeEventListener("open-proxnet-tour", handleOpenTour);
    };
  }, [startTour]);

  // Update spotlight cutout and tooltip positions
  const updatePositions = useCallback(() => {
    if (!active || !currentStep) return;

    // Trigger tab switch if defined for this step
    if (currentStep.tabHref) {
      window.dispatchEvent(new CustomEvent("tabchange", { detail: currentStep.tabHref }));
    }

    if (!currentStep.target) {
      setTargetRect(null);
      setTooltipPos(null);
      return;
    }

    const el = getVisibleElement(currentStep.target);
    if (!el) {
      setTargetRect(null);
      setTooltipPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();

    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    const padding = 14;
    const tooltipWidth = Math.min(window.innerWidth - 32, 340);

    // Center tooltip relative to target element horizontally, clamped to viewport margins
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

    let top: number | undefined;
    let bottom: number | undefined;

    // Place tooltip above or below depending on element's vertical position
    if (rect.top > window.innerHeight / 2) {
      bottom = window.innerHeight - rect.top + padding;
    } else {
      top = rect.top + rect.height + padding;
    }

    setTooltipPos({ top, bottom, left });
  }, [active, currentStep]);

  // Run position calculation with multi-pass retries for dynamic tab/DOM updates
  useEffect(() => {
    if (!active || !currentStep) return;

    updatePositions();

    const timer1 = setTimeout(updatePositions, 50);
    const timer2 = setTimeout(updatePositions, 150);
    const timer3 = setTimeout(updatePositions, 350);

    const handleResizeOrScroll = () => {
      updatePositions();
    };

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [active, stepIndex, currentStep, updatePositions]);

  const completeTour = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setActive(false);
  };

  const nextStep = () => {
    if (stepIndex < ONBOARDING_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  if (!active || !currentStep) return null;

  const totalSteps = ONBOARDING_STEPS.length;
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-[10050] pointer-events-auto select-none">
      {/* Dynamic Backdrop with Spotlight Cutout */}
      {targetRect ? (
        <div
          className="fixed transition-all duration-300 ease-out rounded-xl pointer-events-none"
          style={{
            top: Math.max(0, targetRect.top - 6),
            left: Math.max(0, targetRect.left - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7)",
            border: "2.5px solid var(--color-primary, #0A66C2)",
            animation: "pulse-glow 2s infinite ease-in-out",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-300" />
      )}

      {/* Tooltip Card */}
      <div
        className="fixed z-[10051] w-[calc(100vw-32px)] max-w-[340px] bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-2xl transition-all duration-300 animate-scaleIn"
        style={
          tooltipPos
            ? {
                top: tooltipPos.top !== undefined ? `${tooltipPos.top}px` : undefined,
                bottom: tooltipPos.bottom !== undefined ? `${tooltipPos.bottom}px` : undefined,
                left: `${tooltipPos.left}px`,
              }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
      >
        {/* Progress Bar */}
        <div className="w-full bg-[var(--color-surface-hover)] h-1.5 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-2.5 py-0.5 rounded-full">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={completeTour}
            className="text-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            Skip
          </button>
        </div>

        {/* Step Title & Description */}
        <h3 className="text-h3 text-[var(--color-text)] font-bold mb-2 flex items-center gap-2">
          {currentStep.title}
        </h3>

        <p className="text-body-sm text-[var(--color-text-secondary)] leading-relaxed mb-5">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border-light)]">
          <button
            onClick={prevStep}
            disabled={stepIndex === 0}
            className="btn btn-ghost btn-sm text-xs px-3 py-1.5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            Back
          </button>

          <div className="flex gap-2">
            <button
              onClick={nextStep}
              className="btn btn-primary btn-sm text-xs px-4 py-1.5 font-bold shadow-md hover:scale-105 transition-transform cursor-pointer"
            >
              {isLastStep ? "Got it! 🎉" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
