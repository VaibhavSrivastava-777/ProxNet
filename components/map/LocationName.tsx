"use client";

import { useEffect, useState } from "react";

interface LocationNameProps {
  lat: number;
  lng: number;
  fallback?: string;
}

const cache: Record<string, string> = {};

export function LocationName({ lat, lng, fallback = "Unknown Location" }: LocationNameProps) {
  const [name, setName] = useState<string>(() => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (cache[key]) return cache[key];
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("proxnet_geocode_cache");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed[key]) {
            cache[key] = parsed[key];
            return parsed[key];
          }
        } catch (e) {}
      }
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  });

  useEffect(() => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (cache[key]) return;

    // Use a small delay to debounce/prevent spamming
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`);
        const data = await res.json();
        
        // Try to get a sensible name
        const placeName = 
          data.address?.neighbourhood || 
          data.address?.suburb || 
          data.address?.village || 
          data.address?.town ||
          data.address?.city_district ||
          data.name || 
          data.address?.city || 
          fallback;

        cache[key] = placeName;
        setName(placeName);

        // Update local storage
        try {
          const stored = localStorage.getItem("proxnet_geocode_cache");
          const parsed = stored ? JSON.parse(stored) : {};
          parsed[key] = placeName;
          localStorage.setItem("proxnet_geocode_cache", JSON.stringify(parsed));
        } catch (e) {}
      } catch (err) {
        console.error("Geocoding failed", err);
      }
    }, 500 + Math.random() * 500); // Random delay to stagger requests

    return () => clearTimeout(timeout);
  }, [lat, lng, fallback]);

  return <span>{name}</span>;
}
