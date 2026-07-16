"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanyCluster } from "@/lib/types";
import { QuestionForm } from "@/components/qa/QuestionForm";
import useSWR from "swr";
import { useRouter } from "next/navigation";

const ProximityMapInner = dynamic(
  () => import("./ProximityMapInner").then((m) => m.ProximityMapInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="skeleton"
        style={{ width: "100%", height: "100%", borderRadius: "var(--radius-lg)" }}
      />
    ),
  }
);

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
});

export function ProximityMap() {
  const router = useRouter();
  const [aiQuery, setAiQuery] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(5000);
  const [localError, setLocalError] = useState("");
  const [locationMode, setLocationMode] = useState<"home" | "office" | "current">("home");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    if (locationMode !== "current") {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((user) => {
          if (locationMode === "home" && user.home_lat && user.home_lng) {
            setCenter({ lat: Number(user.home_lat), lng: Number(user.home_lng) });
          } else if (locationMode === "office" && user.office_lat && user.office_lng) {
            setCenter({ lat: Number(user.office_lat), lng: Number(user.office_lng) });
          }
        });
      return;
    }
    if (!navigator.geolocation) {
      setLocalError("Geolocation is not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter({ lat, lng });
        await fetch("/api/proximity/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        });
      },
      () => setLocalError("Enable location services to use proximity search."),
      { enableHighAccuracy: true }
    );
  }, [locationMode]);

  const apiUrl = center ? `/api/proximity/aggregate?lat=${center.lat}&lng=${center.lng}&radius=${radius}` : null;
  const { data, error: swrError, isLoading, mutate } = useSWR<{ clusters: CompanyCluster[] }>(apiUrl, fetcher);

  const clusters = data?.clusters ?? [];
  const loading = isLoading;
  const error = swrError ? "Failed to load proximity data." : localError;

  const fetchClusters = () => mutate();

  const radiusLabel = radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls Panel */}
      {!filtersExpanded ? (
        <div 
          onClick={() => setFiltersExpanded(true)}
          className="flex items-center gap-2 p-3 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] cursor-pointer hover:border-[var(--color-primary)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)] shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span className="text-sm text-[var(--color-text-secondary)] font-medium truncate">
            {radiusLabel} radius to {locationMode === "current" ? "Current" : locationMode === "home" ? "Home" : "Office"} Location &bull; All Companies &bull; All Titles
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[var(--color-text-secondary)] shrink-0"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-body font-semibold m-0">Map Filters</h4>
            <button type="button" onClick={() => setFiltersExpanded(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
            {/* Location Mode */}
            <div style={{ minWidth: 160 }}>
              <label
                className="label"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Location mode
              </label>
              <select
                className="input"
                value={locationMode}
                onChange={(e) => setLocationMode(e.target.value as typeof locationMode)}
                style={{ width: "100%", color: "var(--color-text)", backgroundColor: "var(--color-surface)" }}
              >
                <option value="current" style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface)" }}>Current location</option>
                <option value="home" style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface)" }}>Home address</option>
                <option value="office" style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface)" }}>Office address</option>
              </select>
            </div>

            {/* Radius Slider */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="label" style={{ marginBottom: 6 }}>
                Search radius:{" "}
                <span
                  className="badge badge-primary"
                  style={{ marginLeft: 6, fontSize: 11 }}
                >
                  {radiusLabel}
                </span>
              </label>
              <input
                type="range"
                min={100}
                max={100000}
                step={100}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "var(--color-primary)",
                  height: 6,
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchClusters}
              className="btn btn-primary btn-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" style={{ marginRight: 6 }} />
                  Loading…
                </>
              ) : (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 4 }}
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>

          {/* Results Summary */}
          <div
            className="text-body-sm"
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--color-border-light)",
            }}
          >
            {clusters.length > 0
              ? `Showing ${clusters.length} ${clusters.length === 1 ? "company" : "companies"} within ${radiusLabel}`
              : center
                ? "No companies found in this area"
                : "Waiting for location…"}
          </div>

          {/* Low density invite nudge */}
          {!loading && clusters.length < 3 && (
            <div 
              className="mt-3 p-3 flex flex-col gap-2 bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 18 }}>🏘️</span>
                <span className="text-body-sm font-semibold">Your area is quiet</span>
              </div>
              <p className="text-caption m-0" style={{ color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                Only {clusters.length} {clusters.length === 1 ? "company is" : "companies are"} represented near you. Be the one who brings your professional neighbors here!
              </p>
              <button 
                onClick={() => router.push("/grow")}
                className="btn btn-sm btn-primary mt-1"
                style={{ fontSize: 11, padding: "6px 12px", alignSelf: "flex-start" }}
              >
                Invite Neighbors &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-error">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {/* Hint */}
      <p className="text-caption" style={{ textAlign: "center", marginBottom: "-8px" }}>
        Click a company logo to ask questions. Company counts are anonymized and positions are approximate.
      </p>

      {/* Radius & Ask ProxNet AI Scope Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm animate-fadeInUp">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="m4.93 4.93 4.24 4.24"/>
              <path d="m14.83 9.17 4.24-4.24"/>
              <path d="M12 2v10"/>
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Search Scope</div>
            <div className="text-body font-bold text-[var(--color-primary)]">Radius {radiusLabel}</div>
          </div>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (!aiQuery.trim()) return;
            router.push(`/proxnet-ai?q=${encodeURIComponent(aiQuery.trim())}`);
          }} 
          className="relative flex-1 max-w-md w-full"
        >
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <img src="/logo.png" alt="ProxNet AI" className="w-5 h-5 opacity-70 grayscale" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-12 py-2.5 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all text-body-sm font-medium"
            placeholder="Ask ProxNet..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={!aiQuery.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-50 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>

      {/* Map Container */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          height: "calc(100vh - 200px)",
          minHeight: 400,
        }}
      >
        {center ? (
          <ProximityMapInner
            center={center}
            radius={radius}
            clusters={clusters}
            onMoveCenter={(lat, lng) => setCenter({ lat, lng })}
            onCompanyClick={(company) => setSelectedCompany(company)}
          />
        ) : !error ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            <span className="spinner" />
            <span className="text-body-sm">Acquiring your location…</span>
          </div>
        ) : (
          <div
            className="skeleton"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>

      {/* Q&A Modal */}
      {selectedCompany && center && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={() => setSelectedCompany(null)}
        >
          <div
            style={{ width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-36px", marginRight: "12px", position: "relative", zIndex: 10 }}>
              <button
                className="btn-icon btn-ghost"
                onClick={() => setSelectedCompany(null)}
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-light)" }}
              >
                ✕
              </button>
            </div>
            <QuestionForm
              defaultLat={center.lat}
              defaultLng={center.lng}
              defaultRadius={radius}
              fixedCompany={selectedCompany}
              onPosted={() => {
                setTimeout(() => setSelectedCompany(null), 1500);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
