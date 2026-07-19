"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";
import type { User, UserVisibility } from "@/lib/types";
import { createBrowserClient } from "@/lib/supabase/client";
import { isProfileIncomplete } from "@/lib/profile-validation";
import { calculateTier } from "@/lib/network-score";

/* ----------------------------------------------------------------
   Collapsible Section
   ---------------------------------------------------------------- */
function CollapsibleSection({
  icon,
  title,
  defaultOpen = false,
  children,
  id,
}: {
  icon: ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  id?: string;
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
    <div className="card" id={id} style={{ overflow: "hidden" }}>
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

  const [showErrors, setShowErrors] = useState(false);
  const [followStats, setFollowStats] = useState({ followerCount: 0, followingCount: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetchingLinkedInDetails, setFetchingLinkedInDetails] = useState(false);
  const [fetchingGeoAddress, setFetchingGeoAddress] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showName = !initialUser.full_name?.trim();
  const showEmail = !initialUser.email?.trim();
  const showCompany = !initialUser.company?.trim();
  const showJobTitle = !initialUser.job_title?.trim();
  const showPhoto = !initialUser.profile_photo_url?.trim();
  const showLinkedIn = !initialUser.linkedin_profile_url?.trim();
  const showHomeLocation = initialUser.home_lat == null || initialUser.home_lng == null;

  const hasMissingFields =
    showName ||
    showEmail ||
    showCompany ||
    showJobTitle ||
    showPhoto ||
    showLinkedIn ||
    showHomeLocation;
  const showModal = hasMissingFields;

  useEffect(() => {
    // If onboarding modal is shown and home location is not set, request coordinates & format name
    if (showModal && user.home_lat == null && user.home_lng == null) {
      if (navigator.geolocation) {
        setFetchingGeoAddress(true);
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            setUser((prev) => ({
              ...prev,
              home_lat: lat,
              home_lng: lng,
            }));

            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (apiKey) {
              try {
                const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.results && data.results.length > 0) {
                    const formatted = data.results[0].formatted_address;
                    setUser((prev) => ({
                      ...prev,
                      home_name: formatted,
                    }));
                  }
                }
              } catch (err) {
                console.error("Google reverse geocode failed:", err);
              } finally {
                setFetchingGeoAddress(false);
              }
            } else {
              setFetchingGeoAddress(false);
            }
          },
          (err) => {
            console.warn("Geolocation request failed or denied:", err);
            setFetchingGeoAddress(false);
          }
        );
      }
    }
  }, [showModal]);

  const handleLinkedInBlur = async (url: string) => {
    if (!url || !url.includes("linkedin.com")) return;
    setFetchingLinkedInDetails(true);
    setToast(null);
    try {
      const res = await fetch(`/api/profile/parse-linkedin?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const { full_name, company, job_title, professional_bio } = result.data;
          const hasData = full_name || company || job_title || professional_bio;
          if (hasData) {
            setUser((prev) => ({
              ...prev,
              full_name: prev.full_name || full_name || "",
              company: prev.company || company || "",
              job_title: prev.job_title || job_title || "",
              professional_bio: prev.professional_bio || professional_bio || "",
            }));
            setToast({
              message: "Successfully imported profile details from LinkedIn.",
              type: "success",
            });
          } else {
            setToast({
              message: "Unable to pull details programmatically. Please provide the details manually.",
              type: "error",
            });
          }
        } else {
          setToast({
            message: "Unable to pull details programmatically. Please provide the details manually.",
            type: "error",
          });
        }
      } else {
        setToast({
          message: "Unable to pull details programmatically. Please provide the details manually.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Failed to parse LinkedIn URL:", err);
      setToast({
        message: "Unable to pull details programmatically. Please provide the details manually.",
        type: "error",
      });
    } finally {
      setFetchingLinkedInDetails(false);
    }
  };

  useEffect(() => {
    fetch("/api/follow")
      .then((r) => r.json())
      .then((data) => {
        if (data.followerCount !== undefined) {
          setFollowStats({
            followerCount: data.followerCount,
            followingCount: data.followingCount,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleShareInvite = () => {
    const inviteLink = `${window.location.origin}/join/${user.invite_code || ""}`;
    if (navigator.share) {
      navigator.share({
        title: "Join me on ProxNet",
        text: "Connect with professional neighbors near you on ProxNet!",
        url: inviteLink,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(inviteLink);
      alert("Invite link copied to clipboard: " + inviteLink);
    }
  };

  const visibility = user.visibility as UserVisibility;

  const [aliasError, setAliasError] = useState("");
  const [checkingAlias, setCheckingAlias] = useState(false);

  useEffect(() => {
    const nameToCheck = user.anonymous_name?.trim();
    if (!nameToCheck || nameToCheck === initialUser.anonymous_name?.trim()) {
      setAliasError("");
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingAlias(true);
      try {
        const res = await fetch(`/api/profile/validate-alias?q=${encodeURIComponent(nameToCheck)}`);
        if (res.ok) {
          const data = await res.json();
          if (!data.available) {
            setAliasError("This anonymous name is already taken. Please choose another one.");
          } else {
            setAliasError("");
          }
        } else {
          setAliasError("");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingAlias(false);
      }
    }, 500);

  }, [user.anonymous_name, user.id, initialUser.anonymous_name]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#notifications") {
      const element = document.getElementById("notification-settings");
      if (element) {
        // Delay slightly to ensure browser has completed initial layout/rendering
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []);



  const isNameValid = !!user.full_name?.trim();
  const isEmailValid = !!user.email?.trim();
  const isCompanyValid = !!user.company?.trim();
  const isJobTitleValid = !!user.job_title?.trim();
  const isPhotoValid = !!user.profile_photo_url?.trim();
  const isLinkedInValid = !!user.linkedin_profile_url?.trim();
  const isHomeLocationValid = user.home_lat != null && user.home_lng != null;

  const missingFields: string[] = [];
  if (!isNameValid) missingFields.push("Full Name");
  if (!isEmailValid) missingFields.push("Email Address");
  if (!isCompanyValid) missingFields.push("Company");
  if (!isJobTitleValid) missingFields.push("Designation");
  if (!isHomeLocationValid) missingFields.push("Home Location");
  if (!isLinkedInValid) missingFields.push("LinkedIn Link");
  if (!isPhotoValid) missingFields.push("Avatar Photo");

  const canSubmit =
    isNameValid &&
    isEmailValid &&
    isCompanyValid &&
    isJobTitleValid &&
    isPhotoValid &&
    isLinkedInValid &&
    isHomeLocationValid &&
    !aliasError;

  async function handleOnboardingComplete(e: React.MouseEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setShowErrors(true);
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
        professional_bio: user.professional_bio,
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
        anonymous_name: user.anonymous_name,
        tags: user.tags || [],
        active_location: "home",
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
      const errData = await res.json().catch(() => ({}));
      setMessage(errData.error || "Failed to save profile.");
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
      setUser((prev) => ({ 
        ...prev, 
        resume_url: data.resume_url, 
        resume_text: data.resume_text,
        about: data.about || prev.about,
        company: prev.company?.trim() ? prev.company : (data.company || prev.company),
        job_title: prev.job_title?.trim() ? prev.job_title : (data.job_title || prev.job_title),
        phone_number: prev.phone_number?.trim() ? prev.phone_number : (data.phone_number || prev.phone_number)
      }));
      alert("Resume parsed successfully! We've auto-generated your About section and prefilled your Company, Job Title, and Phone Number from your resume where missing. Don't forget to save your profile below.");
    } catch (error: any) {
      console.error("Resume upload failed", error);
      alert(`Failed to upload and parse resume: ${error?.message || String(error)}`);
    }
    setUploadingResume(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setShowErrors(true);
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
        professional_bio: user.professional_bio,
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
        anonymous_name: user.anonymous_name,
        tags: user.tags || [],
        active_location: "home",
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
      const errData = await res.json().catch(() => ({}));
      setMessage(errData.error || "Failed to save profile.");
    }
  }

  function toggleVisibility(key: keyof UserVisibility) {
    setUser({
      ...user,
      visibility: { ...visibility, [key]: !visibility[key] },
    });
  }

  const needsCompletion = isProfileIncomplete(user);

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
          <span>Complete your profile details. All 9 fields (Name, Email, Company, Job Title, Resume, Photo, LinkedIn, Home and Office locations) are required.</span>
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

      {/* Network Stats & Grow Nudge */}
      <div className="flex flex-col gap-3 mb-6 animate-fadeInUp">
        {/* Follow Stats Grid */}
        <div className="card p-4 bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-xl shadow-sm flex items-center justify-around text-center divide-x divide-[var(--color-border-light)]" style={{ display: "flex", flexDirection: "row" }}>
          <div className="flex-1">
            <div className="text-xl font-extrabold text-[var(--color-primary)]">{followStats.followingCount}</div>
            <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mt-0.5">Following</div>
          </div>
          <div className="flex-grow flex-shrink flex-basis-0">
            <div className="text-xl font-extrabold text-[var(--color-primary)]">{followStats.followerCount}</div>
            <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mt-0.5">Followers</div>
          </div>
        </div>

        {/* Grow Nudge Card */}
        <div className="card p-4 bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20 rounded-xl shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2" style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>🌱</span>
            <span className="text-sm font-bold text-[var(--color-text)]">Grow your professional neighborhood</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Invite colleagues and neighbors to join ProxNet to unlock more job referrals, carpools, and discussions near you!
          </p>
          <button
            type="button"
            onClick={handleShareInvite}
            className="btn btn-sm btn-primary self-start mt-1 flex items-center gap-1.5 cursor-pointer border-none"
            style={{ fontSize: 11, padding: "6px 14px", display: "inline-flex", alignItems: "center", width: "fit-content" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share Invite Link
          </button>
        </div>
      </div>

      {/* Complete Profile Amber Zone Banner */}
      {missingFields.length > 0 && (
        <div className="card p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-[var(--color-text)] flex flex-col gap-3 shadow-sm animate-fadeIn mb-6" style={{ display: "flex", flexDirection: "column" }}>
          <div className="flex items-center gap-2" style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Amber Zone: Complete Your Profile</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Your profile is partially complete. To unlock all Proximity matching benefits, please fill in the following:
          </p>
          <div className="flex flex-wrap gap-2 mt-1" style={{ display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
            {missingFields.map((field) => (
              <span 
                key={field} 
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- Section: Personal Information ---- */}
      <CollapsibleSection icon={PersonIcon} title="Personal Information" defaultOpen>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label flex items-center justify-between">
              <span>LinkedIn profile URL <span className="text-red-500">*</span></span>
              {fetchingLinkedInDetails && <span className="text-xs text-[var(--color-primary)] animate-pulse">Parsing URL details...</span>}
            </label>
            <input
              className="input"
              style={showErrors && !user.linkedin_profile_url?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
              value={user.linkedin_profile_url ?? ""}
              placeholder="https://linkedin.com/in/..."
              onChange={(e) =>
                setUser({ ...user, linkedin_profile_url: e.target.value })
              }
              onBlur={() => handleLinkedInBlur(user.linkedin_profile_url ?? "")}
            />
            {showErrors && !user.linkedin_profile_url?.trim() && (
              <p className="text-xs text-red-500 mt-1">LinkedIn profile URL is required</p>
            )}
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Profile photo URL <span className="text-red-500">*</span></label>
            <input
              className="input"
              style={showErrors && !user.profile_photo_url?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
              value={user.profile_photo_url ?? ""}
              placeholder="https://..."
              onChange={(e) =>
                setUser({ ...user, profile_photo_url: e.target.value })
              }
            />
            {showErrors && !user.profile_photo_url?.trim() && (
              <p className="text-xs text-red-500 mt-1">Profile photo URL is required</p>
            )}
          </div>

          <div>
            <label className="label">Full name <span className="text-red-500">*</span></label>
            <input
              className="input"
              style={showErrors && !user.full_name?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
              value={user.full_name}
              onChange={(e) => setUser({ ...user, full_name: e.target.value })}
            />
            {showErrors && !user.full_name?.trim() && (
              <p className="text-xs text-red-500 mt-1">Full name is required</p>
            )}
          </div>

          <div>
            <label className="label">Email</label>
            <input className="input" value={user.email ?? ""} disabled />
          </div>

          <div>
            <label className="label">Anonymous Alias Name</label>
            <input
              className="input"
              style={aliasError ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
              value={user.anonymous_name || ""}
              placeholder="e.g. Neighbour-1234"
              onChange={(e) => setUser({ ...user, anonymous_name: e.target.value })}
            />
            {checkingAlias && <p className="text-[10px] text-gray-500 mt-1">Checking availability...</p>}
            {aliasError && <p className="text-xs text-red-500 mt-1">{aliasError}</p>}
            {!aliasError && user.anonymous_name?.trim() && user.anonymous_name?.trim() !== initialUser.anonymous_name?.trim() && !checkingAlias && (
              <p className="text-xs text-green-500 mt-1">✓ Anonymous name is available</p>
            )}
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              Used anonymously on the local forum feed to protect your privacy.
            </p>
          </div>

          <div>
            <label className="label">Company <span className="text-red-500">*</span></label>
            <input
              className="input"
              style={showErrors && !user.company?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
              value={user.company ?? ""}
              placeholder="Where do you work?"
              onChange={(e) => setUser({ ...user, company: e.target.value })}
            />
            {showErrors && !user.company?.trim() && (
              <p className="text-xs text-red-500 mt-1">Company name is required</p>
            )}
          </div>

          <div>
            <label className="label">Job title <span className="text-red-500">*</span></label>
            <input
              className="input"
              style={showErrors && !user.job_title?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
              value={user.job_title ?? ""}
              placeholder="Your current role"
              onChange={(e) => setUser({ ...user, job_title: e.target.value })}
            />
            {showErrors && !user.job_title?.trim() && (
              <p className="text-xs text-red-500 mt-1">Job title is required</p>
            )}
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Tags</label>
            <div className="flex flex-col gap-2">
              <input
                className="input"
                value={tagInput}
                placeholder="e.g. IIM Lucknow (Press Enter to add)"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const val = tagInput.trim().replace(/^,|,$/g, "");
                    if (val && !(user.tags || []).includes(val)) {
                      setUser({ ...user, tags: [...(user.tags || []), val] });
                    }
                    setTagInput("");
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                {(user.tags || []).map((t) => (
                  <span key={t} className="badge badge-primary flex items-center gap-1" style={{ padding: "4px 8px" }}>
                    {t}
                    <button
                      type="button"
                      onClick={() => setUser({ ...user, tags: user.tags.filter(tag => tag !== t) })}
                      className="border-none bg-transparent text-white cursor-pointer hover:opacity-80"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              Add tags to help others find you in their neighborhood searches.
            </p>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Professional Bio</label>
            <textarea
              className="input"
              value={user.professional_bio ?? ""}
              placeholder="Tell us a little about your professional background and interests..."
              onChange={(e) => setUser({ ...user, professional_bio: e.target.value })}
              rows={4}
              style={{ resize: "vertical", height: "auto" }}
            />
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              Your API-generated professional bio. Edit as you see fit.
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

          <div style={{ gridColumn: "1 / -1" }} className="bg-[var(--color-surface-hover)] p-4 rounded-lg border border-[var(--color-primary-subtle)]">
            <label htmlFor="resume-upload" className="label font-bold text-[var(--color-primary)]">Upload Resume (PDF) for AI Matching (Optional)</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
              <input
                id="resume-upload"
                type="file"
                accept="application/pdf"
                onChange={handleResumeUpload}
                disabled={uploadingResume}
                className="file-input file-input-primary file-input-bordered w-full max-w-xs shadow-sm text-xs"
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
        </div>
      </CollapsibleSection>

      {/* ---- Section: Location Settings ---- */}
      <CollapsibleSection icon={MapPinIcon} title="Location Settings">

        {/* Location pickers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Home Name</label>
              <LocationAutocomplete
                value={user.home_name ?? ""}
                style={showErrors && !user.home_name?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                placeholder="e.g. My Apartment, L&T South City"
                onChange={(val) => setUser({ ...user, home_name: val })}
                onSelect={({ name, lat, lng }) =>
                  setUser({
                    ...user,
                    home_name: name,
                    home_lat: lat,
                    home_lng: lng,
                  })
                }
              />
              {showErrors && !user.home_name?.trim() && (
                <p className="text-xs text-red-500 mt-1">Home location name is required</p>
              )}
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
            {showErrors && (user.home_lat == null || user.home_lng == null) && (
              <p className="text-xs text-red-500 mt-1">Please select and place a pin for your Home location</p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">Office Name (Optional)</label>
              <LocationAutocomplete
                value={user.office_name ?? ""}
                placeholder="e.g. Manyata Tech Park"
                onChange={(val) => setUser({ ...user, office_name: val })}
                onSelect={({ name, lat, lng }) =>
                  setUser({
                    ...user,
                    office_name: name,
                    office_lat: lat,
                    office_lng: lng,
                  })
                }
              />
            </div>
            <LocationPicker
              legend="Office location Pin (Optional)"
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

      {/* ---- Section: Network Builder ---- */}
      <CollapsibleSection
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0Zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0Zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0Z" />
          </svg>
        }
        title="Network Builder Status"
        defaultOpen={false}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>{calculateTier(user.network_points || 0).badge}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: "var(--color-text)" }}>
                {calculateTier(user.network_points || 0).name} Tier
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                You have accumulated <strong>{user.network_points || 0}</strong> network points.
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              background: "var(--color-surface-secondary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-light)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Your Permanent Invite Code:</div>
            <div className="flex items-center gap-2">
              <span className="badge badge-primary" style={{ fontSize: 14, fontFamily: "monospace", padding: "6px 12px" }}>
                {user.invite_code || "Generating..."}
              </span>
              <button
                type="button"
                className="text-primary hover:underline text-body-sm font-semibold bg-transparent border-0 cursor-pointer"
                style={{ padding: 0 }}
                onClick={() => router.push("/grow")}
              >
                Go to Grow Dashboard &rarr;
              </button>
            </div>
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
        id="notification-settings"
        title="Notification Settings"
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 14.79 18 13.42 18 12V8a6 6 0 10-12 0v4c0 1.42-.21 2.79-.595 3.595L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
          </svg>
        }
        defaultOpen={typeof window !== "undefined" && window.location.hash === "#notifications"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="text-body-sm font-semibold">Push Notifications</span>
              <span className="text-caption text-[var(--color-text-secondary)]">
                Receive notifications for local matches and chat answers on this device.
              </span>
            </div>
            {(() => {
              const isAndroidApp = typeof window !== "undefined" && !!(window as any).AndroidBridge;
              const isNotificationSupported = typeof window !== "undefined" && "Notification" in window;

              if (isAndroidApp) {
                return (
                  <span className="text-xs text-green-500 font-semibold flex items-center gap-1">
                    ✓ Enabled natively on Android
                  </span>
                );
              }

              if (!isNotificationSupported) {
                return (
                  <span className="text-xs text-gray-400 font-medium">
                    Unsupported browser/webview
                  </span>
                );
              }

              return (
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
                      const fcmVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                      const { getMessaging, getToken, getFcmRegistration, isFirebaseConfigured } = await import("@/lib/firebase-client");
                      
                      if (!isFirebaseConfigured) {
                        alert("Push notifications are not fully configured (missing App ID or Project ID). Please set the Firebase environment variables.");
                        return;
                      }

                      if (!fcmVapidKey) {
                        alert("Push notification key is not set. Please try again later.");
                        return;
                      }

                      const messaging = getMessaging();
                      const registration = await getFcmRegistration();
                      if (!registration) {
                        throw new Error("Could not find FCM service worker registration.");
                      }
                      
                      const token = await getToken(messaging, {
                        vapidKey: fcmVapidKey,
                        serviceWorkerRegistration: registration
                      });

                      if (token) {
                        await fetch("/api/fcm/register", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ token, platform: "web" }),
                        });
                        alert("Successfully subscribed to notifications on this device!");
                      } else {
                        throw new Error("No registration token received");
                      }
                    } catch (error: any) {
                      console.error("Subscription failed:", error);
                      const isConfigMissing = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
                      if (isConfigMissing) {
                        alert("Firebase config keys are missing in your local .env.local file. Please configure NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, etc. to enable push notifications.");
                      } else {
                        alert(`Failed to subscribe: ${error.message || "Are you in a supported browser?"}`);
                      }
                    }
                  }}
                >
                  Enable on this device
                </button>
              );
            })()}
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

      {/* Danger Zone: Account Deletion */}
      <div className="mt-8 border-t border-[var(--color-border-light)] pt-6">
        <h3 className="text-body font-bold text-red-500 mb-2">Danger Zone</h3>
        <p className="text-caption text-[var(--color-text-secondary)] mb-4">
          Permanently remove your account and purge all associated data from ProxNet.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="btn btn-outline btn-sm text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white"
          style={{ cursor: "pointer" }}
        >
          Remove me from ProxNet
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-md w-full p-6 text-[var(--color-text)] animate-scaleIn flex flex-col gap-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
                ⚠️
              </div>
              <h3 className="text-h2 font-bold text-[var(--color-text)] m-0">Are you absolutely sure?</h3>
              <p className="text-body-sm text-[var(--color-text-secondary)] mt-2 m-0">
                Removing your account is permanent. If you delete your profile today, you will lose:
              </p>
            </div>

            <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-2.5 text-xs text-[var(--color-text-secondary)]">
              <div className="flex gap-2.5 items-start">
                <span className="text-sm shrink-0">💎</span>
                <p className="m-0 leading-normal">
                  <strong>All referral reward points:</strong> You will lose your invite progress, points balances, and status in the local network forever.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="text-sm shrink-0">🤝</span>
                <p className="m-0 leading-normal">
                  <strong>Your followers and connections:</strong> The {followStats.followerCount} professional neighbors following your posts will no longer see your feed updates.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="text-sm shrink-0">💬</span>
                <p className="m-0 leading-normal">
                  <strong>Chat thread history:</strong> All ongoing direct messaging threads, questions, and replies will be permanently deleted.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="text-sm shrink-0">📍</span>
                <p className="m-0 leading-normal">
                  <strong>Local Forum contributions:</strong> Your neighborhood presence and forum interactions will be completely wiped out.
                </p>
              </div>
            </div>

            <p className="text-caption text-red-500/80 font-medium text-center m-0">
              There is no way to undo this action.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
              >
                Keep my account
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch("/api/profile/delete", { method: "POST" });
                    if (res.ok) {
                      const { signOut } = await import("next-auth/react");
                      await signOut({ callbackUrl: "/" });
                    } else {
                      const data = await res.json();
                      alert(`Failed to delete account: ${data.error || "unknown error"}`);
                      setDeleting(false);
                    }
                  } catch (e) {
                    alert("An error occurred. Please try again.");
                    setDeleting(false);
                  }
                }}
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-red-600 text-white border-0 hover:bg-red-700 cursor-pointer flex items-center justify-center gap-1.5"
                style={{ backgroundColor: "#dc2626" }}
              >
                {deleting ? "Removing..." : "Yes, remove me"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-scaleIn flex flex-col p-6 text-[var(--color-text)]">
            
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
                {(() => {
                  const isGoogle = user.linkedin_sub ? /^\d+$/.test(user.linkedin_sub) : false;
                  return (
                    <span className="inline-block bg-[var(--color-success-bg)] text-[var(--color-success)] text-[10px] font-bold px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-wider">
                      {isGoogle ? "Google Connected" : "LinkedIn Connected"}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-1">
              
              {/* Profile & Links Section (if photo or linkedin is missing) */}
              {(showPhoto || showLinkedIn) && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-4">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    🔗 Profile & Links
                  </h4>
                  {showLinkedIn && (
                    <div>
                      <label className="label font-semibold text-xs mb-1 flex items-center justify-between">
                        <span>LinkedIn Profile URL <span className="text-red-500">*</span></span>
                        {fetchingLinkedInDetails && <span className="text-[10px] text-[var(--color-primary)] animate-pulse">Parsing URL details...</span>}
                      </label>
                      <input
                        className="input w-full"
                        style={showErrors && !user.linkedin_profile_url?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                        value={user.linkedin_profile_url ?? ""}
                        placeholder="https://linkedin.com/in/username"
                        required
                        onChange={(e) => setUser({ ...user, linkedin_profile_url: e.target.value })}
                        onBlur={() => handleLinkedInBlur(user.linkedin_profile_url ?? "")}
                      />
                      {showErrors && !user.linkedin_profile_url?.trim() && (
                        <p className="text-xs text-red-500 mt-1">LinkedIn profile URL is required</p>
                      )}
                    </div>
                  )}
                  {showPhoto && (
                    <div>
                      <label className="label font-semibold text-xs mb-1">Profile Photo URL <span className="text-red-500">*</span></label>
                      <input
                        className="input w-full"
                        style={showErrors && !user.profile_photo_url?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                        value={user.profile_photo_url ?? ""}
                        placeholder="https://example.com/photo.jpg"
                        required
                        onChange={(e) => setUser({ ...user, profile_photo_url: e.target.value })}
                      />
                      {showErrors && !user.profile_photo_url?.trim() && (
                        <p className="text-xs text-red-500 mt-1">Profile photo URL is required</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Professional & Personal Details Section (if name, company or designation is missing) */}
              {(showName || showCompany || showJobTitle) && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-4">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    💼 Personal & Professional Details
                  </h4>
                  {showName && (
                    <div>
                      <label className="label font-semibold text-xs mb-1">Full Name <span className="text-red-500">*</span></label>
                      <input
                        className="input w-full"
                        style={showErrors && !user.full_name?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                        value={user.full_name ?? ""}
                        placeholder="e.g. John Doe"
                        required
                        onChange={(e) => setUser({ ...user, full_name: e.target.value })}
                      />
                      {showErrors && !user.full_name?.trim() && (
                        <p className="text-xs text-red-500 mt-1">Full name is required</p>
                      )}
                    </div>
                  )}
                  {showCompany && (
                    <div>
                      <label className="label font-semibold text-xs mb-1">Company Name <span className="text-red-500">*</span></label>
                      <input
                        className="input w-full"
                        style={showErrors && !user.company?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                        value={user.company ?? ""}
                        placeholder="e.g. Google, Microsoft, Lenovo"
                        required
                        onChange={(e) => setUser({ ...user, company: e.target.value })}
                      />
                      {showErrors && !user.company?.trim() && (
                        <p className="text-xs text-red-500 mt-1">Company name is required</p>
                      )}
                    </div>
                  )}
                  {showJobTitle && (
                    <div>
                      <label className="label font-semibold text-xs mb-1">Job Title / Designation <span className="text-red-500">*</span></label>
                      <input
                        className="input w-full"
                        style={showErrors && !user.job_title?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                        value={user.job_title ?? ""}
                        placeholder="e.g. Senior Software Engineer"
                        required
                        onChange={(e) => setUser({ ...user, job_title: e.target.value })}
                      />
                      {showErrors && !user.job_title?.trim() && (
                        <p className="text-xs text-red-500 mt-1">Job title is required</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Location Settings Section (if home location is missing) */}
              {showHomeLocation && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-4">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    📍 Location Settings
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Provide your Home location to appear on the local proximity map. <span className="text-red-500">*</span>
                  </p>
                  
                  {/* Home Location */}
                  <div className="border border-[var(--color-border-light)]/60 rounded-lg p-3 flex flex-col gap-3">
                    <h5 className="font-semibold text-xs text-[var(--color-primary)] flex items-center gap-1">
                      🏠 Home Location {fetchingGeoAddress && <span className="text-[10px] text-[var(--color-primary)] animate-pulse font-normal">(Auto-fetching coordinates...)</span>}
                    </h5>
                    <div>
                      <label className="label text-[11px] mb-1">Area / Apartment Complex Name</label>
                      <LocationAutocomplete
                        className="input w-full text-sm py-1.5"
                        style={showErrors && !user.home_name?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
                        value={user.home_name ?? ""}
                        placeholder="e.g. L&T South City"
                        onChange={(val) => setUser({ ...user, home_name: val })}
                        onSelect={({ name, lat, lng }) =>
                          setUser({
                            ...user,
                            home_name: name,
                            home_lat: lat,
                            home_lng: lng,
                          })
                        }
                      />
                      {showErrors && !user.home_name?.trim() && (
                        <p className="text-xs text-red-500 mt-1">Home location name is required</p>
                      )}
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
                    {user.home_lat ? (
                      <span className="text-[11px] text-[var(--color-success)] font-medium flex items-center gap-1">
                        ✓ Home Coordinates Set ({user.home_lat.toFixed(4)}, {user.home_lng?.toFixed(4)})
                      </span>
                    ) : (
                      showErrors && (
                        <p className="text-xs text-red-500 mt-1">Please select and place a pin for your Home location</p>
                      )
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
                disabled={saving}
                onClick={handleOnboardingComplete}
              >
                {saving ? "Completing..." : "Complete & Save Profile ✓"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating In-App Toast */}
      {toast && (
        <div 
          className="fixed bottom-20 right-4 z-[9999] flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-lg)] animate-fadeInUp border-l-4 pointer-events-auto"
          style={{ 
            borderColor: toast.type === "error" ? "var(--color-error)" : "var(--color-border)",
            borderLeftColor: toast.type === "error" ? "var(--color-error)" : "var(--color-primary)",
            maxWidth: "350px",
          }}
        >
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
              {toast.type === "error" ? (
                <svg className="w-4 h-4 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              )}
              {toast.type === "error" ? "Import Failed" : "Import Success"}
            </span>
            <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-normal">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer self-start p-0.5 border-none bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </>
  );
}
