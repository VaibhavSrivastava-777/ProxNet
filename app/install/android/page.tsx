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
        <h1 className="text-h1 m-0">Install ProxNet Native</h1>
        <p className="text-body-sm text-[var(--color-text-secondary)] mt-2">
          Get the high-performance native app experience on your Android device.
        </p>

        {/* Primary Download Button */}
        <a
          href="/proxnet.apk"
          download
          className="btn btn-primary w-full mt-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
          style={{ textDecoration: "none" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Download Android App (.apk)</span>
        </a>
      </div>

      {/* Guide Card */}
      <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-6 shadow-md my-8 flex flex-col gap-6 animate-scaleIn">
        <h2 className="text-h3 font-bold m-0 border-b border-[var(--color-border-light)] pb-3">How to Install</h2>

        {/* Step 1 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">1</div>
          <div>
            <h3 className="text-body font-semibold m-0">Download the file</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap the download button above to retrieve the package file (<code className="bg-[var(--color-surface-hover)] px-1 py-0.5 rounded text-xs text-[var(--color-text)]">proxnet.apk</code>).
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">2</div>
          <div>
            <h3 className="text-body font-semibold m-0">Allow Installation</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Open the downloaded file. If prompted by your browser or file manager, tap <strong className="text-[var(--color-text)]">Settings</strong> and toggle on the switch to permit installs from unknown sources.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">3</div>
          <div>
            <h3 className="text-body font-semibold m-0">Complete Setup</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap <strong className="text-[var(--color-primary)]">Install</strong>, wait a moment for setup to complete, and open ProxNet from your home screen.
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
