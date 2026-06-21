"use client";

import { QuestionForm } from "@/components/qa/QuestionForm";
import { QuestionList } from "@/components/qa/QuestionList";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { useState } from "react";

export default function QAPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [directTarget, setDirectTarget] = useState<{ id: string; job_title: string; company: string } | null>(null);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-h1">Messages &amp; Q&amp;A</h1>
          <HowItWorksModal type="qa" />
        </div>
        <p className="text-body-sm" style={{ marginTop: "0.25rem" }}>
          Ask questions anonymously to relevant professionals in your area.
        </p>
      </div>

      {/* Ask a Question Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            setDirectTarget(null);
            setFormOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer shadow-sm group"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)] group-hover:scale-110 transition-transform">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-h3 m-0 text-[var(--color-text)]">Ask Anonymously</span>
        </button>
      </div>

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
            
            <div className="p-0 overflow-hidden flex-1 flex flex-col">
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
          setDirectTarget(target);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
