"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanyCluster } from "@/lib/types";
import { QuestionForm } from "@/components/qa/QuestionForm";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { useAnimatedPlaceholder } from "@/lib/hooks/useAnimatedPlaceholder";

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
  const [locationMode, setLocationMode] = useState<"home" | "office">("home");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  
  // Follows & profile modal states
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  // Typewriter animated search placeholder
  const placeholderPhrases = [
    "anyone from Google?",
    "anyone working in Banking domain?",
    "anyone having office in Manyata?",
    "anyone from Amazon?",
    "anyone working in Fintech?",
    "anyone with office in Indiranagar?",
  ];
  const animatedPlaceholder = useAnimatedPlaceholder(placeholderPhrases, "Ask ProxNet for ");

  // Fetch logged-in user profile
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        if (locationMode === "home") {
          if (data.home_lat && data.home_lng) {
            setCenter({ lat: Number(data.home_lat), lng: Number(data.home_lng) });
          }
        }
      });
  }, []);

  // Fetch coordinates on locationMode change
  useEffect(() => {
    if (!profile) return;
    if (locationMode === "home") {
      if (profile.home_lat && profile.home_lng) {
        setCenter({ lat: Number(profile.home_lat), lng: Number(profile.home_lng) });
      } else {
        alert("Please set your Home address on the Profile page first.");
        router.push("/profile?missingHome=true");
      }
    } else if (locationMode === "office") {
      if (profile.office_lat && profile.office_lng) {
        setCenter({ lat: Number(profile.office_lat), lng: Number(profile.office_lng) });
      } else {
        alert("Please configure your Office location on your Profile page first.");
        router.push("/profile?missingOffice=true");
        // Revert selection
        setLocationMode("home");
      }
    }
  }, [locationMode, profile]);

  const aggregateApiUrl = center ? `/api/proximity/aggregate?lat=${center.lat}&lng=${center.lng}&radius=${radius}` : null;
  const peopleApiUrl = center ? `/api/proximity/people?lat=${center.lat}&lng=${center.lng}&radius=${radius}` : null;

  const { data: clusterData, isLoading: clustersLoading, mutate: mutateClusters } = useSWR<{ clusters: CompanyCluster[] }>(aggregateApiUrl, fetcher);
  const { data: peopleData, isLoading: peopleLoading, mutate: mutatePeople } = useSWR<{ people: any[] }>(peopleApiUrl, fetcher);

  const clusters = clusterData?.clusters ?? [];
  const people = peopleData?.people ?? [];
  const loading = clustersLoading || peopleLoading;
  const error = localError;

  const refreshAll = () => {
    mutateClusters();
    mutatePeople();
  };

  const handleFollowToggle = async (e: React.MouseEvent | React.FormEvent, person: any) => {
    if (e) e.stopPropagation();
    
    // Optimistic Update
    const updatedPeople = people.map((p) => {
      if (p.id === person.id) {
        return { ...p, is_followed: !p.is_followed };
      }
      return p;
    });
    mutate(peopleApiUrl, { people: updatedPeople }, false);

    if (selectedPerson && selectedPerson.id === person.id) {
      setSelectedPerson((prev: any) => ({ ...prev, is_followed: !prev.is_followed }));
    }

    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: person.id }),
      });
      if (!res.ok) throw new Error("Failed to follow");
      mutate(peopleApiUrl);
    } catch (err) {
      // Revert on error
      mutate(peopleApiUrl);
    }
  };

  const openDirectChat = (person: any) => {
    setChatTarget(person);
  };

  const getChatSuggestion = (p: any) => {
    return `Hi! I noticed we're professional neighbors in the area and you work as a ${p.job_title} at ${p.company}. Would love to connect and chat!`;
  };

  const radiusLabel = radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* ── 1. Consolidated Search Scope Card ── */}
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm animate-fadeInUp">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="m4.93 4.93 4.24 4.24"/>
                <path d="m14.83 9.17 4.24-4.24"/>
                <path d="M12 2v10"/>
              </svg>
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Search Scope</div>
              <div className="text-body font-bold text-[var(--color-primary)] flex items-center gap-2">
                <span>{locationMode === "home" ? "Home" : "Office"} &bull; {radiusLabel}</span>
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className={`p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer border-none flex items-center justify-center ${filtersExpanded ? 'text-[var(--color-primary)] bg-[var(--color-primary-subtle)]' : 'text-[var(--color-text-secondary)] bg-transparent'}`}
                  title="Filter Search Scope"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Toggle View Mode & AI Search */}
          <div className="flex items-center gap-3 flex-1 max-w-md w-full justify-end sm:justify-start">
            
            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-[var(--color-surface-secondary)] p-1 rounded-lg border border-[var(--color-border-light)] shrink-0 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition-all border-none ${viewMode === "list" ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] bg-transparent'}`}
                title="List View"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition-all border-none ${viewMode === "map" ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] bg-transparent'}`}
                title="Map View"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
              </button>
            </div>

            {/* AI Input */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!aiQuery.trim()) return;
                router.push(`/proxnet-ai?q=${encodeURIComponent(aiQuery.trim())}`);
              }} 
              className="relative flex-grow"
            >
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <img src="/logo.png" alt="ProxNet AI" className="w-5 h-5 opacity-70 grayscale" />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-10 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] text-xs font-medium"
                placeholder={animatedPlaceholder}
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
              />
              <button
                type="submit"
                disabled={!aiQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-50 border-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* Collapsible filters pane inside the card */}
        {filtersExpanded && (
          <div className="pt-3 border-t border-[var(--color-border-light)] flex flex-wrap items-end gap-4 animate-fadeInDown">
            <div style={{ minWidth: 160, flex: "1 1 160px" }}>
              <label className="label text-[10px] font-bold uppercase tracking-wider mb-1 block">Location Type</label>
              <select
                className="input w-full py-1.5 text-xs rounded-lg"
                value={locationMode}
                onChange={(e) => setLocationMode(e.target.value as any)}
                style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface-secondary)" }}
              >
                <option value="home">Home Address</option>
                <option value="office">Office Address</option>
              </select>
            </div>

            <div style={{ flex: "2 1 200px" }}>
              <label className="label text-[10px] font-bold uppercase tracking-wider mb-1 block">
                Radius: <span className="text-[var(--color-primary)] font-bold">{radiusLabel}</span>
              </label>
              <input
                type="range"
                min={100}
                max={100000}
                step={100}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-[var(--color-surface-secondary)] rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: "var(--color-primary)" }}
              />
            </div>

            <button
              type="button"
              onClick={refreshAll}
              className="btn btn-primary btn-sm px-4 py-2 flex items-center gap-1.5 shrink-0"
              disabled={loading}
            >
              {loading ? <span className="spinner-sm" /> : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              )}
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          {error}
        </div>
      )}

      {/* ── 2. View Mode Content Pane ── */}
      {viewMode === "list" ? (
        
        /* ── LIST VIEW: scrollable nearby people sorted by similarity ── */
        <div className="flex flex-col gap-3 min-h-[300px]">
          {loading && people.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="skeleton h-20 rounded-xl" />
              <div className="skeleton h-20 rounded-xl" />
            </div>
          ) : people.length === 0 ? (
            <div className="card p-8 text-center border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 rounded-xl">
              <p className="text-body text-[var(--color-text-secondary)] font-medium">No professionals found near you</p>
              <p className="text-caption text-[var(--color-text-tertiary)] mt-1">Try expanding your search radius using the scope filter.</p>
            </div>
          ) : (
            people.map((p: any) => (
              <div
                key={p.id}
                onClick={() => setSelectedPerson(p)}
                className="card p-3 sm:p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shrink-0 border border-[var(--color-primary)]/10 shadow-sm">
                    {p.anonymous_name.slice(12, 14).toUpperCase() || "N"}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[var(--color-text)] truncate">
                      {p.job_title} @ {p.company}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                      📍 {p.distance >= 1000 ? `${(p.distance / 1000).toFixed(1)} km` : `${Math.round(p.distance)} m`} away &bull; <span className="text-[var(--color-accent)] font-semibold">{p.similarity}% match</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => handleFollowToggle(e, p)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${p.is_followed ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'}`}
                  >
                    {p.is_followed ? "Following" : "Follow"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDirectChat(p); }}
                    className="btn-icon btn-ghost text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]/50 rounded-lg flex items-center justify-center p-2 border-0 bg-transparent shrink-0"
                    title="Send Message"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        
        /* ── MAP VIEW: Leaflet Company clusters map container ── */
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
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-secondary)]">
              <span className="spinner" />
              <span className="text-xs">Acquiring location…</span>
            </div>
          ) : (
            <div className="skeleton w-full h-full" />
          )}
        </div>
      )}

      {/* ── 3. Profile Detail Modal ── */}
      {selectedPerson && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPerson(null)}
        >
          <div 
            className="bg-[var(--color-surface)] w-full max-w-sm rounded-xl shadow-xl border border-[var(--color-border)] p-5 animate-scaleIn flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-lg border border-[var(--color-primary)]/10">
                  🏡
                </div>
                <div className="flex flex-col">
                  <h4 className="text-body font-bold m-0 text-[var(--color-text)]">
                    {selectedPerson.anonymous_name}
                  </h4>
                  <span className="text-caption text-[var(--color-text-secondary)] mt-0.5">
                    {selectedPerson.job_title} @ {selectedPerson.company}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPerson(null)} 
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border-0 bg-transparent text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">Proximity distance:</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {selectedPerson.distance >= 1000 ? `${(selectedPerson.distance / 1000).toFixed(1)} km` : `${Math.round(selectedPerson.distance)} m`}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-[var(--color-text-secondary)]">Compatibility:</span>
                <span className="font-semibold text-[var(--color-accent)]">{selectedPerson.similarity}% match</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={(e) => handleFollowToggle(e, selectedPerson)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${selectedPerson.is_followed ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)] text-white border-0 hover:bg-[var(--color-primary-hover)]'}`}
              >
                {selectedPerson.is_followed ? "Unfollow" : "Follow"}
              </button>
              <button
                onClick={() => { const p = selectedPerson; setSelectedPerson(null); openDirectChat(p); }}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Chat/Question Dialog Modal with suggested prefill message ── */}
      {chatTarget && center && (
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
          onClick={() => setChatTarget(null)}
        >
          <div
            style={{ width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
            className="animate-scaleIn"
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-36px", marginRight: "12px", position: "relative", zIndex: 10 }}>
              <button
                className="btn-icon btn-ghost"
                onClick={() => setChatTarget(null)}
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-light)" }}
              >
                ✕
              </button>
            </div>
            <QuestionForm
              defaultLat={center.lat}
              defaultLng={center.lng}
              defaultRadius={radius}
              targetUser={{
                id: chatTarget.id,
                job_title: chatTarget.job_title,
                company: chatTarget.company,
              }}
              initialMsg={getChatSuggestion(chatTarget)}
              onPosted={() => {
                setTimeout(() => setChatTarget(null), 1500);
              }}
            />
          </div>
        </div>
      )}

      {/* Map Company Q&A Modal */}
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
            className="animate-scaleIn"
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
