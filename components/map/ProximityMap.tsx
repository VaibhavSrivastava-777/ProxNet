"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanyCluster } from "@/lib/types";
import { QuestionForm } from "@/components/qa/QuestionForm";
import useSWR from "swr";

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
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(5000);
  const [localError, setLocalError] = useState("");
  const [locationMode, setLocationMode] = useState<"home" | "office" | "current">("current");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

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
      <div className="card" style={{ padding: 16 }}>
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
      </div>

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

      {/* Map Container */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          height: "calc(100vh - 240px)",
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

      {/* Footer Hint */}
      <p className="text-caption" style={{ textAlign: "center" }}>
        Click a company logo to ask questions. Company counts are anonymized and positions are
        approximate.
      </p>

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
