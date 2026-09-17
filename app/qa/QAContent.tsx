"use client";

import { QuestionForm } from "@/components/qa/QuestionForm";
import { QuestionList } from "@/components/qa/QuestionList";
import { JobsClient } from "@/components/jobs/JobsClient";
import { JobInbox } from "@/components/jobs/JobInbox";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { LocalForumFeed } from "@/components/home/LocalForumFeed";
import { ProximityMap } from "@/components/map/ProximityMap";
import { GrowClient } from "@/components/grow/GrowClient";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function QAContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [directTarget, setDirectTarget] = useState<{ id: string; job_title: string; company: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam) return `/${tabParam}`;
      const path = window.location.pathname;
      const tabPaths = ["/jobs", "/network", "/qa", "/forum", "/grow"];
      if (tabPaths.includes(path)) return path;
    }
    return "/qa";
  });

  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab state listener and initial sync
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    let initialTab = tabParam ? `/${tabParam}` : window.location.pathname;
    
    const tabPaths = ["/jobs", "/network", "/qa", "/forum", "/grow"];
    
    if (tabPaths.includes(initialTab)) {
      setActiveTab(initialTab);
      if (tabParam) {
        const companyParam = searchParams.get("company");
        const suffix = companyParam ? `?company=${encodeURIComponent(companyParam)}` : "";
        window.history.replaceState(null, "", initialTab + suffix);
      }
    }

    const handleTabChange = (e: Event) => {
      const targetTab = (e as CustomEvent).detail;
      if (tabPaths.includes(targetTab)) {
        setActiveTab(targetTab);
      }
    };

    const handlePopState = () => {
      if (tabPaths.includes(window.location.pathname)) {
        setActiveTab(window.location.pathname);
      }
    };

    window.addEventListener("tabchange", handleTabChange);
    window.addEventListener("popstate", handlePopState);
    
    return () => {
      window.removeEventListener("tabchange", handleTabChange);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [searchParams]);

  // Deep-link check for direct targeting
  useEffect(() => {
    const userId = searchParams.get("userId");
    const company = searchParams.get("company");
    const title = searchParams.get("title");

    if (userId && company && title) {
      setDirectTarget({ id: userId, company, job_title: title });
      setFormOpen(true);
      router.replace("/qa");
    }
  }, [searchParams, router]);

  return (
    <div className="w-full">
      {/* ── 1. Jobs Tab ── */}
      <div className={activeTab === "/jobs" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl py-3 md:py-4 p-3 md:p-4 animate-fadeIn" style={{ paddingBottom: "4rem" }}>
          <JobsClient />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-tertiary)] text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <a href="/privacy" className="hover:text-[var(--color-accent)] transition-colors">Privacy</a>
              <span>&bull;</span>
              <a href="/delete-account" className="hover:text-[var(--color-accent)] transition-colors">Delete Account</a>
              <span>&bull;</span>
              <a href="/safety" className="hover:text-[var(--color-accent)] transition-colors">Safety</a>
              <span>&bull;</span>
              <a href="/disclaimer" className="hover:text-[var(--color-accent)] transition-colors">Disclaimer</a>
              <span>&bull;</span>
              <a href="https://www.instagram.com/proxnet.connect/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">Contact Us</a>
            </div>
            <div>&copy; ProxNet 2026</div>
          </div>
        </div>
      </div>

      {/* ── 2. Network Tab ── */}
      <div className={activeTab === "/network" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl py-3 md:py-4 p-3 md:p-4 animate-fadeIn" style={{ paddingBottom: "4rem" }}>
          <ProximityMap />

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-tertiary)] text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <a href="/privacy" className="hover:text-[var(--color-accent)] transition-colors">Privacy</a>
              <span>&bull;</span>
              <a href="/delete-account" className="hover:text-[var(--color-accent)] transition-colors">Delete Account</a>
              <span>&bull;</span>
              <a href="/safety" className="hover:text-[var(--color-accent)] transition-colors">Safety</a>
              <span>&bull;</span>
              <a href="/disclaimer" className="hover:text-[var(--color-accent)] transition-colors">Disclaimer</a>
              <span>&bull;</span>
              <a href="https://www.instagram.com/proxnet.connect/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">Contact Us</a>
            </div>
            <div>&copy; ProxNet 2026</div>
          </div>
        </div>
      </div>

      {/* ── 3. Chats List Tab ── */}
      <div className={activeTab === "/qa" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl p-3 md:p-4 animate-fadeIn flex flex-col gap-[0.75rem] pb-[2rem]">
          
          {formOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fadeIn"
              onClick={() => setFormOpen(false)}
            >
              <div
                className="bg-[var(--color-surface)] w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[92dvh] overflow-hidden animate-slideUp sm:animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Mobile Grab Handle */}
                <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

                <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0 leading-tight">
                        {directTarget ? "Direct Message" : "Start a Conversation"}
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] m-0 leading-none mt-0.5">
                        {directTarget ? `Private chat with ${directTarget.job_title}` : "Reach verified tech professionals nearby"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFormOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
                    aria-label="Close"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 overscroll-contain">
                  <QuestionForm
                    targetUser={directTarget || undefined}
                    onPosted={() => {
                      setRefreshKey((k) => k + 1);
                      setFormOpen(false);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <QuestionList 
            refreshKey={refreshKey} 
            onOpenDirectQuestion={(target) => {
              setDirectTarget(target || null);
              setFormOpen(true);
            }}
          />
        </div>
      </div>

      {/* ── 4. Forum Tab ── */}
      <div className={activeTab === "/forum" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl p-0 md:p-4">
          <LocalForumFeed />
        </div>
      </div>

      {/* ── 5. Grow Tab ── */}
      <div className={activeTab === "/grow" ? "block" : "hidden"}>
        <GrowClient />
      </div>
    </div>
  );
}

export default function QAContentWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <QAContent />
    </Suspense>
  );
}
