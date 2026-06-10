"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getCurrentPosition } from "@/lib/geo/get-current-position";

const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap").then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 items-center justify-center text-sm text-zinc-500">
        Loading map...
      </div>
    ),
  }
);

interface Props {
  legend: string;
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
  /** Auto-request browser location on mount when coordinates are empty */
  autoCapture?: boolean;
}

export function LocationPicker({ legend, lat, lng, onChange, autoCapture = false }: Props) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [showMap, setShowMap] = useState(Boolean(lat && lng));

  const captureCurrent = useCallback(async () => {
    setGeoLoading(true);
    setGeoError("");
    try {
      const pos = await getCurrentPosition();
      onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
      setShowMap(true);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Location capture failed.");
    } finally {
      setGeoLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (autoCapture && !lat && !lng) {
      captureCurrent();
    }
  }, [autoCapture, lat, lng, captureCurrent]);

  const latNum = lat ? parseFloat(lat) : null;
  const lngNum = lng ? parseFloat(lng) : null;

  return (
    <fieldset className="rounded border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={captureCurrent}
          disabled={geoLoading}
          className="rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          {geoLoading ? "Getting location..." : "Use current location"}
        </button>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          {showMap ? "Hide map" : "Pick on map"}
        </button>
      </div>

      {geoError && <p className="mt-2 text-sm text-red-600">{geoError}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-zinc-600">Latitude</span>
          <input
            type="number"
            step="any"
            placeholder="e.g. 28.613900"
            className="mt-1 w-full rounded border px-3 py-2"
            value={lat}
            onChange={(e) => {
              onChange(e.target.value, lng);
              if (e.target.value && lng) setShowMap(true);
            }}
          />
        </label>
        <label className="text-sm">
          <span className="text-zinc-600">Longitude</span>
          <input
            type="number"
            step="any"
            placeholder="e.g. 77.209000"
            className="mt-1 w-full rounded border px-3 py-2"
            value={lng}
            onChange={(e) => {
              onChange(lat, e.target.value);
              if (lat && e.target.value) setShowMap(true);
            }}
          />
        </label>
      </div>

      {showMap && (
        <div className="mt-3 space-y-1">
          <div className="h-56 overflow-hidden rounded-lg border">
            <LocationPickerMap
              lat={latNum}
              lng={lngNum}
              onChange={(newLat, newLng) => {
                onChange(newLat.toFixed(6), newLng.toFixed(6));
              }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Click the map or drag the pin to set coordinates (OpenStreetMap).
          </p>
        </div>
      )}
    </fieldset>
  );
}
