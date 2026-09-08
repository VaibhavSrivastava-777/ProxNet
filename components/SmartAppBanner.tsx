"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DISMISS_STORAGE_KEY = "proxnet_app_banner_dismissed_at";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const PLAY_STORE_PACKAGE = "in.proxnet.app";
const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;

export function SmartAppBanner() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      (window.navigator as any).standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

    if (isStandalone) return;

    // 2. Check if inside the native Android WebView bridge
    const isNativeAndroid = !!(window as any).AndroidBridge;
    if (isNativeAndroid) return;

    // 3. Check dismissal in localStorage (7-day suppression)
    try {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < SEVEN_DAYS_MS) {
          return;
        }
      }
    } catch {
      // LocalStorage might be restricted in private browsing mode
    }

    // 4. Platform detection
    const ua = window.navigator.userAgent.toLowerCase();
    const isIpad = ua.includes("ipad");
    const isIphone = ua.includes("iphone") && !ua.includes("like iphone");
    const isMacTouch =
      ua.includes("macintosh") &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 1;

    const isIos = isIphone || isIpad || isMacTouch;
    const isAndroid = ua.includes("android");

    if (isIos) {
      setPlatform("ios");
      setShowBanner(true);
    } else if (isAndroid) {
      setPlatform("android");
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore storage errors
    }
  };

  const handleAndroidClick = () => {
    // Attempt market intent first, then fallback to web Play Store link
    try {
      window.location.href = `market://details?id=${PLAY_STORE_PACKAGE}`;
      setTimeout(() => {
        window.location.href = PLAY_STORE_WEB_URL;
      }, 1000);
    } catch {
      window.open(PLAY_STORE_WEB_URL, "_blank", "noopener,noreferrer");
    }
  };

  if (!showBanner || !platform) return null;

  return (
    <>
      {/* Sticky Smart Banner under Mobile Top Nav */}
      <aside
        aria-label="App Installation Banner"
        className="sticky top-[var(--nav-height)] z-[1005] md:hidden px-3 pt-2 pb-1 animate-fadeInDown"
      >
        <div className="bg-[var(--color-surface)]/95 backdrop-blur-md border border-[var(--color-border)] rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 text-[var(--color-text)]">
          {/* Logo & Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden border border-[var(--color-border-light)] shadow-sm bg-white">
              <Image
                src="/logo.png"
                alt="ProxNet"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs leading-none text-[var(--color-text)]">
                  ProxNet
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-primary-subtle)] text-[var(--color-primary)] uppercase tracking-wider">
                  {platform === "ios" ? "iPhone App" : "Play Store"}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-1 mb-0 leading-tight">
                {platform === "ios"
                  ? "Add to Home Screen for chat alerts"
                  : "Download native app for live alerts"}
              </p>
            </div>
          </div>

          {/* Action CTA & Dismiss */}
          <div className="flex items-center gap-2 shrink-0">
            {platform === "ios" ? (
              <button
                type="button"
                onClick={() => setShowIosGuide(true)}
                className="bg-[var(--color-primary)] hover:opacity-90 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Add
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAndroidClick}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M3.609 1.814L13.793 12 3.61 22.186a2.38 2.38 0 0 1-.61-.914c-.16-.412-.249-.86-.249-1.326V4.054c0-.466.089-.914.25-1.326.151-.387.368-.718.608-.914zm11.242 11.244l2.585 2.586-12.39 7.08 9.805-9.666zm2.585-2.586l-2.585 2.586-9.805-9.666 12.39 7.08zm1.057 1.057l3.66 2.091a1.277 1.277 0 0 1 0 2.222l-3.66 2.091-2.227-2.202 2.227-2.202z" />
                </svg>
                <span>Get</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] p-1 rounded-full transition-colors cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss banner"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Step-by-Step Bottom Drawer */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-[2100] bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fadeIn"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-t-3xl p-6 shadow-2xl animate-slideUp flex flex-col gap-5 max-w-md mx-auto w-full pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-sm bg-white border border-[var(--color-border-light)] shrink-0">
                  <Image
                    src="/logo.png"
                    alt="ProxNet"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)] m-0 leading-tight">
                    Install ProxNet on iPhone
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-1">
                    Enables WhatsApp-style chat alerts & lock-screen notifications
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-1.5 rounded-full bg-[var(--color-surface-hover)] cursor-pointer"
                title="Close guide"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-[var(--color-surface-hover)] p-3 rounded-xl border border-[var(--color-border-light)]">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-sm flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="text-xs flex-1">
                  Tap the Safari{" "}
                  <strong className="text-[var(--color-primary)] font-semibold inline-flex items-center gap-1">
                    Share
                    <svg
                      className="w-3.5 h-3.5 inline-block"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </strong>{" "}
                  button in the bottom bar.
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[var(--color-surface-hover)] p-3 rounded-xl border border-[var(--color-border-light)]">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-sm flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="text-xs flex-1">
                  Scroll down and tap{" "}
                  <strong className="text-[var(--color-text)] font-semibold">
                    Add to Home Screen
                  </strong>{" "}
                  <span className="text-[var(--color-text-secondary)]">(+)</span>.
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[var(--color-surface-hover)] p-3 rounded-xl border border-[var(--color-border-light)]">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-sm flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="text-xs flex-1">
                  Tap <strong className="text-[var(--color-text)] font-semibold">Add</strong> in
                  the top right. Open ProxNet from your Home Screen!
                </div>
              </div>
            </div>

            {/* Bouncing down indicator toward Safari toolbar */}
            <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] text-xs font-semibold py-1">
              <span>Tap Share below</span>
              <svg
                className="w-4 h-4 animate-bounce"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </div>

            {/* Got It Button */}
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 active:scale-98 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
