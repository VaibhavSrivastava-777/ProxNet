"use client";

import { signOut } from "next-auth/react";

export function BlockedUserScreen() {
  return (
    <main className="main-content flex flex-col items-center justify-center min-h-[calc(100vh-var(--nav-height))] p-6 text-center bg-[var(--color-background)] animate-fadeIn">
      <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-error)]/20 p-8 rounded-2xl shadow-lg">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-h2 font-bold text-[var(--color-text-primary)] mb-4">Your account is blocked</h1>
        <p className="text-[var(--color-text-secondary)] mb-8 leading-relaxed">
          Access to ProxNet has been suspended for your account. If you believe this is an error or would like to appeal, please contact support.
        </p>
        
        <div className="flex flex-col gap-3">
          <a
            href="mailto:ProxNet.Connect@Gmail.com?subject=Blocked%20Account%20Inquiry"
            className="btn btn-primary w-full justify-center"
          >
            Contact Us
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn btn-ghost w-full justify-center border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}
