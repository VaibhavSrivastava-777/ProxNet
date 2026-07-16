"use client";

import { QuestionForm } from "@/components/qa/QuestionForm";
import { QuestionList } from "@/components/qa/QuestionList";
import { ProximityMap } from "@/components/map/ProximityMap";
import { LocalForumFeed } from "@/components/home/LocalForumFeed";
import { GrowClient } from "@/components/grow/GrowClient";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function QAContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [directTarget, setDirectTarget] = useState<{ id: string; job_title: string; company: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("/qa");

  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab state listener and initial sync
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const initialTab = tabParam ? `/${tabParam}` : window.location.pathname;
    const tabPaths = ["/proximity", "/qa", "/forum", "/grow"];
    
    if (tabPaths.includes(initialTab)) {
      setActiveTab(initialTab);
      if (tabParam) {
        window.history.replaceState(null, "", initialTab);
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
      {/* ── 1. Proximity Map Tab ── */}
      {activeTab === "/proximity" && (
        <div className="mx-auto max-w-6xl p-4 md:p-8 animate-fadeIn" style={{ paddingBottom: "3rem" }}>
          <ProximityMap />
        </div>
      )}

      {/* ── 2. Chats (Q&A) List Tab ── */}
      <div className={activeTab === "/qa" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn flex flex-col gap-[1.5rem] pb-[3rem]">
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

      {/* ── 3. Forum Tab ── */}
      <div className={activeTab === "/forum" ? "block" : "hidden"}>
        <div className="mx-auto max-w-4xl p-0 md:p-4">
          <LocalForumFeed />
        </div>
      </div>

      {/* ── 4. Grow Tab ── */}
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
