"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { CompanyCluster } from "@/lib/types";
import { QuestionForm } from "@/components/qa/QuestionForm";
import useSWR, { mutate } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { useAnimatedPlaceholder } from "@/lib/hooks/useAnimatedPlaceholder";
import { CompanyLogo } from "@/components/qa/QuestionList";

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

function getReasonToEngage(myProfile: any, targetPerson: any): { reason: string; category: "company" | "education" | "occupation" | "tag" } | null {
  if (!myProfile || !targetPerson) return null;

  const myCompany = (myProfile.company || "").trim().toLowerCase();
  const targetCompany = (targetPerson.company || "").trim().toLowerCase();

  // 1. Same Company (exact match)
  if (myCompany && targetCompany && myCompany === targetCompany && myCompany.length > 1) {
    return {
      reason: `Both of you work at ${targetPerson.company}`,
      category: "company"
    };
  }

  // 2. Educational Institute / Alumni Network (strict word-boundary regex only)
  const educationKeywords = [
    { code: "iim", label: "IIM" },
    { code: "iit", label: "IIT" },
    { code: "bits", label: "BITS Pilani" },
    { code: "nit", label: "NIT" },
    { code: "isb", label: "ISB" },
    { code: "xlri", label: "XLRI" },
    { code: "fms", label: "FMS" },
    { code: "delhi university", label: "Delhi University" },
    { code: "iiit", label: "IIIT" },
    { code: "stanford", label: "Stanford" },
    { code: "harvard", label: "Harvard" },
    { code: "mit", label: "MIT" },
    { code: "oxford", label: "Oxford" },
    { code: "cambridge", label: "Cambridge" }
  ];

  const extractTags = (profile: any): string[] => {
    if (!profile) return [];
    if (Array.isArray(profile.tags)) return profile.tags.map((t: any) => String(t).trim().toLowerCase());
    return [];
  };

  const myText = `${myProfile.about || ""} ${myProfile.professional_bio || ""} ${myProfile.education || ""}`.toLowerCase();
  const targetText = `${targetPerson.about || ""} ${targetPerson.professional_bio || ""} ${targetPerson.education || ""}`.toLowerCase();

  for (const item of educationKeywords) {
    // Word-boundary regex prevents substring matches (e.g., 'nit' inside 'community', 'du' inside 'product'/'education')
    const regex = new RegExp(`\\b${item.code}\\b`, "i");
    if (regex.test(myText) && regex.test(targetText)) {
      return {
        reason: `Shared educational background / network: ${item.label}`,
        category: "education"
      };
    }
  }

  // 3. Shared Community Tags (exact string match in tags array)
  const myTags = extractTags(myProfile);
  const targetTags = extractTags(targetPerson);
  const sharedTag = myTags.find(t => t.length > 2 && targetTags.includes(t));
  if (sharedTag) {
    const formattedTag = sharedTag.charAt(0).toUpperCase() + sharedTag.slice(1);
    return {
      reason: `Shared community tag: ${formattedTag}`,
      category: "tag"
    };
  }

  // 4. Same Occupation / Role (strict word-boundary regex)
  const myRole = (myProfile.job_title || "").trim().toLowerCase();
  const targetRole = (targetPerson.job_title || "").trim().toLowerCase();

  if (myRole && targetRole) {
    const roleKeywords = ["developer", "engineer", "designer", "product", "manager", "architect", "consultant", "analyst", "founder", "director", "marketer", "recruiter"];
    for (const kw of roleKeywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, "i");
      if (kwRegex.test(myRole) && kwRegex.test(targetRole)) {
        return {
          reason: `Both of you work in ${targetPerson.job_title} roles`,
          category: "occupation"
        };
      }
    }
  }

  // No strong overlapping connection -> Return null (do NOT force fit a starter)
  return null;
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
});

