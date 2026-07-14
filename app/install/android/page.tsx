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
        <h1 className="text-h1 m-0">Install ProxNet (Android)</h1>
        <p className="text-body-sm text-[var(--color-text-secondary)] mt-2">
          ProxNet is coming soon to the Google Play Store! In the meantime, you can install the direct Android App binary (APK) below.
        </p>
      </div>

      {/* Guide Card */}
      <div className="w-full max-w-md bg-[var(--color-surface)] border border border-[var(--color-border-light)] rounded-2xl p-6 shadow-md my-8 flex flex-col gap-6 animate-scaleIn">
        
        {/* APK Download Button */}
        <div className="flex flex-col items-center justify-center p-4 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border-light)] text-center">
          <p className="text-body-sm font-semibold m-0 mb-3 text-[var(--color-text)]">Download Direct App Binary</p>
          <a 
            href="/downloads/proxnet.apk" 
            download="proxnet.apk"
            className="btn btn-primary btn-md w-full flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download APK</span>
          </a>
          <p className="text-caption text-[var(--color-text-tertiary)] mt-2 m-0">Size: ~4MB • Version 1.0.0</p>
        </div>

        <h2 className="text-h3 font-bold m-0 border-b border-[var(--color-border-light)] pb-3">How to Install</h2>

        {/* Step 1 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">1</div>
          <div>
            <h3 className="text-body font-semibold m-0">Download the APK</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Tap the **Download APK** button above to save the installer file on your device.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">2</div>
          <div>
            <h3 className="text-body font-semibold m-0">Enable Unknown Sources (if prompted)</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Android may show a security prompt. Tap **Settings** and toggle **Allow from this source** to enable installation.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0">3</div>
          <div>
            <h3 className="text-body font-semibold m-0">Install & Open</h3>
            <p className="text-body-sm text-[var(--color-text-secondary)] m-0 mt-1">
              Open the downloaded `proxnet.apk` from your notifications bar or Downloads folder, tap **Install**, then open and sign in.
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
          <span>Continue in browser</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </div>
    </div>
  );
}
