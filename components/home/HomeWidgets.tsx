"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function HomeWidgets() {
  const router = useRouter();
  const [isGridExpanded, setIsGridExpanded] = useState(true);
  const [aiQuery, setAiQuery] = useState("");

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    router.push(`/proxnet-ai?q=${encodeURIComponent(aiQuery.trim())}`);
  };

  return (
    <div className="mb-6 flex flex-col gap-4 animate-fadeInUp">
      {/* AI Chat Box Header */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleAiSubmit} className="relative flex-1 w-full">
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

        <button
          onClick={() => setIsGridExpanded(!isGridExpanded)}
          className="btn btn-secondary shrink-0 hidden sm:flex items-center gap-2"
          title="Toggle Grid"
        >
          {isGridExpanded ? "Minimize Network Hub" : "Expand Network Hub"}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transition-transform ${isGridExpanded ? "rotate-180" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
      
      {/* Mobile Toggle */}
      <div className="flex justify-end sm:hidden">
        <button
          onClick={() => setIsGridExpanded(!isGridExpanded)}
          className="text-caption font-semibold text-[var(--color-text-secondary)] flex items-center gap-1"
        >
          {isGridExpanded ? "Minimize Hub" : "Expand Hub"}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${isGridExpanded ? "rotate-180" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {isGridExpanded && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 stagger-children mt-2">
          <Link href="/proximity" className="card p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-primary)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            </div>
            <h2 className="text-sm sm:text-h3 font-semibold m-0">Proximity Map</h2>
            <p className="text-xs sm:text-body-sm text-[var(--color-text-secondary)] m-0">Discover professionals from top companies in your area.</p>
          </Link>

          <Link href="/qa" className="card p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-accent)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
            </div>
            <h2 className="text-sm sm:text-h3 font-semibold m-0">Anonymous Q&amp;A</h2>
            <p className="text-xs sm:text-body-sm text-[var(--color-text-secondary)] m-0">Ask questions and get answers from nearby professionals.</p>
          </Link>

          <Link href="/carpool" className="card p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-success)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
            </div>
            <h2 className="text-sm sm:text-h3 font-semibold m-0">CarPool</h2>
            <p className="text-xs sm:text-body-sm text-[var(--color-text-secondary)] m-0">Find rides or offer seats to nearby colleagues.</p>
          </Link>

          <Link href="/jobs" className="card p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 bg-[var(--color-surface)] border-b-[5px] border-[var(--color-warning)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] active:translate-y-1 active:border-b-2 transition-all duration-200">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" /></svg>
            </div>
            <h2 className="text-sm sm:text-h3 font-semibold m-0">Jobs</h2>
            <p className="text-xs sm:text-body-sm text-[var(--color-text-secondary)] m-0">Discover referrals and roles in your area.</p>
          </Link>
        </div>
      )}
    </div>
  );
}
