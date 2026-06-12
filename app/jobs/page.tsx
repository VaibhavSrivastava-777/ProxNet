"use client";

import { useState } from "react";
import { QuestionForm } from "@/components/qa/QuestionForm";

export default function JobsPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ titles: string[]; companies: string[]; pitch: string } | null>(null);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to analyze text");
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
      <div>
        <h1 className="text-h1">AI Matcher</h1>
        <p className="text-body-sm" style={{ marginTop: "0.25rem" }}>
          Paste a job description or resume summary to instantly find matching professionals nearby.
        </p>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <label className="text-h3">Job Description / Resume</label>
        <textarea 
          className="input" 
          rows={6} 
          placeholder="Paste requirements here (e.g. 'Looking for a Senior React Developer with 5+ years experience in Next.js...')"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ resize: "vertical" }}
        />
        <button 
          className="btn btn-primary self-start" 
          onClick={handleAnalyze} 
          disabled={loading || !text.trim()}
        >
          {loading ? (
            <><span className="spinner-sm mr-2" /> Analyzing...</>
          ) : "Analyze & Match"}
        </button>
        {error && <p className="text-error mt-2">{error}</p>}
      </div>

      {result && (
        <div className="animate-fadeInUp" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card p-6" style={{ borderLeft: "4px solid var(--color-accent)" }}>
            <h3 className="text-h3 mb-4">Extracted Match Criteria</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {result.titles.map((t, i) => (
                <span key={i} className="badge badge-primary">{t}</span>
              ))}
              {result.companies.map((c, i) => (
                <span key={i} className="badge badge-neutral">@ {c}</span>
              ))}
            </div>
            <p className="text-body-sm text-[var(--color-text-secondary)] mb-2">Suggested Pitch:</p>
            <p className="text-body bg-[var(--color-surface-hover)] p-3 rounded-lg border border-[var(--color-border-light)]">{result.pitch}</p>
          </div>

          <div>
            <h3 className="text-h2 mb-4">Pitch to Network</h3>
            <div className="card" style={{ padding: "1.5rem" }}>
              <QuestionForm 
                defaultRadius={5000}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
