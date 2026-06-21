"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function HomeWidgets() {
  const router = useRouter();
  const [aiQuery, setAiQuery] = useState("");

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    router.push(`/proxnet-ai?q=${encodeURIComponent(aiQuery.trim())}`);
  };

  return (
    <div className="mb-6 animate-fadeInUp">
      <form onSubmit={handleAiSubmit} className="relative w-full">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <img src="/logo.png" alt="ProxNet AI" className="w-5 h-5 opacity-70 grayscale" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-12 py-3 bg-[var(--color-surface)] border border-[var(--color-primary)]/30 rounded-2xl focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all text-body font-medium shadow-sm"
          placeholder="Ask ProxNet AI about the network..."
          value={aiQuery}
          onChange={(e) => setAiQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={!aiQuery.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-50 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-[1px]">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
