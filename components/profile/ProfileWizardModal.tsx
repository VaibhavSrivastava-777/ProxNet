"use client";

import { useState, useEffect, useRef } from "react";
import type { User } from "@/lib/types";
import {
  ProfileWizardStepId,
  PROFILE_WIZARD_STEPS_CONFIG,
  getMissingProfileWizardSteps,
} from "@/lib/profile-wizard";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";

interface ProfileWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUser: Partial<User> | null;
  onUserUpdated: (user: Partial<User>) => void;
  onEnableNotifications?: () => Promise<void>;
}

const POPULAR_ROLES = [
  "Software Engineer",
  "Senior SDE",
  "Product Manager",
  "Engineering Manager",
  "Consultant",
  "Founder / Co-Founder",
  "Data Scientist",
  "UI/UX Designer",
];

const POPULAR_TECH_PARKS = [
  { name: "Manyata Tech Park, Bengaluru", lat: 13.0494, lng: 77.6206 },
  { name: "Bagmane Tech Park, CV Raman Nagar", lat: 12.9806, lng: 77.6624 },
  { name: "Bellandur Outer Ring Road, Bengaluru", lat: 12.926, lng: 77.6762 },
  { name: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.677 },
  { name: "Whitefield (ITPB), Bengaluru", lat: 12.9863, lng: 77.7338 },
  { name: "Cyber City, DLF Phase 2, Gurugram", lat: 28.4952, lng: 77.089 },
  { name: "Bandra Kurla Complex (BKC), Mumbai", lat: 19.0657, lng: 77.8687 },
  { name: "HITEC City, Hyderabad", lat: 17.4474, lng: 78.3762 },
];

