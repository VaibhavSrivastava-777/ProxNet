"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AndroidInstallPage() {
  const router = useRouter();
  const [isAndroid, setIsAndroid] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent.toLowerCase();
      const androidDetected = ua.includes("android");
      setIsAndroid(androidDetected);

      // If user is on iOS, redirect to iOS PWA guide instead
      const isIos = ua.includes("iphone") || ua.includes("ipad") || (ua.includes("macintosh") && navigator.maxTouchPoints > 0);
      if (isIos) {
        router.replace("/install/ios");
      }
    }
  }, [router]);

  if (isAndroid === null) {
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
          Get the fast, app-like experience on your Android device by adding ProxNet to your home screen.
        </p>
      </div>

      {/* Guide Card */}
      <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-6 shadow-md my-8 flex flex-col gap-6 animate-scaleIn">
        <h2 className="text-h3 font-bold m-0 border-b border-[var(--color-border-light)] pb-3">How to Install</h2>

        {/* Step 1 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">1</div>
          <div>
            <h3 className="text-body font-semibold m-0">Open the Browser Menu</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap the three-dot menu icon in the top-right corner of your browser (like Chrome).
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">2</div>
          <div>
            <h3 className="text-body font-semibold m-0">Select "Install App" or "Add to Home Screen"</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Scroll down the menu and select <strong className="text-[var(--color-text)]">Install App</strong> or <strong className="text-[var(--color-text)]">Add to Home screen</strong>.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">3</div>
          <div>
            <h3 className="text-body font-semibold m-0">Confirm and Add</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap the <strong className="text-[var(--color-primary)]">Install</strong> or <strong className="text-[var(--color-primary)]">Add</strong> button on the prompt to complete. ProxNet will appear on your home screen.
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Fallback */}
      <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">
        <Link 
          href="/login" 
          className="text-body-sm font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1"
        >
          <span>Continue in browser instead</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </div>
    </div>
  );
}
