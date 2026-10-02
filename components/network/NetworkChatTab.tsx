"use client";

import { useState, useEffect } from "react";
import { ProximityMap } from "@/components/map/ProximityMap";
import { QuestionList } from "@/components/qa/QuestionList";
import { QuestionForm } from "@/components/qa/QuestionForm";
import { useSearchParams } from "next/navigation";

export function NetworkChatTab() {
  const searchParams = useSearchParams();
  const initialSub = searchParams.get("sub") === "chat" || searchParams.get("tab") === "qa" || searchParams.get("userId") ? "chat" : "network";
  const [subView, setSubView] = useState<"network" | "chat">(initialSub);
  const [formOpen, setFormOpen] = useState(false);
  const [directTarget, setDirectTarget] = useState<{ id: string; job_title: string; company: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const userId = searchParams.get("userId");
    const company = searchParams.get("company");
    const title = searchParams.get("title");

    if (userId && company && title) {
      setDirectTarget({ id: userId, company, job_title: title });
      setFormOpen(true);
      setSubView("chat");
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Top Segmented Sub-View Toggle */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--color-border-light)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)] tracking-tight m-0 flex items-center gap-2">
            <span>{subView === "network" ? "Local Professional Network" : "Conversations & Q&A"}</span>
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">
            {subView === "network"
              ? "Discover verified tech peers and colleagues living in your neighborhood or tech park."
              : "Direct messages, referral inquiries, and candid local community questions."}
          </p>
        </div>

        {/* Segmented Controller */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] shrink-0">
          <button
            type="button"
            onClick={() => setSubView("network")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
              subView === "network"
                ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                : "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>🗺️</span>
            <span>Network</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("chat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
              subView === "chat"
                ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                : "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            <span>💬</span>
            <span>Chats & Q&A</span>
          </button>
        </div>
      </div>

      {/* View 1: Proximity Map & Discovery */}
      {subView === "network" && (
        <div className="animate-fadeIn">
          <ProximityMap />
        </div>
      )}

      {/* View 2: Chats & Question List */}
      {subView === "chat" && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {formOpen && (
            <div
              className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 pb-safe backdrop-blur-sm animate-fadeIn"
              onClick={() => setFormOpen(false)}
            >
              <div
                className="bg-[var(--color-surface)] w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[92dvh] overflow-hidden animate-slideUp sm:animate-scaleIn pb-2 sm:pb-0"
                onClick={(e) => e.stopPropagation()}
              >
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
      )}
    </div>
  );
}
