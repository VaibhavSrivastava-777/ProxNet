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
  const [activeTab, setActiveTab] = useState<string>("/network");

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
              <a href="https://wa.me/918197678983?text=Hi%20ProxNet,%20I%20have%20some%20feedback" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">Contact Us</a>
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
              <a href="https://wa.me/918197678983?text=Hi%20ProxNet,%20I%20have%20some%20feedback" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] transition-colors">Contact Us</a>
            </div>
            <div>&copy; ProxNet 2026</div>
          </div>
        </div>
      </div>

      {/* ── 3. Chats List Tab ── */}
      <div className={activeTab === "/qa" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl p-3 md:p-4 animate-fadeIn flex flex-col gap-[0.75rem] pb-[2rem]">
          
          {formOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-[var(--color-surface)] w-full max-w-2xl rounded-xl shadow-xl border border-[var(--color-border)] flex flex-col h-[85vh] max-h-[800px] animate-scaleIn">
                <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] shrink-0">
                  <h3 className="text-h3 m-0 flex items-center gap-2 text-[var(--color-text)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)]">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Ask a Question
                  </h3>
                  <button onClick={() => setFormOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                
                <div className="p-0 overflow-y-auto flex-1 flex flex-col">
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
