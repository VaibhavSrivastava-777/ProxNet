"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
});

export function TypewriterText({ text, speedMs = 40 }: { text: string, speedMs?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    let i = 0;
    setDisplayedText("");
    const intervalId = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(intervalId);
      }
    }, speedMs);
    
    return () => clearInterval(intervalId);
  }, [text, speedMs]);

  return (
    <span style={{ 
      display: "inline-block",
      borderRight: displayedText.length < text.length ? "2px solid var(--color-primary)" : "2px solid transparent",
      paddingRight: "4px",
      animation: displayedText.length >= text.length ? "blink 1s step-end infinite" : "none"
    }}>
      {displayedText}
    </span>
  );
}

export function AnimatedStats() {
  const { data, isLoading, error } = useSWR<{ professionals: number, companies: number, radiusKm: number, locationContext: string }>("/api/proximity/stats", fetcher);

  if (isLoading) {
    return (
      <div className="card p-6 mb-6 text-center animate-pulse" style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border-light)" }}>
        <p className="text-body-lg text-[var(--color-text-secondary)]">Analyzing your proximity network...</p>
      </div>
    );
  }

  if (error || !data) return null;

  if (data.professionals === 0) return null;

  const contextStr = data.locationContext && data.locationContext !== "Unknown" ? ` (${data.locationContext})` : "";
  const text = `Radius ${data.radiusKm} KM${contextStr} * ${data.professionals} People * ${data.companies} Companies`;

  return (
    <div className="card p-4 sm:p-6 mb-6 flex items-center justify-center overflow-hidden" style={{ 
      backgroundColor: "var(--color-surface)", 
      borderLeft: "4px solid var(--color-primary)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.05)"
    }}>
      <p className="text-[10px] min-[360px]:text-[12px] sm:text-[14px] md:text-base lg:text-lg xl:text-xl whitespace-nowrap overflow-hidden" style={{ color: "var(--color-text)", fontWeight: 600, fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "-0.02em" }}>
        <TypewriterText text={text} />
      </p>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink {
          0%, 100% { border-color: transparent; }
          50% { border-color: var(--color-primary); }
        }
      `}} />
    </div>
  );
}
