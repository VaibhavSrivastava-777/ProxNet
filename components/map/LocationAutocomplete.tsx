"use client";

import { useEffect, useState, useRef } from "react";

interface Suggestion {
  id: string;
  description: string;
  source: "google" | "photon";
  raw: any;
}

interface LocationAutocompleteProps {
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  onSelect: (selection: { name: string; lat: number; lng: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function LocationAutocomplete({
  value,
  placeholder = "Search location...",
  onChange,
  onSelect,
  className = "input w-full",
  style,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreNextSearch = useRef(value ? true : false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Sync state if initial value changes from parent
  useEffect(() => {
    if (value !== query) {
      ignoreNextSearch.current = true;
      setQuery(value);
    }
  }, [value]);

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not defined. Google Autocomplete is disabled; falling back to Photon.");
      return;
    }

    const win = window as any;
    if (win.google?.maps?.places) {
      setGoogleAvailable(true);
      return;
    }

    const scriptId = "google-maps-places-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const handleScriptLoad = () => {
      if (win.google?.maps?.places) {
        setGoogleAvailable(true);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = handleScriptLoad;
      script.onerror = () => {
        console.error("Failed to load Google Maps script. Using Photon fallback.");
      };
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", handleScriptLoad);
    }

    return () => {
      if (script) {
        script.removeEventListener("load", handleScriptLoad);
      }
    };
  }, [apiKey]);

  // Debounced search logic
  useEffect(() => {
    if (ignoreNextSearch.current) {
      ignoreNextSearch.current = false;
      return;
    }

    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchSuggestions(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (inputStr: string) => {
    setLoading(true);
    let results: Suggestion[] = [];
    const win = window as any;

    // 1. Try Google Autocomplete
    if (googleAvailable && win.google?.maps?.places) {
      try {
        const service = new win.google.maps.places.AutocompleteService();
        const predictions = await new Promise<any[] | null>((resolve) => {
          service.getPlacePredictions(
            { input: inputStr },
            (res: any, status: any) => {
              if (status === win.google.maps.places.PlacesServiceStatus.OK && res) {
                resolve(res);
              } else {
                resolve(null);
              }
            }
          );
        });

        if (predictions && predictions.length > 0) {
          results = predictions.map((p) => ({
            id: p.place_id,
            description: p.description,
            source: "google",
            raw: p,
          }));
        }
      } catch (e) {
        console.error("Google Places search error, falling back to Photon:", e);
      }
    }

    // 2. Photon Fallback (if Google returned nothing or was not loaded)
    if (results.length === 0) {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(inputStr)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          if (data.features) {
            results = data.features.map((f: any, idx: number) => {
              const props = f.properties;
              const parts = [
                props.name,
                props.street,
                props.city || props.town,
                props.state,
                props.country,
              ].filter(Boolean);
              
              const description = parts.length > 0 ? parts.join(", ") : "Unknown location";

              return {
                id: `photon-${idx}-${props.osm_id || Math.random()}`,
                description,
                source: "photon",
                raw: f,
              };
            });
          }
        }
      } catch (e) {
        console.error("Photon API geocoding failed:", e);
      }
    }

    setSuggestions(results);
    setShowDropdown(results.length > 0);
    setLoading(false);
  };

  const handleSelect = async (s: Suggestion) => {
    ignoreNextSearch.current = true;
    setShowDropdown(false);
    setQuery(s.description);
    onChange(s.description);
    const win = window as any;

    if (s.source === "photon") {
      const coords = s.raw.geometry?.coordinates; // [lng, lat]
      if (coords && coords.length >= 2) {
        onSelect({
          name: s.description,
          lat: coords[1],
          lng: coords[0],
        });
      }
    } else if (s.source === "google" && win.google?.maps?.places) {
      try {
        setLoading(true);
        const dummy = document.createElement("div");
        const service = new win.google.maps.places.PlacesService(dummy);

        const placeDetails = await new Promise<any>((resolve) => {
          service.getDetails(
            { placeId: s.id, fields: ["geometry", "formatted_address", "name"] },
            (place: any, status: any) => {
              if (status === win.google.maps.places.PlacesServiceStatus.OK && place) {
                resolve(place);
              } else {
                resolve(null);
              }
            }
          );
        });

        if (placeDetails && placeDetails.geometry?.location) {
          onSelect({
            name: placeDetails.name || placeDetails.formatted_address || s.description,
            lat: placeDetails.geometry.location.lat(),
            lng: placeDetails.geometry.location.lng(),
          });
        } else {
          alert("Could not retrieve details for the selected Google Place.");
        }
      } catch (error) {
        console.error("Google Places details fetch failed:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        className={className}
        style={style}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          if (!e.target.value) {
            setSuggestions([]);
            setShowDropdown(false);
          }
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowDropdown(true);
          }
        }}
      />
      {loading && (
        <span
          className="spinner-sm"
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100%",
            zIndex: 1000,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-light)",
            borderRadius: "8px",
            marginTop: "4px",
            maxHeight: "220px",
            overflowY: "auto",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            padding: "4px 0",
            margin: 0,
            listStyle: "none",
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s.id}
              onClick={() => handleSelect(s)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: "14px",
                color: "var(--color-text)",
                borderBottom: "1px solid var(--color-border-light)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <span style={{ flex: 1, whiteSpace: "normal", wordBreak: "break-word" }}>
                {s.description}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--color-text-tertiary)",
                  background: "var(--color-surface-secondary)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  marginLeft: "8px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {s.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
