"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);

    // Auto-retry or redirect to /qa if this happened during a NextAuth callback
    if (typeof window !== "undefined") {
      const href = window.location.href;
      const ref = document.referrer;
      if (href.includes("/api/auth") || ref.includes("/api/auth")) {
        const timer = setTimeout(() => {
          window.location.href = "/qa";
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-8 shadow-xl animate-scaleIn flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-3xl shadow-inner animate-pulse">
          ⚠️
        </div>
        
        <div>
          <h1 className="text-h2 m-0 text-[var(--color-text)]">Something went wrong</h1>
          <p className="text-body-sm text-[var(--color-text-secondary)] mt-2 mb-0">
            {error.message || "An unexpected error occurred during page load."}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={() => reset()}
            className="btn btn-primary w-full py-3 font-semibold"
          >
            Try Again
          </button>
          
          <Link
            href="/"
            className="btn w-full py-3 font-semibold border border-[var(--color-border)] bg-transparent"
            style={{ textDecoration: "none", color: "var(--color-text)" }}
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
