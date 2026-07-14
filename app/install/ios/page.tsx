"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function IosInstallPage() {
  const router = useRouter();
  const [isIos, setIsIos] = useState<boolean | null>(null);

  useEffect(() => {
    // 1. Check if already in standalone mode (already installed & opened from home screen)
    if (typeof window !== "undefined") {
      const isStandalone = 
        (window.navigator as any).standalone === true || 
        window.matchMedia("(display-mode: standalone)").matches;

      if (isStandalone) {
        router.replace("/login");
        return;
      }

      // 2. Platform detection
      const ua = window.navigator.userAgent.toLowerCase();
      const isIpad = ua.includes("ipad");
      const isIphone = ua.includes("iphone") && !ua.includes("like iphone");
      const isMacintosh = ua.includes("macintosh") && typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
      
      const iosDetected = isIphone || isIpad || isMacintosh;
      setIsIos(iosDetected);

      // If user is on Android, redirect to Android install page
      const isAndroid = ua.includes("android");
      if (isAndroid) {
        router.replace("/install/android");
      }
    }
  }, [router]);

  if (isIos === null) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="spinner animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] px-6 py-12 flex flex-col items-center justify-between">
      {/* Header */}
      <div className="w-full max-w-md flex flex-col items-center text-center mt-4">
        <img src="/logo.png" alt="ProxNet" className="w-16 h-16 rounded-2xl shadow-md mb-4" />
        <h1 className="text-h1 m-0">Install ProxNet</h1>
        <p className="text-body-sm text-[var(--color-text-secondary)] mt-2">
          Get the native App Store experience on your iPhone by adding ProxNet to your home screen.
        </p>
      </div>

      {/* Guide Card */}
      <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-6 shadow-md my-8 flex flex-col gap-6 animate-scaleIn">
        <h2 className="text-h3 font-bold m-0 border-b border-[var(--color-border-light)] pb-3">How to Install</h2>

        {/* Step 1 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">1</div>
          <div>
            <h3 className="text-body font-semibold m-0">Tap the Share icon</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap the Safari Share button in the bottom menu bar of your browser:
            </p>
            <div className="mt-2 inline-flex items-center justify-center p-2 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-[var(--color-primary)]">
              {/* iOS Share Icon Representation */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">2</div>
          <div>
            <h3 className="text-body font-semibold m-0">Select "Add to Home Screen"</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Scroll down the sharing options menu and select <strong className="text-[var(--color-text)]">Add to Home Screen</strong>:
            </p>
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-sm font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add to Home Screen</span>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">3</div>
          <div>
            <h3 className="text-body font-semibold m-0">Confirm and Add</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap the <strong className="text-[var(--color-primary)]">Add</strong> button in the top-right corner to complete.
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Fallback */}
      <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">
        <p className="text-caption text-[var(--color-text-tertiary)] m-0">
          Note: This must be opened in the Safari browser. Third-party browsers like Chrome or Firefox do not support adding PWAs to the iOS home screen.
        </p>
        <Link 
          href="/login" 
          className="text-body-sm font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1"
        >
          <span>Continue in browser</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </div>
    </div>
  );
}
