"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanyCluster } from "@/lib/types";

const ProximityMapInner = dynamic(
  () => import("./ProximityMapInner").then((m) => m.ProximityMapInner),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center">Loading map...</div> }
);

export function ProximityMap() {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(100);
  const [clusters, setClusters] = useState<CompanyCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationMode, setLocationMode] = useState<"home" | "office" | "current">("current");

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
      setError("Geolocation is not supported.");
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
      () => setError("Enable location services to use proximity search."),
      { enableHighAccuracy: true }
    );
  }, [locationMode]);

  const fetchClusters = useCallback(async () => {
    if (!center) return;
    setLoading(true);
    setError("");
    const res = await fetch(
      `/api/proximity/aggregate?lat=${center.lat}&lng=${center.lng}&radius=${radius}`
    );
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load proximity data.");
      return;
    }
    const data = await res.json();
    setClusters(data.clusters ?? []);
  }, [center, radius]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <label className="text-sm">
          <span className="font-medium">Location mode</span>
          <select
            className="mt-1 block rounded border px-3 py-2"
            value={locationMode}
            onChange={(e) => setLocationMode(e.target.value as typeof locationMode)}
          >
            <option value="current">Current</option>
            <option value="home">Home</option>
            <option value="office">Office</option>
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="font-medium">Search radius: {radius}m</span>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <button
          type="button"
          onClick={fetchClusters}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-zinc-500">Loading professionals nearby...</p>}

      <div className="h-[480px] overflow-hidden rounded-lg border">
        {center ? (
          <ProximityMapInner
            center={center}
            radius={radius}
            clusters={clusters}
            onMoveCenter={(lat, lng) => setCenter({ lat, lng })}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Waiting for location...
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Click the map to move the search center. Company counts are anonymized and positions are
        approximate.
      </p>
    </div>
  );
}