export function ProximityMap() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aiQuery, setAiQuery] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [filter2km, setFilter2km] = useState(true);
  const [localError, setLocalError] = useState("");
  const [locationMode, setLocationMode] = useState<"home" | "office">("home");
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [tagFilter, setTagFilter] = useState("");
  
  // Follows & profile modal states
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  
  // Pagination
  const [displayLimit, setDisplayLimit] = useState(20);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setDisplayLimit(prev => prev + 20);
      }
    });
    if (node) observer.current.observe(node);
  }, []);

  // Typewriter animated search placeholder
  const placeholderPhrases = [
    "Google folks?",
    "Banking roles?",
    "Manyata offices?",
    "Amazon workers?",
    "Fintech developers?",
    "Indiranagar neighbors?",
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

  const aggregateApiUrl = center
    ? (filter2km 
        ? `/api/proximity/aggregate?lat=${center.lat}&lng=${center.lng}&radius=2000${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}` 
        : `/api/proximity/aggregate?lat=${center.lat}&lng=${center.lng}&unfiltered=true${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}`)
    : null;
  const peopleApiUrl = center
    ? (filter2km 
        ? `/api/proximity/people?lat=${center.lat}&lng=${center.lng}&radius=2000${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}` 
        : `/api/proximity/people?lat=${center.lat}&lng=${center.lng}&unfiltered=true${tagFilter ? `&tag=${encodeURIComponent(tagFilter)}` : ""}`)
    : null;

  const eventsApiUrl = center 
    ? `/api/events?lat=${center.lat}&lng=${center.lng}&radius=${filter2km ? 2000 : 50000}`
    : null;

  const { data: clusterData, isLoading: clustersLoading, mutate: mutateClusters } = useSWR<{ clusters: CompanyCluster[] }>(aggregateApiUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const { data: peopleData, isLoading: peopleLoading, mutate: mutatePeople } = useSWR<{ people: any[] }>(peopleApiUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });
  const { data: eventsData } = useSWR(eventsApiUrl, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  const clusters = clusterData?.clusters ?? [];
  const people = peopleData?.people ?? [];
  const companyParam = searchParams.get("company");
  let filteredPeople = companyParam
    ? people.filter((p: any) => p.company?.toLowerCase() === companyParam.toLowerCase())
    : people;

  const qFilter = aiQuery.trim().toLowerCase();
  if (qFilter) {
    filteredPeople = filteredPeople.filter((p: any) => 
      (p.company && p.company.toLowerCase().includes(qFilter)) ||
      (p.job_title && p.job_title.toLowerCase().includes(qFilter)) ||
      (p.full_name && p.full_name.toLowerCase().includes(qFilter)) ||
      (p.profile_digest?.skills && p.profile_digest.skills.some((s: string) => s.toLowerCase().includes(qFilter)))
    );
  }
  const isInitializing = !profile || !center;
  const loading = isInitializing || clustersLoading || peopleLoading || (!peopleData && !localError);
  const error = localError;

  const refreshAll = () => {
    mutateClusters();
    mutatePeople();
    setDisplayLimit(20);
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

  const radiusLabel = filter2km ? "2.0km" : "Unfiltered";

  const upcomingEvents = eventsData?.events || [];
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Upcoming Event Banner */}
      {nextEvent && (
        <div 
          onClick={() => router.push(`/event/${nextEvent.id}`)}
          className="bg-gradient-to-r from-[var(--color-primary-subtle)] to-[var(--color-surface)] border border-[var(--color-primary)]/20 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow animate-fadeInUp"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xl shrink-0">
              📅
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#E56B42] uppercase">Upcoming Meetup</span>
              <span className="font-bold text-[var(--color-text)] leading-tight">{nextEvent.title}</span>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {new Date(nextEvent.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-primary)] opacity-70">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}

      {/* ── 1. Dedicated ProxNet AI Chat Card (Own Line on Network Tab) ── */}
      <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border border-[var(--color-primary)]/20 bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-primary-subtle)]/30 shadow-sm animate-fadeInUp">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => router.push("/proxnet-ai")}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="ProxNet AI" className="w-7 h-7 rounded-lg shadow-xs shrink-0" />
            <div className="min-w-0">
              <h4 className="text-body font-bold text-[var(--color-text)] flex items-center gap-1.5 m-0 leading-tight">
                ProxNet AI Chat
                <span className="text-[10px] font-semibold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] px-2 py-0.5 rounded-full border border-[var(--color-primary)]/20 shrink-0">Assistant</span>
              </h4>
              <p className="text-[11px] text-[var(--color-text-secondary)] m-0 mt-0.5 truncate">Ask questions or search nearby professionals</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push("/proxnet-ai");
            }}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 shrink-0 bg-transparent border-none cursor-pointer"
          >
            Open Chat
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (!aiQuery.trim()) return;
            router.push(`/proxnet-ai?q=${encodeURIComponent(aiQuery.trim())}`);
          }} 
          className="relative w-full"
        >
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-primary)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-10 py-2.5 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] text-xs font-medium text-[var(--color-text)]"
            placeholder={animatedPlaceholder}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={!aiQuery.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-50 border-none cursor-pointer"
            title="Send query to ProxNet AI"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>

      {/* ── 2. Consolidated Search Scope Card ── */}
      <div className="flex flex-col gap-2.5 p-3 sm:p-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm animate-fadeInUp">
        <div className="flex flex-row items-center justify-between gap-3">
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
              <div className="text-body font-bold text-[var(--color-primary)] flex items-center gap-2 flex-wrap mt-0.5">
                <button
                  type="button"
                  onClick={() => setFilter2km(!filter2km)}
                  className={`flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs border border-[var(--color-border-light)] ${
                    filter2km
                      ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shadow-xs"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span>📍</span>
                  <span>{filter2km ? "Within 2 km" : "All Distances"}</span>
                </button>
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

          {/* List / Map View Mode Toggle (Icon-only) */}
          <div className="flex bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] p-0.5 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all border-0 cursor-pointer flex items-center justify-center ${
                viewMode === "list"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-transparent"
              }`}
              title="List View"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`p-1.5 rounded-md transition-all border-0 cursor-pointer flex items-center justify-center ${
                viewMode === "map"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-transparent"
              }`}
              title="Map View"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </button>
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

            <div style={{ flex: "1 1 180px" }}>
              <label className="label text-[10px] font-bold uppercase tracking-wider mb-1 block">Distance Scope</label>
              <button
                type="button"
                onClick={() => setFilter2km(!filter2km)}
                className={`w-full flex items-center justify-center gap-2 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs border border-[var(--color-border-light)] ${
                  filter2km
                    ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shadow-xs"
                    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                }`}
              >
                <span>📍</span>
                <span>{filter2km ? "Within 2 km" : "All Distances"}</span>
              </button>
            </div>

            <div style={{ flex: "1 1 180px" }}>
              <label className="label text-[10px] font-bold uppercase tracking-wider mb-1 block">Filter by Tag</label>
              <div className="relative w-full">
                <input
                  type="text"
                  className="input w-full py-1.5 text-xs rounded-lg pr-7"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="e.g. #IIM Lucknow"
                  style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface-secondary)" }}
                />
                {tagFilter && (
                  <button
                    type="button"
                    onClick={() => setTagFilter("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border-none bg-transparent cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>
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
            <div className="card p-8 text-center border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 rounded-xl flex flex-col items-center justify-center gap-3 animate-fadeIn py-12">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <span className="spinner w-8 h-8 text-[var(--color-primary)]" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-body font-bold text-[var(--color-text)] m-0">Connecting to your local network...</p>
                <p className="text-caption text-[var(--color-text-secondary)] m-0">Finding verified professionals near your location</p>
              </div>
              <div className="w-full max-w-md flex flex-col gap-2.5 mt-3">
                <div className="skeleton h-16 rounded-xl w-full" />
                <div className="skeleton h-16 rounded-xl w-full opacity-70" />
                <div className="skeleton h-16 rounded-xl w-full opacity-40" />
              </div>
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className="card p-8 text-center border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50 rounded-xl">
              {companyParam && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-semibold text-xs mb-4">
                  <span>Filtered by company: <strong>{companyParam}</strong></span>
                  <button
                    onClick={() => {
                      router.push("/qa?tab=network");
                    }}
                    className="underline cursor-pointer border-none bg-transparent font-bold text-[var(--color-primary)] text-xs"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
              <p className="text-body text-[var(--color-text-secondary)] font-medium">No professionals found near you</p>
              <p className="text-caption text-[var(--color-text-tertiary)] mt-1">Try expanding your search radius using the scope filter.</p>
            </div>
          ) : (
            <>
              {companyParam && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-semibold text-xs mb-2">
                  <span>Filtered by company: <strong>{companyParam}</strong></span>
                  <button
                    onClick={() => {
                      router.push("/qa?tab=network");
                    }}
                    className="underline cursor-pointer border-none bg-transparent font-bold text-[var(--color-primary)] text-xs"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {filteredPeople.length} Professionals Found
                </span>
              </div>
              {filteredPeople.slice(0, displayLimit).map((p: any, index: number) => {
                const isLast = index === Math.min(filteredPeople.length, displayLimit) - 1;
                return (
              <div
                key={p.id}
                ref={isLast ? lastElementRef : null}
                onClick={() => setSelectedPerson(p)}
                className="card p-3 sm:p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyLogo company={p.company} size={40} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[var(--color-text)] truncate">
                      {p.company}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] font-medium truncate mt-0.5">
                      {p.job_title}
                    </span>
                    {p.distance !== null && p.distance !== undefined ? (
                      <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                        📍 {p.distance >= 1000 ? `${(p.distance / 1000).toFixed(1)} km` : `${Math.round(p.distance)} m`} away
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 font-semibold animate-pulse" style={{ color: "var(--color-warning)", backgroundColor: "var(--color-warning-bg, rgba(245, 158, 11, 0.1))", border: "1px solid rgba(245, 158, 11, 0.2)", width: "fit-content" }}>
                        ⚠️ Location not specified
                      </span>
                    )}
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
              );
            })}
            </>
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
              radius={filter2km ? 2000 : 100000}
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
                <CompanyLogo company={selectedPerson.company} size={48} />
                <div className="flex flex-col min-w-0">
                  <h4 className="text-body font-bold m-0 text-[var(--color-text)] truncate">
                    {selectedPerson.anonymous_name}
                  </h4>
                  <span className="text-xs font-bold text-[var(--color-text-secondary)] mt-0.5 truncate">
                    {selectedPerson.company}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">
                    {selectedPerson.job_title}
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
                <span className="font-semibold text-xs" style={{ color: selectedPerson.distance !== null && selectedPerson.distance !== undefined ? "var(--color-text)" : "var(--color-warning)" }}>
                  {selectedPerson.distance !== null && selectedPerson.distance !== undefined ? (
                    selectedPerson.distance >= 1000 ? `${(selectedPerson.distance / 1000).toFixed(1)} km` : `${Math.round(selectedPerson.distance)} m`
                  ) : (
                    "Location not specified"
                  )}
                </span>
              </div>
            </div>

            {/* Professional Bio */}
            {selectedPerson.professional_bio && (
              <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--color-primary)]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Professional Bio</span>
                </div>
                <p className="text-xs text-[var(--color-text)] leading-relaxed m-0">
                  {selectedPerson.professional_bio}
                </p>
              </div>
            )}

            {/* Reason to Engage Callout (if a genuine common connection exists) */}
            {(() => {
              const engagement = getReasonToEngage(profile, selectedPerson);
              if (!engagement) return null;

              return (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">✨</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Reason to Engage
                    </span>
                  </div>
                  <p className="text-xs font-serif italic leading-relaxed m-0 text-amber-800 dark:text-amber-100">
                    "{engagement.reason}"
                  </p>
                </div>
              );
            })()}

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
              defaultRadius={filter2km ? 2000 : 100000}
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
              defaultRadius={filter2km ? 2000 : 100000}
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
