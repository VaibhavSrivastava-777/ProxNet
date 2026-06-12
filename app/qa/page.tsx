"use client";

import { QuestionForm } from "@/components/qa/QuestionForm";
import { QuestionList } from "@/components/qa/QuestionList";
import { useState } from "react";

export default function QAPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
      <div>
        <h1 className="text-h1">Messages &amp; Q&amp;A</h1>
        <p className="text-body-sm" style={{ marginTop: "0.25rem" }}>
          Ask questions anonymously to relevant professionals in your area.
        </p>
      </div>

      {/* Collapsible Ask a Question form */}
      <div className="card" style={{ overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <span className="text-h3 flex items-center gap-2" style={{ color: "var(--color-text)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent)", flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Ask a New Question
          </span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              color: "var(--color-text-secondary)",
              flexShrink: 0,
              transform: formOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div
          style={{
            maxHeight: formOpen ? "2000px" : "0px",
            overflow: "hidden",
            transition: "max-height 350ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div style={{ padding: "0 1.5rem 1.5rem" }}>
            <QuestionForm
              onPosted={() => {
                setRefreshKey((k) => k + 1);
                setFormOpen(false);
              }}
            />
          </div>
        </div>
      </div>

      <QuestionList refreshKey={refreshKey} />
    </div>
  );
}
