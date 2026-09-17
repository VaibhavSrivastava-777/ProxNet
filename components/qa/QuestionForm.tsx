"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";
import { CompanyLogo } from "@/components/qa/QuestionList";

interface Props {
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  fixedCompany?: string;
  targetUser?: {
    id: string;
    job_title: string;
    company: string;
  };
  initialMsg?: string;
  onPosted?: () => void;
}

const STARTER_PROMPTS = [
  "👋 Anyone hiring in this cluster?",
  "☕ Quick coffee chat about tech roles",
  "🏢 How's the engineering culture here?",
  "💡 Referral advice for senior roles",
];

const RADIUS_PRESETS = [
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "15 km", value: 15000 },
  { label: "City", value: 50000 },
];

export function QuestionForm({
  defaultLat = 28.6139,
  defaultLng = 77.209,
  defaultRadius = 5000,
  fixedCompany,
  targetUser,
  initialMsg,
  onPosted,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState(initialMsg || "");
  const [companyFilter, setCompanyFilter] = useState(fixedCompany || "");
  const [titleFilter, setTitleFilter] = useState("");
  const [radius, setRadius] = useState(defaultRadius);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [walletWarningSessionId, setWalletWarningSessionId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);
  const [availableTitles, setAvailableTitles] = useState<string[]>([]);
  const [fetchingTitles, setFetchingTitles] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [clusters, setClusters] = useState<any[]>([]);

  const [locationType, setLocationType] = useState<"Home" | "Office" | "Others">("Home");
  const [locationName, setLocationName] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showRadiusSelector, setShowRadiusSelector] = useState(false);
  const [showCompanyFilter, setShowCompanyFilter] = useState(Boolean(fixedCompany));

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    if (locationType === "Home") {
      if (!user.home_lat || !user.home_lng) {
        alert("Please update your Home location in your profile first.");
        router.push("/profile");
        return;
      }
      setLat(user.home_lat.toString());
      setLng(user.home_lng.toString());
    } else if (locationType === "Office") {
      if (!user.office_lat || !user.office_lng) {
        alert("Please update your Office location in your profile first.");
        router.push("/profile");
        return;
      }
      setLat(user.office_lat.toString());
      setLng(user.office_lng.toString());
    }
  }, [locationType, user, router]);

  useEffect(() => {
    if (!fixedCompany && !targetUser) {
      setFetchingCompanies(true);
      if (lat && lng) {
        fetch(`/api/proximity/aggregate?lat=${lat}&lng=${lng}&radius=${radius}`)
          .then((res) => res.json())
          .then((data) => {
            const list = data.clusters?.map((c: any) => c.company).sort() || [];
            setAvailableCompanies(list);
            setClusters(data.clusters || []);
            setCompanyFilter((prev) => (prev && !list.includes(prev) ? "" : prev));
            setFetchingCompanies(false);
          })
          .catch(() => setFetchingCompanies(false));
      } else {
        fetch("/api/companies")
          .then((res) => res.json())
          .then((data) => {
            setAvailableCompanies(data.companies || []);
            setClusters([]);
            setFetchingCompanies(false);
          })
          .catch(() => setFetchingCompanies(false));
      }
    }
  }, [fixedCompany, targetUser, lat, lng, radius]);

  useEffect(() => {
    if (companyFilter && !targetUser) {
      setFetchingTitles(true);
      fetch(`/api/companies/titles?company=${encodeURIComponent(companyFilter)}`)
        .then((res) => res.json())
        .then((data) => {
          setAvailableTitles(data.titles || []);
          setFetchingTitles(false);
        })
        .catch(() => setFetchingTitles(false));
    } else {
      setAvailableTitles([]);
      setTitleFilter("");
    }
  }, [companyFilter, targetUser]);

  // Auto-resize textarea smoothly without forcing huge blank space
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 100), 220);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [body]);

  // Focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || loading) return;

    setLoading(true);
    setMessage("");

    const centerLat = lat ? parseFloat(lat) : defaultLat;
    const centerLng = lng ? parseFloat(lng) : defaultLng;

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionBody: body.trim(),
          companyFilter: targetUser ? null : companyFilter || null,
          titleFilter: targetUser ? null : titleFilter || null,
          targetUserId: targetUser?.id || null,
          centerLat,
          centerLng,
          radiusMeters: radius,
        }),
      });

      setLoading(false);
      if (res.ok) {
        const data = await res.json();
        setBody("");
        setIsSuccess(true);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("proxnet:first-action", { detail: { type: "qa-question" } })
          );
        }

        if (targetUser && data.sessionId) {
          router.push(`/chat/${data.sessionId}`);
          onPosted?.();
          return;
        }

        if (data.targetCount > 0) {
          setMessage(`Message dispatched to ${data.targetCount} peer(s) in range.`);
        } else {
          setMessage(`Message posted to your local forum!`);
        }

        setTimeout(() => {
          onPosted?.();
        }, 800);
      } else {
        setIsSuccess(false);
        try {
          const errData = await res.json();
          setMessage(errData.error || "Failed to post question.");
        } catch (e) {
          setMessage("Failed to post question.");
        }
      }
    } catch (err) {
      setLoading(false);
      setIsSuccess(false);
      setMessage("Connection error. Please try again.");
    }
  }

  if (walletWarningSessionId) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
        <div className="w-12 h-12 rounded-full bg-[var(--color-warning)]/20 flex items-center justify-center mb-3 text-[var(--color-warning)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-base font-bold mb-1 text-[var(--color-text)]">Low Credits</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          Your wallet credit is low. Please recharge your balance to continue sending direct messages.
        </p>
        <button
          onClick={() => {
            router.push(`/chat/${walletWarningSessionId}`);
            onPosted?.();
          }}
          className="btn btn-primary w-full py-2.5 rounded-xl text-sm font-semibold"
        >
          Go to Chat
        </button>
      </div>
    );
  }

  const radiusLabel = radius >= 1000 ? `${(radius / 1000).toFixed(0)} km` : `${radius} m`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col w-full p-4 sm:p-5 bg-[var(--color-surface)]">
      {/* ── 1. Target Recipient / Filter Pill Controls ── */}
      {targetUser ? (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] mb-4">
          <CompanyLogo company={targetUser.company} size={42} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-[var(--color-text)] truncate">{targetUser.job_title}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Private Chat
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] truncate m-0">at {targetUser.company}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-3.5">
          {/* Segmented Location Switcher & Scope Filter Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Location selector segmented pills */}
            <div className="inline-flex items-center bg-[var(--color-surface-secondary)] p-1 rounded-xl border border-[var(--color-border-light)]">
              {(["Home", "Office", "Others"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLocationType(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border-none ${
                    locationType === type
                      ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs"
                      : "bg-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {type === "Home" ? "🏠 Home" : type === "Office" ? "🏢 Office" : "📍 Custom"}
                </button>
              ))}
            </div>

            {/* Quick Action Chips: Radius & Company Target */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowRadiusSelector(!showRadiusSelector)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  showRadiusSelector
                    ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "bg-[var(--color-surface-secondary)] border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                }`}
                title="Change discovery radius"
              >
                <span>📡 {radiusLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCompanyFilter(!showCompanyFilter)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  companyFilter || showCompanyFilter
                    ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "bg-[var(--color-surface-secondary)] border-[var(--color-border-light)] text-[var(--color-text-secondary)]"
                }`}
              >
                <span>🏢 {companyFilter ? companyFilter.slice(0, 14) + (companyFilter.length > 14 ? "…" : "") : "Target Co."}</span>
              </button>
            </div>
          </div>

          {/* Expandable Radius Quick-Pill Bar */}
          {showRadiusSelector && (
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-[var(--color-surface-secondary)]/70 border border-[var(--color-border-light)] animate-fadeIn">
              <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider pl-1 mr-1">Radius:</span>
              <div className="flex items-center gap-1 flex-wrap flex-1">
                {RADIUS_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setRadius(p.value);
                      setShowRadiusSelector(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      radius === p.value
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs"
                        : "bg-[var(--color-surface)] border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Expandable Company & Role Targeting Selectors */}
          {showCompanyFilter && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Company</label>
                {fixedCompany ? (
                  <input
                    className="input w-full text-xs py-1.5 bg-[var(--color-surface)] cursor-not-allowed"
                    value={fixedCompany}
                    readOnly
                  />
                ) : (
                  <select
                    className="input w-full text-xs py-1.5 rounded-lg bg-[var(--color-surface)]"
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    disabled={fetchingCompanies}
                    style={{ color: companyFilter ? "var(--color-text)" : "var(--color-text-tertiary)" }}
                  >
                    <option value="">Any Company</option>
                    {availableCompanies.map((c) => (
                      <option key={c} value={c} style={{ color: "var(--color-text)" }}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Designation / Role</label>
                {companyFilter ? (
                  <select
                    className="input w-full text-xs py-1.5 rounded-lg bg-[var(--color-surface)]"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    disabled={fetchingTitles}
                    style={{ color: titleFilter ? "var(--color-text)" : "var(--color-text-tertiary)" }}
                  >
                    <option value="">Any Designation</option>
                    {availableTitles.map((t) => (
                      <option key={t} value={t} style={{ color: "var(--color-text)" }}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input w-full text-xs py-1.5 rounded-lg bg-[var(--color-surface)] opacity-60 cursor-not-allowed"
                    placeholder="Select company first"
                    value=""
                    disabled
                  />
                )}
              </div>
            </div>
          )}

          {/* Custom Location Autocomplete if 'Others' is picked */}
          {locationType === "Others" && (
            <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-light)] animate-fadeIn">
              <LocationAutocomplete
                value={locationName}
                placeholder="Enter location e.g. Indiranagar, Bangalore"
                onChange={(val) => setLocationName(val)}
                onSelect={({ name, lat, lng }) => {
                  setLocationName(name);
                  setLat(lat.toString());
                  setLng(lng.toString());
                }}
              />
              {lat && lng && (
                <LocationPicker
                  legend="Custom Location Pin"
                  lat={lat}
                  lng={lng}
                  onChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                  radius={radius}
                  clusters={clusters}
                  onCompanyClick={(company) => setCompanyFilter(company)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 2. Native Dynamic Text Compose Area (No big empty void) ── */}
      <div className="relative flex flex-col mb-3">
        <textarea
          ref={textareaRef}
          className="w-full resize-none p-3.5 rounded-2xl bg-[var(--color-surface-secondary)]/50 border border-[var(--color-border-light)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-primary)]/15 text-sm leading-relaxed text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none transition-all shadow-inner"
          placeholder={
            targetUser
              ? `Send a message to ${targetUser.job_title}...`
              : "What would you like to ask nearby professionals?"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={500}
          required
        />
        <div className="flex items-center justify-between px-1 mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
          <span>{500 - body.length} characters left</span>
          {body.length > 0 && (
            <button
              type="button"
              onClick={() => setBody("")}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] text-xs border-none bg-transparent cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Quick Starter Prompt Pills (when body is empty) ── */}
      {!body && (
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5 px-0.5">
            Ideas to ask:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setBody(prompt)}
                className="px-2.5 py-1 rounded-full text-xs bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-all cursor-pointer select-none"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Bottom Send Toolbar ── */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-light)] shrink-0 gap-3">
        <div className="text-xs text-[var(--color-text-tertiary)] truncate">
          {targetUser ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Direct delivery to peer
            </span>
          ) : (
            <span>Broadcasting within <strong>{radiusLabel}</strong></span>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm bg-[var(--color-primary)] text-white hover:opacity-95 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-none shrink-0"
        >
          {loading ? (
            <>
              <span className="spinner-sm" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>{targetUser ? "Send Message" : "Post Question"}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>

      {message && (
        <div
          className={`alert ${isSuccess ? "alert-success" : "alert-error"} mt-3 text-xs p-2.5 rounded-xl animate-fadeIn`}
        >
          {message}
        </div>
      )}
    </form>
  );
}
