"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import type { User, UserVisibility } from "@/lib/types";
import { createBrowserClient } from "@/lib/supabase/client";

/* ----------------------------------------------------------------
   Collapsible Section
   ---------------------------------------------------------------- */
function CollapsibleSection({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(defaultOpen ? "none" : "0px");

  useEffect(() => {
    if (open) {
      const el = contentRef.current;
      if (el) {
        // Temporarily remove max-height limit to measure
        setMaxHeight(`${el.scrollHeight}px`);
        // After transition, set to "none" so inner content can grow freely
        const timer = setTimeout(() => setMaxHeight("none"), 300);
        return () => clearTimeout(timer);
      }
    } else {
      // First set explicit height so browser can transition from it
      const el = contentRef.current;
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`);
        // Force reflow then collapse
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMaxHeight("0px");
          });
        });
      }
    }
  }, [open]);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "18px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text)",
        }}
      >
        <span style={{ display: "flex", color: "var(--color-accent)", fontSize: 20 }}>
          {icon}
        </span>
        <span className="text-h3" style={{ flex: 1, textAlign: "left" }}>
          {title}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{
            transition: `transform var(--transition-normal)`,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--color-text-tertiary)",
          }}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{
          maxHeight,
          overflow: "hidden",
          transition: `max-height var(--transition-normal)`,
        }}
      >
        <div style={{ padding: "0 20px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   SVG icons (inline for zero-dep)
   ---------------------------------------------------------------- */
const PersonIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H3z" />
  </svg>
);

const MapPinIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 2a6 6 0 00-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 00-6-6zm0 8a2 2 0 100-4 2 2 0 000 4z"
      clipRule="evenodd"
    />
  </svg>
);

const ShieldIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 1l7 3v5c0 4.5-3 8.25-7 9.5C6 17.25 3 13.5 3 9V4l7-3zm0 2.18L5 5.54v3.64c0 3.5 2.3 6.58 5 7.72 2.7-1.14 5-4.22 5-7.72V5.54L10 3.18z"
      clipRule="evenodd"
    />
  </svg>
);

const PencilIcon = (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10A2 2 0 015 17H3v-2a2 2 0 01.586-1.414l10-10z" />
  </svg>
);

/* ----------------------------------------------------------------
   Profile Form
   ---------------------------------------------------------------- */
interface Props {
  initialUser: User;
}

export function ProfileForm({ initialUser }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams?.get("onboarding") === "true";
  const [user, setUser] = useState(initialUser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [fetchingHome, setFetchingHome] = useState(false);
  const [fetchingOffice, setFetchingOffice] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const visibility = user.visibility as UserVisibility;

  const showCompany = !initialUser.company?.trim();
  const showJobTitle = !initialUser.job_title?.trim();
  const showLocation = !initialUser.home_lat && !initialUser.office_lat;
  const showResume = !initialUser.resume_url;

  const hasMissingFields = showCompany || showJobTitle || showLocation || showResume;
  const showModal = isOnboarding && hasMissingFields;

  const isCompanyValid = !showCompany || !!user.company?.trim();
  const isJobTitleValid = !showJobTitle || !!user.job_title?.trim();
  const isLocationValid = !showLocation || !!user.home_lat || !!user.office_lat;

  const canSubmit = isCompanyValid && isJobTitleValid && isLocationValid;

  async function handleOnboardingComplete(e: React.MouseEvent) {
    e.preventDefault();
    if (!user.company?.trim() || !user.job_title?.trim()) {
      alert("Company and Job Title are required!");
      return;
    }
    if (!user.home_lat && !user.office_lat) {
      alert("At least one location (Home or Office) must be set to complete onboarding!");
      return;
    }
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: user.full_name,
        company: user.company,
        job_title: user.job_title,
        about: user.about,
        resume_url: user.resume_url,
        resume_text: user.resume_text,
        phone_number: user.phone_number,
        profile_photo_url: user.profile_photo_url,
        linkedin_profile_url: user.linkedin_profile_url,
        home_name: user.home_name,
        home_lat: user.home_lat ? Number(user.home_lat) : null,
        home_lng: user.home_lng ? Number(user.home_lng) : null,
        office_lat: user.office_lat ? Number(user.office_lat) : null,
        office_lng: user.office_lng ? Number(user.office_lng) : null,
        office_name: user.office_name,
        active_location: user.active_location,
        visibility,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setMessage("Profile saved.");
      setEditing(false);
      router.push("/");
    } else {
      setMessage("Failed to save profile.");
    }
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      
      setUser({ 
        ...user, 
        resume_url: data.resume_url, 
        resume_text: data.resume_text,
        about: data.about || user.about
      });
      alert("Resume parsed successfully! We've also auto-generated your About section based on your resume. Don't forget to save your profile below.");
    } catch (error: any) {
      console.error("Resume upload failed", error);
      alert(`Failed to upload and parse resume: ${error?.message || String(error)}`);
    }
    setUploadingResume(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: user.full_name,
        company: user.company,
        job_title: user.job_title,
        about: user.about,
        resume_url: user.resume_url,
        resume_text: user.resume_text,
        phone_number: user.phone_number,
        profile_photo_url: user.profile_photo_url,
        linkedin_profile_url: user.linkedin_profile_url,
        home_name: user.home_name,
        home_lat: user.home_lat ? Number(user.home_lat) : null,
        home_lng: user.home_lng ? Number(user.home_lng) : null,
        office_name: user.office_name,
        office_lat: user.office_lat ? Number(user.office_lat) : null,
        office_lng: user.office_lng ? Number(user.office_lng) : null,
        active_location: user.active_location,
        visibility,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setMessage("Profile saved.");
      setEditing(false);
      router.push("/");
    } else {
      setMessage("Failed to save profile.");
    }
  }

  function toggleVisibility(key: keyof UserVisibility) {
    setUser({
      ...user,
      visibility: { ...visibility, [key]: !visibility[key] },
    });
  }

  const needsCompletion = !user.company || !user.job_title || (!user.home_lat && !user.office_lat);

  const fetchGeocode = async (query: string, isHome: boolean) => {
    if (!query) return;
    if (isHome) setFetchingHome(true);
    else setFetchingOffice(true);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        if (isHome) {
          setUser({ ...user, home_lat: Number(data[0].lat), home_lng: Number(data[0].lon) });
        } else {
          setUser({ ...user, office_lat: Number(data[0].lat), office_lng: Number(data[0].lon) });
        }
      } else {
        alert("Could not find coordinates for this location.");
      }
    } catch (e) {
      alert("Error fetching location data.");
    } finally {
      if (isHome) setFetchingHome(false);
      else setFetchingOffice(false);
    }
  };

  /* Initials helper */
  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const subtitle = [user.job_title, user.company].filter(Boolean).join(" at ");

  return (
    <>
      <form onSubmit={handleSave} className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ---- Completion Warning ---- */}
      {needsCompletion && (
        <div className="alert alert-warning">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.518 11.59c.75 1.333-.213 2.961-1.742 2.961H3.48c-1.529 0-2.492-1.628-1.742-2.961L8.257 3.1zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>Complete your company, job title, and location. Unless location information is provided, you won't appear on the proximity map network!</span>
        </div>
      )}

      {/* ---- Success / Error Messages ---- */}
      {message && (
        <div
          className={`alert ${message === "Profile saved." ? "alert-success" : "alert-error"}`}
        >
          {message === "Profile saved." ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <span>{message}</span>
        </div>
      )}

      {/* ---- Profile Header Card ---- */}
      <div className="card" style={{ overflow: "hidden", position: "relative" }}>
        {/* Banner */}
        <div
          style={{
            height: 80,
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
          }}
        />

        {/* Edit button */}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="btn btn-secondary btn-sm"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          {PencilIcon}
          <span>{editing ? "Cancel" : "Edit Profile"}</span>
        </button>

        {/* Profile info */}
        <div
          style={{
            padding: "0 20px 20px",
            marginTop: -40,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {/* Avatar */}
          <div
            className="avatar avatar-xl"
            style={{
              border: "3px solid var(--color-surface)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {user.profile_photo_url ? (
              <img src={user.profile_photo_url} alt={user.full_name} />
            ) : (
              initials
            )}
          </div>

          <div>
            <h2 className="text-h2">{user.full_name}</h2>
            {subtitle && (
              <p className="text-body-sm" style={{ marginTop: 2 }}>
                {subtitle}
              </p>
            )}
            {user.email && (
              <p className="text-caption" style={{ marginTop: 2 }}>
                {user.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---- Section: Personal Information ---- */}
      <CollapsibleSection icon={PersonIcon} title="Personal Information" defaultOpen>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              value={user.full_name}
              onChange={(e) => setUser({ ...user, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" value={user.email ?? ""} disabled />
          </div>

          <div>
            <label className="label">Company</label>
            <input
              className="input"
              value={user.company ?? ""}
              placeholder="Where do you work?"
              onChange={(e) => setUser({ ...user, company: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Job title</label>
            <input
              className="input"
              value={user.job_title ?? ""}
              placeholder="Your current role"
              onChange={(e) => setUser({ ...user, job_title: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }} className="bg-[var(--color-surface-hover)] p-4 rounded-lg border border-[var(--color-primary-subtle)]">
            <label htmlFor="resume-upload" className="label font-bold text-[var(--color-primary)]">Upload Resume (PDF) for AI Matching</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
              <input
                id="resume-upload"
                type="file"
                accept="application/pdf"
                onChange={handleResumeUpload}
                disabled={uploadingResume}
                className="file-input file-input-primary file-input-bordered w-full max-w-xs shadow-sm"
                title="Upload Resume (PDF)"
                aria-label="Upload Resume (PDF)"
              />
              {uploadingResume && <span className="text-sm text-text-tertiary">Extracting text...</span>}
              {user.resume_url && !uploadingResume && (
                <a href={user.resume_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-medium">
                  View Resume
                </a>
              )}
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              Upload your resume to automatically extract your experience and dramatically improve your AI job matches.
            </p>
          </div>



          <div>
            <label className="label">Phone number</label>
            <input
              className="input"
              type="tel"
              value={user.phone_number ?? ""}
              placeholder="+1 234 567 8900"
              onChange={(e) => setUser({ ...user, phone_number: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Profile photo URL</label>
            <input
              className="input"
              value={user.profile_photo_url ?? ""}
              placeholder="https://..."
              onChange={(e) =>
                setUser({ ...user, profile_photo_url: e.target.value })
              }
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">LinkedIn profile URL</label>
            <input
              className="input"
              value={user.linkedin_profile_url ?? ""}
              placeholder="https://linkedin.com/in/..."
              onChange={(e) =>
                setUser({ ...user, linkedin_profile_url: e.target.value })
              }
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ---- Section: Location Settings ---- */}
      <CollapsibleSection icon={MapPinIcon} title="Location Settings">
        {/* Location mode radio cards */}
        <div style={{ marginBottom: 20 }}>
          <label className="label" style={{ marginBottom: 10 }}>
            Default location mode
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {(["home", "office", "current"] as const).map((loc) => {
              const selected = user.active_location === loc;
              const icons: Record<string, ReactNode> = {
                home: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
                  </svg>
                ),
                office: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                ),
                current: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ),
              };

              return (
                <div
                  key={loc}
                  className={`radio-card ${selected ? "selected" : ""}`}
                  onClick={() => setUser({ ...user, active_location: loc })}
                  style={{
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "14px 8px",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      color: selected
                        ? "var(--color-primary)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {icons[loc]}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: selected
                        ? "var(--color-primary)"
                        : "var(--color-text)",
                    }}
                  >
                    {loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <hr className="divider" style={{ margin: "16px 0" }} />

        {/* Location pickers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Home Name</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="input flex-1"
                  value={user.home_name ?? ""}
                  placeholder="e.g. My Apartment, L&T South City"
                  onChange={(e) => setUser({ ...user, home_name: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  disabled={!user.home_name || fetchingHome}
                  onClick={() => fetchGeocode(user.home_name!, true)}
                >
                  {fetchingHome ? "..." : "Fetch"}
                </button>
              </div>
            </div>
            <LocationPicker
              legend="Home location Pin"
              lat={user.home_lat?.toString() ?? ""}
              lng={user.home_lng?.toString() ?? ""}
              defaultShowMap={false}
              onChange={(home_lat, home_lng) =>
                setUser({
                  ...user,
                  home_lat: home_lat ? Number(home_lat) : null,
                  home_lng: home_lng ? Number(home_lng) : null,
                })
              }
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Office Name</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="input flex-1"
                  value={user.office_name ?? ""}
                  placeholder="e.g. Manyata Tech Park"
                  onChange={(e) => setUser({ ...user, office_name: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  disabled={!user.office_name || fetchingOffice}
                  onClick={() => fetchGeocode(user.office_name!, false)}
                >
                  {fetchingOffice ? "..." : "Fetch"}
                </button>
              </div>
            </div>
            <LocationPicker
              legend="Office location Pin"
              lat={user.office_lat?.toString() ?? ""}
              lng={user.office_lng?.toString() ?? ""}
              defaultShowMap={false}
              onChange={(office_lat, office_lng) =>
                setUser({
                  ...user,
                  office_lat: office_lat ? Number(office_lat) : null,
                  office_lng: office_lng ? Number(office_lng) : null,
                })
              }
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ---- Section: Privacy Settings ---- */}
      <CollapsibleSection icon={ShieldIcon} title="Privacy Settings">
        <p className="text-body-sm" style={{ marginBottom: 16 }}>
          Control what information is visible in anonymized proximity views.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {(
            [
              ["showCompany", "Show company", "Display your company name to nearby professionals"],
              ["showTitle", "Show job title", "Display your job title in search results"],
              ["showPhoto", "Show photo", "Show your profile photo to others"],
            ] as const
          ).map(([key, label, description], idx, arr) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 0",
                borderBottom:
                  idx < arr.length - 1
                    ? "1px solid var(--color-border-light)"
                    : "none",
              }}
            >
              <div>
                <div style={{ fontWeight: 500, color: "var(--color-text)" }}>
                  {label}
                </div>
                <div className="text-caption">{description}</div>
              </div>

              <div
                className={`toggle-track ${visibility[key] ? "active" : ""}`}
                role="switch"
                aria-checked={visibility[key]}
                tabIndex={0}
                onClick={() => toggleVisibility(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleVisibility(key);
                  }
                }}
              >
                <div className="toggle-thumb" />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ---- Notification Settings ---- */}
      <CollapsibleSection
        title="Notification Settings"
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 14.79 18 13.42 18 12V8a6 6 0 10-12 0v4c0 1.42-.21 2.79-.595 3.595L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
          </svg>
        }
        defaultOpen={false}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="text-body-sm font-semibold">Web Push Notifications</span>
              <span className="text-caption text-[var(--color-text-secondary)]">
                Receive notifications for local matches and Q&A answers on this device.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={async () => {
                try {
                  const permission = await Notification.requestPermission();
                  if (permission !== "granted") {
                    alert("Notification permission denied. Please enable them in your device settings.");
                    return;
                  }
                  const registration = await navigator.serviceWorker.ready;
                  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                  if (!vapidKey) return;
                  
                  // Base64 to Uint8Array converter
                  const padding = "=".repeat((4 - vapidKey.length % 4) % 4);
                  const base64 = (vapidKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
                  const rawData = window.atob(base64);
                  const outputArray = new Uint8Array(rawData.length);
                  for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                  }

                  const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: outputArray,
                  });

                  await fetch("/api/profile/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ subscription }),
                  });
                  alert("Successfully subscribed to notifications on this device!");
                } catch (error) {
                  console.error("Subscription failed:", error);
                  alert("Failed to subscribe. Are you in a supported browser?");
                }
              }}
            >
              Enable on this device
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* ---- Save Button ---- */}
      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary btn-lg"
        style={{ width: "100%" }}
      >
        {saving ? (
          <>
            <span className="spinner spinner-sm" style={{ borderTopColor: "var(--color-text-inverse)" }} />
            Saving…
          </>
        ) : (
          "Save profile"
        )}
      </button>
      </form>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleIn flex flex-col p-6 text-[var(--color-text)]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📍</span>
                <div>
                  <h3 className="text-h2 font-bold text-[var(--color-primary)]">Complete Your Profile</h3>
                  <p className="text-caption mt-0.5">Please provide the missing details below to unlock all features.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-[var(--color-surface-secondary)] p-4 rounded-xl border border-[var(--color-border-light)] mb-5">
              <div className="avatar avatar-md shrink-0">
                {user.profile_photo_url ? (
                  <img src={user.profile_photo_url} alt={user.full_name} className="rounded-full w-12 h-12 object-cover" />
                ) : (
                  <div className="bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-lg flex items-center justify-center w-12 h-12 rounded-full">
                    {initials}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-sm">{user.full_name}</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">{user.email}</p>
                <span className="inline-block bg-[var(--color-success-bg)] text-[var(--color-success)] text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-wider">
                  LinkedIn Connected
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-1">
              
              {/* Professional Details Section (if company or designation is missing) */}
              {(showCompany || showJobTitle) && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-4">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    💼 Professional Details
                  </h4>
                  {showCompany && (
                    <div>
                      <label className="label font-semibold text-xs mb-1">Company Name <span className="text-red-500">*</span></label>
                      <input
                        className="input w-full"
                        value={user.company ?? ""}
                        placeholder="e.g. Google, Microsoft, Lenovo"
                        required
                        onChange={(e) => setUser({ ...user, company: e.target.value })}
                      />
                    </div>
                  )}
                  {showJobTitle && (
                    <div>
                      <label className="label font-semibold text-xs mb-1">Job Title / Designation <span className="text-red-500">*</span></label>
                      <input
                        className="input w-full"
                        value={user.job_title ?? ""}
                        placeholder="e.g. Senior Software Engineer"
                        required
                        onChange={(e) => setUser({ ...user, job_title: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Location Settings Section (if both home and office are missing) */}
              {showLocation && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-4">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    📍 Location Settings
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Provide at least one location (Home or Office) to appear on the local proximity map. <span className="text-red-500">*</span>
                  </p>
                  
                  {/* Home Location */}
                  <div className="border border-[var(--color-border-light)]/60 rounded-lg p-3 flex flex-col gap-3">
                    <h5 className="font-semibold text-xs text-[var(--color-primary)] flex items-center gap-1">
                      🏠 Home Location
                    </h5>
                    <div>
                      <label className="label text-[11px] mb-1">Area / Apartment Complex Name</label>
                      <div className="flex gap-2">
                        <input
                          className="input flex-1 text-sm py-1.5"
                          value={user.home_name ?? ""}
                          placeholder="e.g. L&T South City"
                          onChange={(e) => setUser({ ...user, home_name: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary shrink-0 text-xs px-3 py-1.5"
                          disabled={!user.home_name || fetchingHome}
                          onClick={() => fetchGeocode(user.home_name!, true)}
                        >
                          {fetchingHome ? "..." : "Fetch"}
                        </button>
                      </div>
                    </div>
                    <LocationPicker
                      legend="Pin Home Position"
                      lat={user.home_lat?.toString() ?? ""}
                      lng={user.home_lng?.toString() ?? ""}
                      defaultShowMap={false}
                      onChange={(home_lat, home_lng) =>
                        setUser({
                          ...user,
                          home_lat: home_lat ? Number(home_lat) : null,
                          home_lng: home_lng ? Number(home_lng) : null,
                        })
                      }
                    />
                    {user.home_lat && (
                      <span className="text-[11px] text-[var(--color-success)] font-medium flex items-center gap-1">
                        ✓ Home Coordinates Set ({user.home_lat.toFixed(4)}, {user.home_lng?.toFixed(4)})
                      </span>
                    )}
                  </div>

                  {/* Office Location */}
                  <div className="border border-[var(--color-border-light)]/60 rounded-lg p-3 flex flex-col gap-3">
                    <h5 className="font-semibold text-xs text-[var(--color-accent)] flex items-center gap-1">
                      🏢 Office Location
                    </h5>
                    <div>
                      <label className="label text-[11px] mb-1">Office Building / Business Park</label>
                      <div className="flex gap-2">
                        <input
                          className="input flex-1 text-sm py-1.5"
                          value={user.office_name ?? ""}
                          placeholder="e.g. Manyata Tech Park"
                          onChange={(e) => setUser({ ...user, office_name: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary shrink-0 text-xs px-3 py-1.5"
                          disabled={!user.office_name || fetchingOffice}
                          onClick={() => fetchGeocode(user.office_name!, false)}
                        >
                          {fetchingOffice ? "..." : "Fetch"}
                        </button>
                      </div>
                    </div>
                    <LocationPicker
                      legend="Pin Office Position"
                      lat={user.office_lat?.toString() ?? ""}
                      lng={user.office_lng?.toString() ?? ""}
                      defaultShowMap={false}
                      onChange={(office_lat, office_lng) =>
                        setUser({
                          ...user,
                          office_lat: office_lat ? Number(office_lat) : null,
                          office_lng: office_lng ? Number(office_lng) : null,
                        })
                      }
                    />
                    {user.office_lat && (
                      <span className="text-[11px] text-[var(--color-success)] font-medium flex items-center gap-1">
                        ✓ Office Coordinates Set ({user.office_lat.toFixed(4)}, {user.office_lng?.toFixed(4)})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Resume Upload Section (if resume is missing) */}
              {showResume && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    📄 Resume Upload
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Upload your resume (PDF) to auto-fill your profile and dramatically improve your AI job matches.
                  </p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-1 bg-[var(--color-surface-hover)] p-3 rounded-lg border border-[var(--color-primary-subtle)]">
                    <input
                      id="onboarding-resume-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={handleResumeUpload}
                      disabled={uploadingResume}
                      className="file-input file-input-primary file-input-bordered file-input-sm w-full max-w-xs shadow-sm text-xs"
                      title="Upload Resume (PDF)"
                      aria-label="Upload Resume (PDF)"
                    />
                    {uploadingResume && <span className="text-xs text-text-tertiary">Extracting text...</span>}
                    {user.resume_url && !uploadingResume && (
                      <span className="text-[var(--color-success)] text-xs font-semibold flex items-center gap-1">
                        ✓ Uploaded successfully!
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t border-[var(--color-border-light)]">
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={saving || !canSubmit}
                onClick={handleOnboardingComplete}
              >
                {saving ? "Completing..." : "Complete & Save Profile ✓"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
