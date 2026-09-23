"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { isPastEvent } from "@/lib/date";
import type { CompanyCluster, MicroStatus } from "@/lib/types";
import { QuestionForm } from "@/components/qa/QuestionForm";
import useSWR, { mutate } from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { CompanyLogo } from "@/components/qa/QuestionList";
import { MicroStatusBeacon } from "./MicroStatusBeacon";
import { haversineDistanceMeters } from "@/lib/geo/haversine";

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

  // 1.5 Shared Institute / Alumni Network
  if (myProfile?.institute_name && targetPerson?.institute_name && myProfile.institute_name.toLowerCase() === targetPerson.institute_name.toLowerCase()) {
    return {
      reason: `Both of you are alumni of ${targetPerson.institute_name}`,
      category: "education"
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
  const [showNextMeetupBanner, setShowNextMeetupBanner] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Auto-dismiss Next Meetup banner after 10 seconds on the Network tab
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNextMeetupBanner(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);
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
  const [stoppingBroadcast, setStoppingBroadcast] = useState(false);
  const [joiningBeaconId, setJoiningBeaconId] = useState<string | null>(null);
  
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

  // Listen for beacon state changes to immediately re-fetch profile & beacons
  useEffect(() => {
    const handleBeaconUpdate = () => {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          setProfile(data);
          try { sessionStorage.setItem("proxnet_profile_cache", JSON.stringify(data)); } catch (e) {}
        });
    };
    window.addEventListener("proxnet_beacon_updated", handleBeaconUpdate);
    return () => window.removeEventListener("proxnet_beacon_updated", handleBeaconUpdate);
  }, []);

  // Fetch logged-in user profile with instant cache
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("proxnet_profile_cache");
      if (cached) {
        const data = JSON.parse(cached);
        setProfile(data);
        if (locationMode === "home" && data.home_lat && data.home_lng) {
          setCenter({ lat: Number(data.home_lat), lng: Number(data.home_lng) });
        }
      }
    } catch (e) {}

    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        try { sessionStorage.setItem("proxnet_profile_cache", JSON.stringify(data)); } catch (e) {}
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


  // Live active beacons tracking
  const [activeBeacons, setActiveBeacons] = useState<MicroStatus[]>([]);

  // Create a map of active beacons by user_id
  const activeBeaconMap = useMemo(() => {
    const map = new Map<string, MicroStatus>();
    for (const b of activeBeacons) {
      if (b.user_id) map.set(b.user_id, b);
    }
    return map;
  }, [activeBeacons]);

  // Sort people: beacon = yes first, then by shortest distance ascending!
  const sortedPeople = useMemo(() => {
    const existingIds = new Set(filteredPeople.map((p: any) => p.id));
    const extraBroadcasters: any[] = [];

    // If the current user has an active broadcast, PIN IT AT THE VERY TOP OF THE NETWORK LIST FOR THEMSELVES!
    const myRawBeacon = profile?.profile_digest?.active_beacon;
    const hasMyActiveBeacon = Boolean(
      profile?.id && (
        activeBeaconMap.has(profile.id) ||
        (myRawBeacon?.expires_at && new Date(myRawBeacon.expires_at).getTime() > Date.now())
      )
    );

    if (hasMyActiveBeacon && profile?.id) {
      extraBroadcasters.push({
        id: profile.id,
        full_name: profile.full_name || "You",
        anonymous_name: profile.full_name || "You",
        company: profile.company || myRawBeacon?.company || "Nearby Company",
        job_title: profile.job_title || myRawBeacon?.job_title || "Professional",
        profile_photo_url: profile.profile_photo_url || null,
        distance: 0,
        is_me: true,
      });
    }

    // Add other active broadcasters strictly within 2km who might not be in filteredPeople
    for (const b of activeBeacons) {
      if (b.user_id && b.user_id !== profile?.id && !existingIds.has(b.user_id)) {
        const beaconDistance = (center?.lat != null && center?.lng != null && b.lat && b.lng)
          ? Math.round(haversineDistanceMeters(center.lat, center.lng, b.lat, b.lng))
          : (typeof b.distance === "number" ? b.distance : null);

        // Strict 2km (2000 meters) limit on beacon visibility
        if (beaconDistance != null && beaconDistance > 2000) {
          continue;
        }

        extraBroadcasters.push({
          id: b.user_id,
          full_name: "Community Neighbor",
          anonymous_name: "Community Neighbor",
          company: b.user?.company || "Nearby Company",
          job_title: b.user?.job_title || "Professional",
          profile_photo_url: b.user?.profile_photo_url || null,
          distance: beaconDistance,
          is_me: false,
        });
      }
    }

    const combined = [...extraBroadcasters, ...filteredPeople];

    // Filter out any active beacon that exceeds 2km
    const withinRadiusPeople = combined.filter((p: any) => {
      if (p.is_me) return true;
      if (activeBeaconMap.has(p.id)) {
        const dist = typeof p.distance === "number" ? p.distance : null;
        if (dist !== null && dist > 2000) return false;
      }
      return true;
    });

    return withinRadiusPeople.sort((a: any, b: any) => {
      // 1. Current user's live broadcast is ALWAYS at the absolute top for themselves
      if (a.is_me && hasMyActiveBeacon) return -1;
      if (b.is_me && hasMyActiveBeacon) return 1;

      // 2. Primary sort: beacon = yes first
      const aBeacon = Boolean(activeBeaconMap.has(a.id) || (a.is_me && hasMyActiveBeacon));
      const bBeacon = Boolean(activeBeaconMap.has(b.id) || (b.is_me && hasMyActiveBeacon));
      if (aBeacon && !bBeacon) return -1;
      if (!aBeacon && bBeacon) return 1;

      // 3. Secondary sort: shortest distance ascending
      const distA = typeof a.distance === "number" && !isNaN(a.distance) ? a.distance : Infinity;
      const distB = typeof b.distance === "number" && !isNaN(b.distance) ? b.distance : Infinity;
      if (distA !== distB) {
        return distA - distB;
      }

      // 4. Tie-breaker by company name alphabetically
      return (a.company || "").localeCompare(b.company || "");
    });
  }, [filteredPeople, activeBeacons, activeBeaconMap, profile, center]);

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

  const handleJoinBeacon = async (userBeacon: any, targetPerson?: any) => {
    const targetUserId = targetPerson?.id || userBeacon.user_id;
    if (!targetUserId) return;
    if (profile?.id && targetUserId === profile.id) return;

    setJoiningBeaconId(targetUserId);
    try {
      const res = await fetch("/api/micro-status/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beaconId: userBeacon.id,
          initiatorUserId: targetUserId,
          activity: userBeacon.activity,
          note: userBeacon.note,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) {
          router.push(`/chat/${data.sessionId}`);
          return;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to join broadcast");
      }
    } catch (err) {
      console.error("Failed to join broadcast:", err);
      alert("Something went wrong while joining the broadcast.");
    } finally {
      setJoiningBeaconId(null);
    }
  };

  const getChatSuggestion = (p: any) => {
    const isSameCompany = Boolean(
      profile?.company &&
      p?.company &&
      profile.company.trim().toLowerCase() === p.company.trim().toLowerCase()
    );
    if (isSameCompany) {
      return `Hi! I noticed we both work at ${p.company} and are nearby in the area. Would love to connect and chat!`;
    }
    return `Hi! I noticed we're professional neighbors in the area and you work as a ${p.job_title} at ${p.company}. Would love to connect and chat!`;
  };

  const radiusLabel = filter2km ? "2.0km" : "Unfiltered";

  const upcomingEvents = (eventsData?.events || [])
    .filter((e: any) => !isPastEvent(e))
    .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Next Future Meetup Event Banner (Shown for 10 seconds only on Network tab) */}
      {showNextMeetupBanner && nextEvent && (
        <div 
          onClick={() => router.push(`/event/${nextEvent.id}`)}
          className="bg-gradient-to-r from-[var(--color-primary-subtle)] via-[var(--color-surface)] to-[var(--color-surface)] border border-[var(--color-primary)]/30 p-3.5 rounded-xl flex items-center justify-between cursor-pointer hover:shadow-md transition-all animate-fadeInUp group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E56B42] to-[#FF8C61] text-white flex items-center justify-center text-xl shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              📅
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#E56B42] uppercase tracking-wider bg-[#E56B42]/10 px-2 py-0.5 rounded-full border border-[#E56B42]/20">
                  Next Meetup
                </span>
                <span className="text-[11px] font-semibold text-[var(--color-primary)]">
                  {new Date(nextEvent.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <span className="font-bold text-[var(--color-text)] leading-tight text-sm mt-0.5 truncate">
                {nextEvent.title}
              </span>
              {nextEvent.venue_name && (
                <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate flex items-center gap-1">
                  <span>📍</span> {nextEvent.venue_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] group-hover:translate-x-0.5 transition-transform">
              <span>View Meetup</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowNextMeetupBanner(false);
              }}
              className="p-1 rounded-full text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover,#1e293b)] transition-colors border-none bg-transparent cursor-pointer ml-1"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── ProxNet AI Chat Floating Action Button (FAB) Bottom Right ── */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 animate-fadeIn">
        <button
          type="button"
          onClick={() => router.push("/proxnet-ai")}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-indigo-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 backdrop-blur-md"
          title="Open ProxNet AI Chat"
          aria-label="ProxNet AI Chat"
        >
          <div className="relative flex items-center justify-center">
            <img src="/logo.png" alt="ProxNet AI" className="w-6 h-6 rounded-full shadow-xs object-cover" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
          </div>
          <div className="flex flex-col text-left pr-1">
            <span className="text-xs font-bold leading-tight flex items-center gap-1">
              ProxNet AI
              <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full font-medium">Chat</span>
            </span>
            <span className="text-[10px] text-white/80 leading-none hidden sm:inline">Ask anything</span>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:translate-x-0.5 transition-transform"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
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

      {/* ── 15-Minute Chai / Walk & Talk Micro-Meetup Beacon ── */}
      <MicroStatusBeacon
        currentUserId={profile?.id}
        userProfile={profile}
        userLat={center?.lat ?? (profile?.home_lat ? Number(profile.home_lat) : null)}
        userLng={center?.lng ?? (profile?.home_lng ? Number(profile.home_lng) : null)}
        onBeaconsChange={setActiveBeacons}
        onJoinBeacon={(beacon) => {
          handleJoinBeacon(beacon);
        }}
      />


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
          ) : sortedPeople.length === 0 ? (
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
                  {sortedPeople.length} Professionals Found
                </span>
              </div>
              {sortedPeople.slice(0, displayLimit).map((p: any, index: number) => {
                const isLast = index === Math.min(sortedPeople.length, displayLimit) - 1;
                const isMe = Boolean(p.is_me || (profile?.id && p.id === profile.id));
                const rawBeacon = activeBeaconMap.get(p.id);
                const userBeacon = rawBeacon || (isMe && profile?.profile_digest?.active_beacon ? {
                  id: profile.profile_digest.active_beacon.id || `beacon-${profile.id}`,
                  user_id: profile.id,
                  activity: profile.profile_digest.active_beacon.activity || "chai",
                  note: profile.profile_digest.active_beacon.note || null,
                  lat: Number(profile.home_lat ?? 0),
                  lng: Number(profile.home_lng ?? 0),
                  created_at: profile.profile_digest.active_beacon.created_at || new Date().toISOString(),
                  expires_at: profile.profile_digest.active_beacon.expires_at,
                  duration_mins: profile.profile_digest.active_beacon.duration_mins || 45,
                  user: {
                    id: profile.id,
                    full_name: profile.full_name || profile.profile_digest.active_beacon.user_name || "You",
                    company: profile.company || profile.profile_digest.active_beacon.company || "Nearby Company",
                    job_title: profile.job_title || profile.profile_digest.active_beacon.job_title || "Professional",
                  }
                } : null);

                const remainingMins = userBeacon ? Math.max(1, Math.round((new Date(userBeacon.expires_at).getTime() - Date.now()) / 60000)) : null;
                const totalMins = userBeacon?.duration_mins || 45;
                const pctRemaining = (remainingMins != null && totalMins > 0) ? Math.max(0, Math.min(1, remainingMins / totalMins)) : 1;

                if (userBeacon) {
                  const activityIcon = userBeacon.activity === "chai" ? "☕" : userBeacon.activity === "walk" ? "🚶" : userBeacon.activity === "sports" ? "🏸" : "💬";
                  const activityLabel = userBeacon.activity === "chai" ? "15-min Chai Beacon" : userBeacon.activity === "walk" ? "Walk & Talk Beacon" : userBeacon.activity === "sports" ? "Badminton / Sports" : "Quick Catch-up";
                  
                  // Never mention real names on broadcasts (anonymize broadcaster identity):
                  const broadcasterTitle = (isMe ? (profile?.job_title || userBeacon.user?.job_title) : (userBeacon.user?.job_title || p.job_title || "Professional"))?.trim() || "Professional";
                  const broadcasterCompany = (isMe ? (profile?.company || userBeacon.user?.company) : (userBeacon.user?.company || p.company || "Nearby Company"))?.trim() || "Nearby Company";

                  // Dynamic boundary & color theme according to elapsed/reducing time:
                  const timeTheme = (() => {
                    if (pctRemaining > 0.6) {
                      return {
                        border: isMe ? "border-emerald-500/90 shadow-emerald-500/20" : "border-emerald-500/80 shadow-emerald-500/15",
                        bg: "bg-gradient-to-r from-emerald-500/15 via-teal-500/5 to-[var(--color-surface)] dark:from-emerald-950/40 dark:via-teal-950/20",
                        badge: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
                        dot: "bg-emerald-500",
                        ping: "bg-emerald-400",
                        bar: "bg-emerald-500",
                        label: "text-emerald-700 dark:text-emerald-300",
                        btn: "from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700",
                      };
                    }
                    if (pctRemaining > 0.3) {
                      return {
                        border: isMe ? "border-amber-500/90 shadow-amber-500/20" : "border-amber-500/80 shadow-amber-500/15",
                        bg: "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-[var(--color-surface)] dark:from-amber-950/40 dark:via-amber-950/20",
                        badge: "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30",
                        dot: "bg-amber-500",
                        ping: "bg-amber-400",
                        bar: "bg-amber-500",
                        label: "text-amber-700 dark:text-amber-300",
                        btn: "from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
                      };
                    }
                    if (pctRemaining > 0.15) {
                      return {
                        border: isMe ? "border-orange-500/95 shadow-orange-500/25" : "border-orange-500/85 shadow-orange-500/20",
                        bg: "bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-[var(--color-surface)] dark:from-orange-950/40 dark:via-orange-950/20",
                        badge: "bg-orange-500/20 text-orange-800 dark:text-orange-200 border-orange-500/30",
                        dot: "bg-orange-500",
                        ping: "bg-orange-400",
                        bar: "bg-orange-500",
                        label: "text-orange-700 dark:text-orange-300",
                        btn: "from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
                      };
                    }
                    return {
                      border: "border-rose-500/90 shadow-rose-500/35 animate-pulse",
                      bg: "bg-gradient-to-r from-rose-500/25 via-red-500/15 to-[var(--color-surface)] dark:from-rose-950/50 dark:via-red-950/30",
                      badge: "bg-rose-500/30 text-rose-800 dark:text-rose-200 border-rose-500/50 animate-pulse",
                      dot: "bg-rose-500",
                      ping: "bg-rose-400",
                      bar: "bg-rose-500",
                      label: "text-rose-700 dark:text-rose-300",
                      btn: "from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700",
                    };
                  })();

                  return (
                    <div
                      key={p.id}
                      ref={isLast ? lastElementRef : null}
                      onClick={() => !isMe && setSelectedPerson(p)}
                      className={`relative overflow-hidden card p-3.5 sm:p-4 rounded-2xl border-2 ${timeTheme.border} ${timeTheme.bg} shadow-md transition-all duration-700 cursor-pointer flex flex-col gap-2.5 animate-fadeIn`}
                    >
                      {/* Top time-reduction depletion bar */}
                      <div className="w-full h-1 bg-[var(--color-border)]/30 rounded-full overflow-hidden -mt-1 mb-0.5">
                        <div
                          className={`h-full ${timeTheme.bar} transition-all duration-1000 ease-linear rounded-full`}
                          style={{ width: `${Math.round(pctRemaining * 100)}%` }}
                        />
                      </div>

                      {/* Broadcast status header with pulsing radar + countdown badge */}
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/40 pb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${timeTheme.ping} opacity-80`} />
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${timeTheme.dot}`} />
                          </span>
                          <span className={`text-xs font-bold ${timeTheme.label} flex items-center gap-1.5 shrink-0`}>
                            <span>{activityIcon}</span>
                            <span>{isMe ? "Your Live Broadcast" : activityLabel}</span>
                          </span>
                        </div>

                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${timeTheme.badge} text-[11px] font-bold border shrink-0`}>
                          <span className="animate-pulse">⏳</span>
                          <span>{remainingMins}m left</span>
                        </div>
                      </div>

                      {/* Main card row: profile info + action button */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <CompanyLogo company={broadcasterCompany} size={42} />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-extrabold text-[var(--color-text)] truncate">
                                {isMe ? "Your Live Broadcast" : "Community Neighbor"}
                              </span>
                              <span className={`text-[10px] font-bold ${isMe ? "text-red-700 dark:text-red-300 bg-red-500/20 border-red-500/30" : timeTheme.badge} border px-1.5 py-0.2 rounded-md uppercase tracking-wider`}>
                                {isMe ? "Active" : "Live Beacon"}
                              </span>
                            </div>

                            {/* Stated ONCE: clean & prominent designation @ company */}
                            <div className="text-xs font-bold mt-1 flex items-center gap-1.5 truncate">
                              <span>💼</span>
                              <span className="font-extrabold text-[var(--color-text)]">{broadcasterTitle}</span>
                              <span className="text-[var(--color-text-secondary)] font-normal">@</span>
                              <span className="font-extrabold text-[var(--color-text)]">{broadcasterCompany}</span>
                            </div>

                            {userBeacon.note && (
                              <span className="text-[11px] text-[var(--color-text-secondary)] italic truncate mt-0.5 flex items-center gap-1 font-medium">
                                <span>📍</span> &quot;{userBeacon.note}&quot;
                              </span>
                            )}
                            {!isMe && p.distance !== null && p.distance !== undefined && (
                              <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                                📍 {p.distance >= 1000 ? `${(p.distance / 1000).toFixed(1)} km` : `${Math.round(p.distance)} m`} away
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMe ? (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setStoppingBroadcast(true);
                                try {
                                  const res = await fetch("/api/micro-status", { method: "DELETE" });
                                  if (res.ok) {
                                    window.dispatchEvent(new CustomEvent("proxnet_beacon_updated"));
                                  } else {
                                    alert("Failed to stop broadcast");
                                  }
                                } catch (err) {
                                  console.error("Failed to stop broadcast:", err);
                                } finally {
                                  setStoppingBroadcast(false);
                                }
                              }}
                              disabled={stoppingBroadcast}
                              className="btn btn-sm bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl border-0 shadow-md flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 shrink-0"
                              title="Stop your current broadcast"
                            >
                              {stoppingBroadcast ? <span className="spinner-sm" /> : <span>🛑</span>}
                              <span>Stop Broadcast</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinBeacon(userBeacon, p);
                              }}
                              disabled={joiningBeaconId === p.id}
                              className={`btn btn-sm bg-gradient-to-r ${timeTheme.btn} text-white font-bold text-xs px-3.5 py-2 rounded-xl border-0 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 shrink-0`}
                            >
                              {joiningBeaconId === p.id ? (
                                <>
                                  <span className="spinner-sm" />
                                  <span>Joining...</span>
                                </>
                              ) : (
                                <>
                                  <span>{activityIcon}</span>
                                  <span>Join {userBeacon.activity === "chai" ? "Chai" : userBeacon.activity === "walk" ? "Walk" : "Meet"}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

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
                  {selectedPerson.institute_name && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full w-fit mt-1">
                      🎓 {selectedPerson.institute_name}
                    </span>
                  )}
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

            {/* Scrapbook: Help Offers, Tinkering & Society Directory Link */}
            {(selectedPerson.help_offers?.length > 0 || selectedPerson.tinkering_with?.length > 0 || selectedPerson.society_name) && (
              <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex flex-col gap-2">
                {selectedPerson.society_name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[var(--color-text-secondary)]">🏢 Complex:</span>
                    <span className="font-semibold text-xs text-[var(--color-text)]">
                      {selectedPerson.society_name}
                    </span>
                  </div>
                )}
                {selectedPerson.help_offers?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      🤝 Can Help With
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPerson.help_offers.slice(0, 3).map((o: string) => (
                        <span key={o} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPerson.tinkering_with?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
                      ⚡ Tinkering With
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPerson.tinkering_with.slice(0, 3).map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setChatTarget(null)}
        >
          <div
            className="bg-[var(--color-surface)] w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[92dvh] overflow-hidden animate-slideUp sm:animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
                Direct Message
              </h3>
              <button
                onClick={() => setChatTarget(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
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
        </div>
      )}

      {/* Map Company Q&A Modal */}
      {selectedCompany && center && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedCompany(null)}
        >
          <div
            className="bg-[var(--color-surface)] w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col max-h-[92dvh] overflow-hidden animate-slideUp sm:animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
            <div className="flex justify-between items-center px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] m-0">
                Ask {selectedCompany} Peers
              </h3>
              <button
                onClick={() => setSelectedCompany(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors border-none bg-transparent cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
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
        </div>
      )}
    </div>
  );
}