export function ProfileWizardModal({
  isOpen,
  onClose,
  initialUser,
  onUserUpdated,
  onEnableNotifications,
}: ProfileWizardModalProps) {
  const [currentUser, setCurrentUser] = useState<Partial<User>>({});
  const [missingSteps, setMissingSteps] = useState<ProfileWizardStepId[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Field states
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);

  // Home Location state
  const [homeName, setHomeName] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [detectingHomeGps, setDetectingHomeGps] = useState(false);

  // Office Location state
  const [officeName, setOfficeName] = useState("");
  const [officeLat, setOfficeLat] = useState<number | null>(null);
  const [officeLng, setOfficeLng] = useState<number | null>(null);

  // Notifications state
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Check notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsGranted(Notification.permission === "granted");
    }
  }, []);

  // Initialize and compute missing steps whenever modal opens or initialUser updates
  useEffect(() => {
    if (isOpen && initialUser) {
      const u = { ...initialUser };
      setCurrentUser(u);
      setJobTitle(u.job_title || "");
      setCompany(u.company || "");
      setHomeName(u.home_name || "");
      setHomeLat(u.home_lat ?? null);
      setHomeLng(u.home_lng ?? null);
      setOfficeName(u.office_name || "");
      setOfficeLat(u.office_lat ?? null);
      setOfficeLng(u.office_lng ?? null);

      const isNotifGranted =
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted";

      const missing = getMissingProfileWizardSteps(u, isNotifGranted);
      setMissingSteps(missing);
      setCurrentStepIndex(0);
      setIsCompleted(missing.length === 0);
      setErrorMsg("");
    }
  }, [isOpen, initialUser]);

  // Debounced company suggestions from /api/companies
  useEffect(() => {
    if (!company || company.trim().length < 2) {
      setCompanySuggestions([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setFetchingCompanies(true);
      try {
        const res = await fetch("/api/companies");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.companies)) {
            const matches = data.companies
              .filter((c: string) => c.toLowerCase().includes(company.toLowerCase()))
              .slice(0, 5);
            setCompanySuggestions(matches);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch company suggestions:", err);
      } finally {
        setFetchingCompanies(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [company]);

  if (!isOpen) return null;

  const currentStepId = missingSteps[currentStepIndex];
  const stepConfig = currentStepId ? PROFILE_WIZARD_STEPS_CONFIG[currentStepId] : null;
  const totalSteps = missingSteps.length;
  const progressPercent = totalSteps > 0 ? Math.round(((currentStepIndex + 1) / totalSteps) * 100) : 100;

  // Handle saving current step
  const handleSaveStep = async () => {
    setErrorMsg("");
    setSaving(true);

    try {
      const payload: Record<string, any> = {};

      if (currentStepId === "designation") {
        if (!jobTitle.trim()) {
          setErrorMsg("Please enter or select your designation / role.");
          setSaving(false);
          return;
        }
        payload.job_title = jobTitle.trim();
      } else if (currentStepId === "company") {
        if (!company.trim()) {
          setErrorMsg("Please enter your current company or workplace.");
          setSaving(false);
          return;
        }
        payload.company = company.trim();
      } else if (currentStepId === "home_location") {
        if (!homeLat || !homeLng) {
          setErrorMsg("Please select your neighborhood or use current location.");
          setSaving(false);
          return;
        }
        payload.home_lat = homeLat;
        payload.home_lng = homeLng;
        payload.home_name = homeName.trim() || "Home Neighborhood";
      } else if (currentStepId === "office_location") {
        if (!officeLat || !officeLng) {
          setErrorMsg("Please select your workplace location or tech park.");
          setSaving(false);
          return;
        }
        payload.office_lat = officeLat;
        payload.office_lng = officeLng;
        payload.office_name = officeName.trim() || "Workplace / Office";
      }

      // If payload has data, immediately persist to Supabase
      if (Object.keys(payload).length > 0) {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to save profile changes.");
        }

        const updated = await res.json();
        const mergedUser = { ...currentUser, ...updated, ...payload };
        setCurrentUser(mergedUser);
        onUserUpdated(mergedUser);
      }

      // Advance to next step or complete
      if (currentStepIndex < totalSteps - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        setIsCompleted(true);
      }
    } catch (err: any) {
      console.error("Step save failed:", err);
      setErrorMsg(err.message || "An unexpected error occurred while saving. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle skipping current step
  const handleSkipStep = () => {
    setErrorMsg("");
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  // Handle GPS detection for home
  const handleDetectHomeLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }
    setDetectingHomeGps(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setHomeLat(lat);
        setHomeLng(lng);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
            { headers: { "User-Agent": "ProxNet/1.0" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const neighborhood =
              addr.suburb ||
              addr.neighbourhood ||
              addr.residential ||
              addr.city_district ||
              addr.city ||
              "Current Neighborhood";
            setHomeName(neighborhood);
          } else {
            setHomeName(`Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
          }
        } catch {
          setHomeName(`Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
        } finally {
          setDetectingHomeGps(false);
        }
      },
      (err) => {
        console.warn("GPS detection failed:", err);
        setErrorMsg("Unable to access location. Please enter your neighborhood manually above.");
        setDetectingHomeGps(false);
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  };

  // Handle Enable Notifications action
  const handleTriggerNotifications = async () => {
    setEnablingNotifications(true);
    setErrorMsg("");
    try {
      if (onEnableNotifications) {
        await onEnableNotifications();
      } else if (typeof window !== "undefined" && "Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          setNotificationsGranted(true);
        }
      }
      // Advance to complete
      if (currentStepIndex < totalSteps - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      } else {
        setIsCompleted(true);
      }
    } catch (err: any) {
      console.error("Notifications enable error:", err);
      setErrorMsg("Could not enable notifications. You can enable them later in your Profile settings.");
    } finally {
      setEnablingNotifications(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-0 md:p-4">
      {/* Modal Container */}
      <div
        className="w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-wizard-title"
      >
        {/* Top Progress Bar */}
        {!isCompleted && totalSteps > 0 && (
          <div className="w-full bg-[var(--color-surface-secondary)] h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{isCompleted ? "🎉" : stepConfig?.icon || "✨"}</span>
            <div>
              <h3 id="profile-wizard-title" className="text-base font-bold text-[var(--color-text)] m-0 leading-snug">
                {isCompleted ? "Profile Setup Complete!" : "Complete Your Profile"}
              </h3>
              {!isCompleted && totalSteps > 0 && (
                <p className="text-[11px] text-[var(--color-text-secondary)] font-medium m-0">
                  Step {currentStepIndex + 1} of {totalSteps}: {stepConfig?.badge}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
            title="Close wizard"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {isCompleted ? (
            /* Celebration Screen */
            <div className="text-center py-6 px-3 flex flex-col items-center gap-3 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-3xl mb-1 ring-8 ring-emerald-500/10">
                ✓
              </div>
              <h4 className="text-lg font-bold text-[var(--color-text)] m-0">You&apos;re All Set!</h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm m-0 leading-relaxed">
                Your profile is now optimized for neighborhood networking. You are visible to verified professionals
                near you for chai chats, job referrals, and carpools.
              </p>

              <div className="w-full bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] rounded-xl p-3.5 text-left text-xs flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Role:</span>
                  <span className="font-semibold text-[var(--color-text)]">{currentUser.job_title || "Provided"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Company:</span>
                  <span className="font-semibold text-[var(--color-text)]">{currentUser.company || "Provided"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Neighborhood:</span>
                  <span className="font-semibold text-[var(--color-text)]">{currentUser.home_name || "Configured"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-secondary)]">Workplace:</span>
                  <span className="font-semibold text-[var(--color-text)]">{currentUser.office_name || "Configured"}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Step Views */
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-bold text-[var(--color-text)] m-0">{stepConfig?.title}</h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 m-0 leading-relaxed">
                  {stepConfig?.subtitle}
                </p>
              </div>

              {/* Step: Designation */}
              {currentStepId === "designation" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="label text-xs font-semibold">Your Designation / Job Title *</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g. Senior Software Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveStep()}
                      autoFocus
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-1.5">
                      Or pick from popular roles:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_ROLES.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setJobTitle(role)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                            jobTitle === role
                              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
                              : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Company */}
              {currentStepId === "company" && (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <label className="label text-xs font-semibold">Company or Organization Name *</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g. Google, Flipkart, Infosys"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveStep()}
                      autoFocus
                    />
                    {fetchingCompanies && (
                      <span className="absolute right-3 top-8 text-[11px] text-[var(--color-text-tertiary)] animate-pulse">
                        Searching...
                      </span>
                    )}

                    {companySuggestions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-[var(--color-text-secondary)] w-full">Suggestions:</span>
                        {companySuggestions.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => {
                              setCompany(sug);
                              setCompanySuggestions([]);
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] text-[var(--color-primary)] font-medium"
                          >
                            🏢 {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step: Home Location */}
              {currentStepId === "home_location" && (
                <div className="flex flex-col gap-3">
                  {/* Critical Privacy Assurance */}
                  <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5 shadow-sm">
                    <span className="text-lg shrink-0">🛡️</span>
                    <div>
                      <span className="font-bold block text-emerald-900 dark:text-emerald-200">
                        One-Time Activity • No Continuous Tracking
                      </span>
                      <span className="leading-relaxed opacity-90 block mt-0.5 text-[11px]">
                        ProxNet does <strong>NOT</strong> track your continuous location or daily movements. This is a
                        one-time neighborhood reference point used strictly to find nearby peers and active chai/walk
                        beacons.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-semibold">Home Neighborhood / Area *</label>
                    <LocationAutocomplete
                      value={homeName}
                      placeholder="Search your neighborhood, locality, or apartment..."
                      onChange={(val) => setHomeName(val)}
                      onSelect={(sel) => {
                        setHomeName(sel.name);
                        setHomeLat(sel.lat);
                        setHomeLng(sel.lng);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDetectHomeLocation}
                      disabled={detectingHomeGps}
                      className="btn btn-sm btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                    >
                      <span>📍</span>
                      <span>{detectingHomeGps ? "Detecting GPS..." : "Use Current GPS Location"}</span>
                    </button>
                    {homeLat && homeLng && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        ✓ Coordinates set
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Step: Office Location */}
              {currentStepId === "office_location" && (
                <div className="flex flex-col gap-3">
                  {/* Workplace Privacy Assurance */}
                  <div className="p-3 rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2.5 shadow-sm">
                    <span className="text-lg shrink-0">🛡️</span>
                    <div>
                      <span className="font-bold block text-blue-900 dark:text-blue-200">
                        One-Time Setup • Workplace Privacy
                      </span>
                      <span className="leading-relaxed opacity-90 block mt-0.5 text-[11px]">
                        Used strictly to connect you with carpools and fellow professionals in your office tech park.
                        Never tracked in real time.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-semibold">Workplace / Office Tech Park *</label>
                    <LocationAutocomplete
                      value={officeName}
                      placeholder="Search tech park, business district, or office address..."
                      onChange={(val) => setOfficeName(val)}
                      onSelect={(sel) => {
                        setOfficeName(sel.name);
                        setOfficeLat(sel.lat);
                        setOfficeLng(sel.lng);
                      }}
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-1.5">
                      Or select major tech parks:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {POPULAR_TECH_PARKS.map((park) => (
                        <button
                          key={park.name}
                          type="button"
                          onClick={() => {
                            setOfficeName(park.name);
                            setOfficeLat(park.lat);
                            setOfficeLng(park.lng);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all text-left ${
                            officeName === park.name
                              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                              : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                          }`}
                        >
                          📍 {park.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Notifications */}
              {currentStepId === "notifications" && (
                <div className="flex flex-col gap-3 py-2">
                  <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 flex items-start gap-3">
                    <span className="text-2xl">🎁</span>
                    <div>
                      <span className="font-bold text-xs text-amber-900 dark:text-amber-200 block">
                        Bonus: Earn 5 Free Wallet Credits
                      </span>
                      <span className="text-[11px] text-amber-800 dark:text-amber-300 block mt-0.5 leading-relaxed">
                        Turn on browser notifications to instantly receive 5 credits added to your wallet for starting
                        new chats and carpool matches.
                      </span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] rounded-xl p-3 text-xs flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[var(--color-text)]">
                      <span>☕</span>
                      <span>Instant alerts when a neighbor drops a 15-min Chai or Walk beacon</span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--color-text)]">
                      <span>💬</span>
                      <span>Immediate notifications when someone joins your beacon or sends a message</span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--color-text)]">
                      <span>🎯</span>
                      <span>High-match local job and referral opportunities in your role</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerNotifications}
                    disabled={enablingNotifications}
                    className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md mt-1"
                  >
                    <span>🔔</span>
                    <span>{enablingNotifications ? "Requesting permission..." : "Enable Push Notifications"}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50 flex items-center justify-between">
          {isCompleted ? (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary w-full py-2.5 text-xs font-bold shadow-md"
            >
              Finish & Explore Network 🚀
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSkipStep}
                disabled={saving}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] font-semibold transition-colors px-2 py-1"
              >
                Skip for now
              </button>

              <div className="flex items-center gap-2">
                {currentStepId !== "notifications" && (
                  <button
                    type="button"
                    onClick={handleSaveStep}
                    disabled={saving}
                    className="btn btn-primary btn-sm px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    {saving ? (
                      <>
                        <span className="animate-spin inline-block">⏳</span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>{currentStepIndex === totalSteps - 1 ? "Save & Finish" : "Save & Next"}</span>
                        <span>&rarr;</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
