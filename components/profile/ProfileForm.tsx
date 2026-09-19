"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";
import type { User, UserVisibility, Institute, UserInstituteAffiliation } from "@/lib/types";
import { createBrowserClient } from "@/lib/supabase/client";
import { isProfileIncomplete } from "@/lib/profile-validation";
import { calculateTier } from "@/lib/network-score";
import { RechargeModal } from "@/components/RechargeModal";
import { formatLinkedInUrl } from "@/lib/linkedin/normalize-url";

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

function extractLinkedInHandle(url: string | null | undefined): string {
  if (!url) return "";
  let clean = url.trim();
  if (clean.includes("linkedin.com/in/")) {
    clean = clean.split("linkedin.com/in/")[1] || "";
  }
  clean = clean.replace(/^https?:\/\/[^\/]+\//, "").replace(/^\/+|\/+$/g, "");
  return clean;
}

const HELP_PRESETS = [
  "System Design Prep",
  "Startup Pitch Feedback",
  "Frontend / React Debugging",
  "Moving / Relocation Advice",
  "Weekend Badminton",
  "EV Buying Experience",
  "School Recommendations",
  "Home Automation & IoT",
];

const TINKERING_PRESETS = [
  "Local LLMs on Mac",
  "Sourdough Bread",
  "Rust & WebAssembly",
  "Arduino / Microcontrollers",
  "Marathon Training",
  "Bouldering",
  "Investing & Trading Bots",
];

const ASK_PRESETS = [
  "Life in Bangalore vs Europe",
  "Parenting in Tech",
  "Angel Investing",
  "Remote Work Best Practices",
  "Switching from IC to Manager",
];

export function ProfileForm({ initialUser }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams?.get("onboarding") === "true";
  const [user, setUser] = useState({
    ...initialUser,
    linkedin_profile_url: initialUser.linkedin_profile_url || ""
  });
  const [societyName, setSocietyName] = useState<string>(initialUser.society_name || "");
  const [helpOffers, setHelpOffers] = useState<string[]>(initialUser.help_offers || []);
  const [tinkeringWith, setTinkeringWith] = useState<string[]>(initialUser.tinkering_with || []);
  const [askMeAbout, setAskMeAbout] = useState<string[]>(initialUser.ask_me_about || []);
  const [quickChatPref, setQuickChatPref] = useState<string>(initialUser.quick_chat_preference || "chai");
  const [helpInput, setHelpInput] = useState("");
  const [tinkeringInput, setTinkeringInput] = useState("");
  const [askInput, setAskInput] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>(() => initialUser.linkedin_profile_url || "");

  const handleLinkedInInputChange = (val: string) => {
    let cleanVal = val.trim();
    if (cleanVal.includes("linkedin.com") && cleanVal.includes("?")) {
      cleanVal = cleanVal.split("?")[0].replace(/\/+$/, "");
    }
    setLinkedinUrl(cleanVal);
    setUser(prev => ({ ...prev, linkedin_profile_url: cleanVal }));
  };

  const handleLinkedInBlurFormatted = (rawVal: string) => {
    const formatted = formatLinkedInUrl(rawVal);
    if (formatted) {
      setLinkedinUrl(formatted);
      setUser(prev => ({ ...prev, linkedin_profile_url: formatted }));
      handleLinkedInBlur(formatted);
    } else if (!rawVal.trim()) {
      setLinkedinUrl("");
      setUser(prev => ({ ...prev, linkedin_profile_url: "" }));
    }
  };
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
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [affiliations, setAffiliations] = useState<UserInstituteAffiliation[]>([]);
  const [loadingAffiliations, setLoadingAffiliations] = useState(false);
  const [showAddAffiliation, setShowAddAffiliation] = useState(false);
  const [selectedInstituteId, setSelectedInstituteId] = useState("");
  const [affiliationDegree, setAffiliationDegree] = useState("");
  const [affiliationBatchYear, setAffiliationBatchYear] = useState("");
  const [savingAffiliation, setSavingAffiliation] = useState(false);

  useEffect(() => {
    // Load institutes directory
    fetch("/api/institutes")
      .then((r) => r.json())
      .then((data) => {
        if (data.institutes) setInstitutes(data.institutes);
      })
      .catch(() => {});

    // Load user affiliations
    setLoadingAffiliations(true);
    fetch("/api/profile/affiliations")
      .then((r) => r.json())
      .then((data) => {
        if (data.affiliations) setAffiliations(data.affiliations);
      })
      .catch(() => {})
      .finally(() => setLoadingAffiliations(false));
  }, []);

  const showName = !user.full_name?.trim();
  const showEmail = !user.email?.trim();
  const showHomeLocation = user.home_lat == null || user.home_lng == null;

  const hasMissingFields = showName || showEmail || showHomeLocation;
  const [dismissedModal, setDismissedModal] = useState(false);
  const showModal = hasMissingFields && !dismissedModal;

  useEffect(() => {
    // Automatically detect current GPS location and set as Home if not yet set
    if (user.home_lat == null && user.home_lng == null) {
      if (typeof window !== "undefined" && navigator.geolocation) {
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

            let resolvedAddress = "";
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (apiKey) {
              try {
                const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.results && data.results.length > 0) {
                    resolvedAddress = data.results[0].formatted_address;
                  }
                }
              } catch (err) {
                console.error("Google reverse geocode failed:", err);
              }
            }

            if (!resolvedAddress) {
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                if (res.ok) {
                  const data = await res.json();
                  resolvedAddress = data.display_name || [data.address?.suburb, data.address?.city, data.address?.state].filter(Boolean).join(", ");
                }
              } catch (err) {
                console.warn("Nominatim reverse geocode failed:", err);
              }
            }

            if (!resolvedAddress) {
              resolvedAddress = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            }

            setUser((prev) => ({
              ...prev,
              home_name: prev.home_name?.trim() ? prev.home_name : resolvedAddress,
            }));
            setFetchingGeoAddress(false);
          },
          (err) => {
            console.warn("Geolocation request failed or denied:", err);
            setFetchingGeoAddress(false);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      }
    }
  }, [user.home_lat, user.home_lng]);

  useEffect(() => {
    if (searchParams && searchParams.get("prompt") === "resume") {
      setTimeout(() => {
        const el = document.getElementById("resume-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-[var(--color-primary)]", "animate-pulse");
          setTimeout(() => {
            el.classList.remove("animate-pulse");
          }, 3000);
        }
      }, 400);
    }
  }, [searchParams]);

  const handleLinkedInBlur = async (url: string) => {
    if (!url || url === "https://www.linkedin.com/in/" || !url.includes("linkedin.com")) return;
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
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auto-parse LinkedIn profile on load if URL is present but company or title is missing
  useEffect(() => {
    if (user.linkedin_profile_url && (!user.company?.trim() || !user.job_title?.trim())) {
      handleLinkedInBlur(user.linkedin_profile_url);
    }
  }, [user.linkedin_profile_url]);

  const handleAddAffiliation = async () => {
    if (!selectedInstituteId) return;
    setSavingAffiliation(true);
    try {
      const res = await fetch("/api/profile/affiliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institute_id: selectedInstituteId,
          degree: affiliationDegree || null,
          batch_year: affiliationBatchYear ? Number(affiliationBatchYear) : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.affiliation) {
          setAffiliations((prev) => {
            const filtered = prev.filter((a) => a.id !== data.affiliation.id);
            return [data.affiliation, ...filtered];
          });
          setShowAddAffiliation(false);
          setSelectedInstituteId("");
          setAffiliationDegree("");
          setAffiliationBatchYear("");
          setToast({
            message: data.affiliation.verification_status === "verified_domain"
              ? "✅ Institute affiliation added and auto-verified!"
              : "Institute affiliation added successfully.",
            type: "success",
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to add affiliation");
      }
    } catch (e) {
      console.error(e);
      alert("Error adding affiliation");
    } finally {
      setSavingAffiliation(false);
    }
  };

  const handleDeleteAffiliation = async (id: string) => {
    if (!confirm("Are you sure you want to remove this institute affiliation?")) return;
    try {
      const res = await fetch(`/api/profile/affiliations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAffiliations((prev) => prev.filter((a) => a.id !== id));
        setToast({ message: "Affiliation removed.", type: "success" });
      }
    } catch (e) {
      console.error(e);
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
  const isHomeLocationValid = user.home_lat != null && user.home_lng != null;

  const missingFields: string[] = [];
  if (!isNameValid) missingFields.push("Full Name");
  if (!isEmailValid) missingFields.push("Email Address");
  if (!isHomeLocationValid) missingFields.push("Home Location");

  const canSubmit =
    isNameValid &&
    isEmailValid &&
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
    const commitTags = (pendingText: string, currentTags: string[]) => {
      if (!pendingText || !pendingText.trim()) return currentTags;
      const parts = pendingText.split(",").map(p => p.trim()).filter(Boolean);
      const updated = [...currentTags];
      for (const raw of parts) {
        let clean = raw.trim();
        if (!clean) continue;
        if (!clean.startsWith("#")) clean = `#${clean}`;
        if (!updated.includes(clean)) updated.push(clean);
      }
      return updated;
    };

    const finalTags = commitTags(tagInput, user.tags || []);
    setTagInput("");

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
        tags: finalTags,
        help_offers: helpOffers,
        tinkering_with: tinkeringWith,
        ask_me_about: askMeAbout,
        quick_chat_preference: quickChatPref,
        society_name: societyName.trim() || null,
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
    const commitTags = (pendingText: string, currentTags: string[]) => {
      if (!pendingText || !pendingText.trim()) return currentTags;
      const parts = pendingText.split(",").map(p => p.trim()).filter(Boolean);
      const updated = [...currentTags];
      for (const raw of parts) {
        let clean = raw.trim();
        if (!clean) continue;
        if (!clean.startsWith("#")) clean = `#${clean}`;
        if (!updated.includes(clean)) updated.push(clean);
      }
      return updated;
    };

    const finalTags = commitTags(tagInput, user.tags || []);
    setTagInput("");

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
        tags: finalTags,
        help_offers: helpOffers,
        tinkering_with: tinkeringWith,
        ask_me_about: askMeAbout,
        quick_chat_preference: quickChatPref,
        society_name: societyName.trim() || null,
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
          <span>Complete your profile details. All required fields (Name, Email) must be filled.</span>
        </div>
      )}

      {/* ---- Quick Setup Dismissed Notice ---- */}
      {dismissedModal && hasMissingFields && (
        <div className="alert alert-warning flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <span className="text-xs sm:text-sm">Your profile has missing required information. Fill out the fields below, or reopen the quick setup modal.</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedModal(false)}
            className="btn btn-secondary btn-sm shrink-0 text-xs cursor-pointer"
          >
            Reopen Quick Setup
          </button>
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
            {affiliations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {affiliations.map((aff) => {
                  const isVerified = aff.verification_status === "verified_domain";
                  return (
                    <span
                      key={aff.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isVerified ? "var(--color-success-bg, rgba(16, 185, 129, 0.15))" : "var(--color-surface-secondary)",
                        color: isVerified ? "var(--color-success, #059669)" : "var(--color-primary)",
                        border: `1px solid ${isVerified ? "rgba(16, 185, 129, 0.3)" : "var(--color-border-light)"}`,
                      }}
                      title={isVerified ? "Verified Alumni via institutional email" : "Claimed Alumni affiliation"}
                    >
                      🎓 {aff.institute?.name || "Institute"}
                      {aff.batch_year ? ` '${String(aff.batch_year).slice(-2)}` : ""}
                      {isVerified ? " ✓" : ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Network Stats & Grow Nudge */}
      <div className="flex flex-col gap-3 mb-6 animate-fadeInUp">
        {/* Follow & Credits Stats Grid */}
        <div className="card p-4 bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-xl shadow-sm flex items-center justify-around text-center divide-x divide-[var(--color-border-light)]" style={{ display: "flex", flexDirection: "row" }}>
          <div className="flex-1">
            <div className="text-xl font-extrabold text-[var(--color-primary)]">{followStats.followingCount}</div>
            <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mt-0.5">Following</div>
          </div>
          <div className="flex-1">
            <div className="text-xl font-extrabold text-[var(--color-primary)]">{followStats.followerCount}</div>
            <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mt-0.5">Followers</div>
          </div>
          <button
            type="button"
            onClick={() => setShowRechargeModal(true)}
            className="flex-1 bg-transparent border-0 cursor-pointer hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors p-1"
            title="Click to view or recharge wallet credits"
          >
            <div className="text-xl font-extrabold text-[var(--color-primary)] flex items-center justify-center gap-1">
              <span>{user.wallet ?? 0}</span>
              <span className="text-sm">⚡</span>
            </div>
            <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider mt-0.5">
              Credits <span className="text-[var(--color-primary)] underline ml-0.5">Recharge</span>
            </div>
          </button>
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
              <span className="flex items-center gap-1.5 font-semibold text-sm">
                LinkedIn Profile URL <span className="text-red-500">*</span>
              </span>
              {fetchingLinkedInDetails && (
                <span className="text-xs text-[var(--color-primary)] animate-pulse flex items-center gap-1 font-medium">
                  <span className="animate-spin inline-block">⏳</span> Parsing profile details...
                </span>
              )}
            </label>
            <div 
              className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-primary)] transition-all shadow-sm" 
              style={showErrors && !user.linkedin_profile_url?.trim() ? { borderColor: "var(--color-error)", boxShadow: "0 0 0 3px rgba(204, 16, 22, 0.15)" } : undefined}
            >
              <div className="bg-[#0A66C2]/10 text-[#0A66C2] px-3 flex items-center justify-center border-r border-[var(--color-border-light)] shrink-0 select-none">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.66 1.66 0 0 0-1.66 1.66 1.66 1.66 0 0 0 1.66 1.66 1.66 1.66 0 0 0 1.66-1.66A1.66 1.66 0 0 0 7.83 6.2z"/>
                </svg>
              </div>
              <input
                type="url"
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none placeholder:text-[var(--color-text-tertiary)] placeholder:opacity-60"
                value={linkedinUrl}
                placeholder="https://www.linkedin.com/in/your-profile"
                onChange={(e) => handleLinkedInInputChange(e.target.value)}
                onBlur={() => handleLinkedInBlurFormatted(linkedinUrl)}
              />
              {linkedinUrl && linkedinUrl.includes("linkedin.com/in/") && (
                <div className="flex items-center pr-3 shrink-0 text-emerald-600 dark:text-emerald-400 text-xs font-semibold gap-1">
                  ✓
                </div>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 flex items-center justify-between">
              <span>💡 Tip: Paste your full profile link directly from the LinkedIn app.</span>
              {linkedinUrl && linkedinUrl.includes("linkedin.com") && (
                <a
                  href={linkedinUrl.startsWith("http") ? linkedinUrl : `https://${linkedinUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  Verify Link ↗
                </a>
              )}
            </p>
            {showErrors && !user.linkedin_profile_url?.trim() && (
              <p className="text-xs text-red-500 mt-1 font-medium">LinkedIn profile URL is required</p>
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

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Tags</label>
            <div className="flex flex-col gap-2">
              <input
                className="input"
                value={tagInput}
                placeholder="e.g. #IIM Lucknow, #FinTech (Press Enter or Comma to add)"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(",")) {
                    const parts = val.split(",");
                    const lastPart = parts.pop() || "";
                    let updated = [...(user.tags || [])];
                    for (const p of parts) {
                      let clean = p.trim();
                      if (!clean) continue;
                      if (!clean.startsWith("#")) clean = `#${clean}`;
                      if (!updated.includes(clean)) updated.push(clean);
                    }
                    setUser({ ...user, tags: updated });
                    setTagInput(lastPart);
                  } else {
                    setTagInput(val);
                  }
                }}
                onBlur={() => {
                  if (tagInput.trim()) {
                    let clean = tagInput.trim().replace(/^,|,$/g, "");
                    if (clean) {
                      if (!clean.startsWith("#")) clean = `#${clean}`;
                      if (!(user.tags || []).includes(clean)) {
                        setUser({ ...user, tags: [...(user.tags || []), clean] });
                      }
                    }
                    setTagInput("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    let clean = tagInput.trim().replace(/^,|,$/g, "");
                    if (clean) {
                      if (!clean.startsWith("#")) clean = `#${clean}`;
                      if (!(user.tags || []).includes(clean)) {
                        setUser({ ...user, tags: [...(user.tags || []), clean] });
                      }
                    }
                    setTagInput("");
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                {(user.tags || []).map((t) => {
                  const displayTag = t.startsWith("#") ? t : `#${t}`;
                  return (
                    <span key={t} className="badge badge-primary flex items-center gap-1 font-semibold" style={{ padding: "4px 10px" }}>
                      {displayTag}
                      <button
                        type="button"
                        onClick={() => setUser({ ...user, tags: user.tags.filter(tag => tag !== t) })}
                        className="border-none bg-transparent text-white cursor-pointer hover:opacity-80 ml-0.5"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        &times;
                      </button>
                    </span>
                  );
                })}
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

          <div id="resume-section" style={{ gridColumn: "1 / -1" }} className="bg-[var(--color-surface-hover)] p-4 rounded-lg border border-[var(--color-primary-subtle)] transition-all duration-300">
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

      {/* ---- Section: Institute & Alumni Network ---- */}
      <CollapsibleSection
        icon={<span className="text-base">🎓</span>}
        title="Institute & Alumni Network"
        defaultOpen={affiliations.length > 0}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
            Connect with peers and alumni from your alma mater. Signing in or linking an official institute email (e.g. <span className="font-semibold text-[var(--color-text)]">@iitk.ac.in</span>) automatically verifies your alumni badge.
          </p>

          {/* Affiliations List */}
          {loadingAffiliations ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-2">
              <span className="spinner spinner-sm" /> Loading affiliations...
            </div>
          ) : affiliations.length === 0 ? (
            <div className="p-3.5 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-center">
              <p className="text-xs text-[var(--color-text-secondary)] m-0">
                No institute affiliations added yet. Claim your alma mater to unlock the alumni network!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {affiliations.map((aff) => {
                const isVerified = aff.verification_status === "verified_domain";
                return (
                  <div
                    key={aff.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center text-xs shrink-0">
                        {aff.institute?.short_code || "🎓"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-xs text-[var(--color-text)] m-0">
                            {aff.institute?.name || "Institute"}
                          </h4>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isVerified ? "var(--color-success-bg, rgba(16, 185, 129, 0.15))" : "var(--color-surface-secondary)",
                              color: isVerified ? "var(--color-success, #059669)" : "var(--color-primary)",
                              border: `1px solid ${isVerified ? "rgba(16, 185, 129, 0.3)" : "var(--color-border-light)"}`,
                            }}
                          >
                            {isVerified ? "✅ Verified Alumni" : "🔵 Claimed Alumni"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] m-0 mt-0.5">
                          {aff.degree || "Alumnus"} {aff.batch_year ? `• Class of ${aff.batch_year}` : ""}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAffiliation(aff.id)}
                      className="text-[var(--color-text-tertiary)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer border-none bg-transparent"
                      title="Remove affiliation"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Affiliation Form Toggle */}
          {!showAddAffiliation ? (
            <button
              type="button"
              onClick={() => setShowAddAffiliation(true)}
              className="btn btn-secondary btn-sm self-start flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <span>+ Add Institute Affiliation</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-surface-secondary)] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-primary)]">Add Institute Affiliation</span>
                <button
                  type="button"
                  onClick={() => setShowAddAffiliation(false)}
                  className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] border-none bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="label text-[11px] mb-1 font-semibold">Select Institute *</label>
                <select
                  className="input w-full text-xs"
                  value={selectedInstituteId}
                  onChange={(e) => setSelectedInstituteId(e.target.value)}
                >
                  <option value="">-- Choose your college or institute --</option>
                  {institutes.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.short_code || inst.category.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-[11px] mb-1 font-semibold">Degree / Program</label>
                  <input
                    className="input w-full text-xs"
                    value={affiliationDegree}
                    onChange={(e) => setAffiliationDegree(e.target.value)}
                    placeholder="e.g. B.Tech Computer Science, MBA"
                  />
                </div>
                <div>
                  <label className="label text-[11px] mb-1 font-semibold">Graduation / Batch Year</label>
                  <input
                    type="number"
                    min="1960"
                    max="2035"
                    className="input w-full text-xs"
                    value={affiliationBatchYear}
                    onChange={(e) => setAffiliationBatchYear(e.target.value)}
                    placeholder="e.g. 2020"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAddAffiliation(false)}
                  className="btn btn-secondary btn-sm text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedInstituteId || savingAffiliation}
                  onClick={handleAddAffiliation}
                  className="btn btn-primary btn-sm text-xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingAffiliation ? (
                    <>
                      <span className="spinner spinner-sm" /> Saving...
                    </>
                  ) : (
                    "Save Affiliation ✓"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ---- Section: Neighbor Scrapbook & Icebreakers ---- */}
      <CollapsibleSection
        icon={<span className="text-base">📖</span>}
        title="Neighbor Scrapbook & Icebreakers"
        defaultOpen={true}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
            The anti-resume. No corporate bragging needed — share what you genuinely enjoy helping neighbors with, what you tinker with after hours, or your favorite conversation topics.
          </p>

          {/* Society / Apartment Complex Name */}
          <div>
            <label className="label font-semibold text-xs flex items-center gap-1.5">
              <span>🏢</span> Society / Apartment Complex / Tech Park
            </label>
            <input
              className="input w-full"
              value={societyName}
              onChange={(e) => setSocietyName(e.target.value)}
              placeholder="e.g. Prestige Falcon City, L&T South City, HSR Sector 2"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              Groups you with neighbors in your complex for the local tech yearbook and society directory.
            </p>
          </div>

          {/* Quick Chat Preference */}
          <div>
            <label className="label font-semibold text-xs mb-2 block">
              ☕ Quick Catch-up Preference
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "chai", label: "15-min Chai", icon: "☕" },
                { id: "walk", label: "Evening Walk", icon: "🚶" },
                { id: "weekend_coffee", label: "Weekend Coffee", icon: "🥐" },
                { id: "dm_only", label: "DM Only", icon: "💬" },
              ].map((item) => {
                const isSelected = quickChatPref === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQuickChatPref(item.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. What I can help neighbors with */}
          <div>
            <label className="label font-semibold text-xs mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🤝</span> What I can help neighbors with
              </span>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">Generosity first</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                className="input flex-1 text-xs"
                value={helpInput}
                onChange={(e) => setHelpInput(e.target.value)}
                placeholder="e.g. System design prep, EV buying tips, badminton"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = helpInput.trim();
                    if (trimmed && !helpOffers.includes(trimmed)) {
                      setHelpOffers([...helpOffers, trimmed]);
                      setHelpInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = helpInput.trim();
                  if (trimmed && !helpOffers.includes(trimmed)) {
                    setHelpOffers([...helpOffers, trimmed]);
                    setHelpInput("");
                  }
                }}
                className="btn btn-secondary btn-sm text-xs cursor-pointer"
              >
                + Add
              </button>
            </div>

            {/* Selected Tags */}
            {helpOffers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {helpOffers.map((offer) => (
                  <span
                    key={offer}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  >
                    {offer}
                    <button
                      type="button"
                      onClick={() => setHelpOffers(helpOffers.filter((o) => o !== offer))}
                      className="border-none bg-transparent text-emerald-700 dark:text-emerald-300 hover:text-red-500 cursor-pointer p-0 text-xs"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium mr-1">Suggested:</span>
              {HELP_PRESETS.filter((p) => !helpOffers.includes(p)).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setHelpOffers([...helpOffers, p])}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-surface-secondary)] hover:bg-emerald-500/10 hover:text-emerald-500 text-[var(--color-text-secondary)] border border-[var(--color-border-light)] cursor-pointer transition-colors"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>

          {/* 2. What I'm tinkering with after 6 PM */}
          <div>
            <label className="label font-semibold text-xs mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>⚡</span> What I'm tinkering with after 6 PM
              </span>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">Passions & curiosity</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                className="input flex-1 text-xs"
                value={tinkeringInput}
                onChange={(e) => setTinkeringInput(e.target.value)}
                placeholder="e.g. Local LLMs on Mac, Sourdough, Arduino"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = tinkeringInput.trim();
                    if (trimmed && !tinkeringWith.includes(trimmed)) {
                      setTinkeringWith([...tinkeringWith, trimmed]);
                      setTinkeringInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = tinkeringInput.trim();
                  if (trimmed && !tinkeringWith.includes(trimmed)) {
                    setTinkeringWith([...tinkeringWith, trimmed]);
                    setTinkeringInput("");
                  }
                }}
                className="btn btn-secondary btn-sm text-xs cursor-pointer"
              >
                + Add
              </button>
            </div>

            {/* Selected Tags */}
            {tinkeringWith.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tinkeringWith.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => setTinkeringWith(tinkeringWith.filter((t) => t !== item))}
                      className="border-none bg-transparent text-purple-700 dark:text-purple-300 hover:text-red-500 cursor-pointer p-0 text-xs"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium mr-1">Suggested:</span>
              {TINKERING_PRESETS.filter((p) => !tinkeringWith.includes(p)).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTinkeringWith([...tinkeringWith, p])}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-surface-secondary)] hover:bg-purple-500/10 hover:text-purple-500 text-[var(--color-text-secondary)] border border-[var(--color-border-light)] cursor-pointer transition-colors"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Ask me about... */}
          <div>
            <label className="label font-semibold text-xs mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>💬</span> Ask me about...
              </span>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">Icebreaker topics</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                className="input flex-1 text-xs"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="e.g. Life in Bangalore vs Europe, Angel investing"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = askInput.trim();
                    if (trimmed && !askMeAbout.includes(trimmed)) {
                      setAskMeAbout([...askMeAbout, trimmed]);
                      setAskInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = askInput.trim();
                  if (trimmed && !askMeAbout.includes(trimmed)) {
                    setAskMeAbout([...askMeAbout, trimmed]);
                    setAskInput("");
                  }
                }}
                className="btn btn-secondary btn-sm text-xs cursor-pointer"
              >
                + Add
              </button>
            </div>

            {/* Selected Tags */}
            {askMeAbout.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {askMeAbout.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => setAskMeAbout(askMeAbout.filter((a) => a !== topic))}
                      className="border-none bg-transparent text-blue-700 dark:text-blue-300 hover:text-red-500 cursor-pointer p-0 text-xs"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium mr-1">Suggested:</span>
              {ASK_PRESETS.filter((p) => !askMeAbout.includes(p)).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAskMeAbout([...askMeAbout, p])}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-surface-secondary)] hover:bg-blue-500/10 hover:text-blue-500 text-[var(--color-text-secondary)] border border-[var(--color-border-light)] cursor-pointer transition-colors"
                >
                  + {p}
                </button>
              ))}
            </div>
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
                You have accumulated <strong>{user.network_points || 0}</strong> network points and have <strong>{user.wallet ?? 0}</strong> active credits.
                <button
                  type="button"
                  onClick={() => setShowRechargeModal(true)}
                  className="ml-2 text-xs text-[var(--color-primary)] font-bold hover:underline bg-transparent border-none cursor-pointer p-0"
                >
                  View / Top-up &rarr;
                </button>
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
      <div id="notifications" style={{ scrollMarginTop: "80px" }} />
      <CollapsibleSection
        id="notification-settings"
        title="Notification Settings"
        icon={
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 14.79 18 13.42 18 12V8a6 6 0 10-12 0v4c0 1.42-.21 2.79-.595 3.595L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
          </svg>
        }
        defaultOpen={typeof window !== "undefined" && (window.location.hash === "#notifications" || window.location.hash === "#notification-settings")}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
            const isAndroidApp = typeof window !== "undefined" && "AndroidBridge" in window && Boolean((window as unknown as Record<string, unknown>).AndroidBridge);
            const isNotificationSupported = typeof window !== "undefined" && "Notification" in window;
            const isGranted = typeof Notification !== "undefined" && Notification.permission === "granted";
            const isDefault = typeof Notification !== "undefined" && Notification.permission === "default";

            if (isAndroidApp) {
              return (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 0",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="text-body-sm font-semibold">Push Notifications</span>
                    <span className="text-caption text-[var(--color-text-secondary)]">
                      Receive notifications for local matches and chat answers on this device.
                    </span>
                  </div>
                  <span className="text-xs text-green-500 font-semibold flex items-center gap-1">
                    ✓ Enabled natively on Android
                  </span>
                </div>
              );
            }

            if (!isNotificationSupported) {
              return (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 0",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="text-body-sm font-semibold">Push Notifications</span>
                    <span className="text-caption text-[var(--color-text-secondary)]">
                      Receive notifications for local matches and chat answers on this device.
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    Unsupported browser/webview
                  </span>
                </div>
              );
            }

            if (isGranted) {
              return (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 0",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="text-body-sm font-semibold">Push Notifications</span>
                    <span className="text-caption text-[var(--color-text-secondary)]">
                      Receive notifications for local matches and chat answers on this device.
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="text-xs text-green-500 font-semibold flex items-center gap-1">
                      ✓ Enabled on this device
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-[var(--color-text-secondary)]"
                      title="Re-sync notification token"
                      onClick={async () => {
                        try {
                          const fcmVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                          const { getMessaging, getToken, getFcmRegistration, isFirebaseConfigured } = await import("@/lib/firebase-client");
                          if (!isFirebaseConfigured || !fcmVapidKey) return;
                          const messaging = getMessaging();
                          const registration = await getFcmRegistration();
                          if (!registration) throw new Error("Service worker registration not found.");
                          const token = await getToken(messaging, { vapidKey: fcmVapidKey, serviceWorkerRegistration: registration });
                          if (token) {
                            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
                            const res = await fetch("/api/fcm/register", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ token, platform: isIos ? "ios" : "web" }),
                            });
                            if (!res.ok) throw new Error("Failed to sync token.");
                            setToast({ message: "Notification token re-synced successfully!", type: "success" });
                          }
                        } catch (e: unknown) {
                          const msg = e instanceof Error ? e.message : String(e);
                          setToast({ message: `Token re-sync failed: ${msg}`, type: "error" });
                        }
                      }}
                    >
                      Re-sync
                    </button>
                  </div>
                </div>
              );
            }

            // Permission is "default" — show the incentive card
            if (isDefault) {
              return (
                <div
                  style={{
                    borderRadius: "var(--radius-lg, 16px)",
                    border: "1px solid var(--color-primary-subtle, rgba(10,102,194,0.15))",
                    background: "linear-gradient(135deg, var(--color-primary-subtle, rgba(10,102,194,0.06)) 0%, var(--color-accent-subtle, rgba(168,85,247,0.06)) 100%)",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        flexShrink: 0,
                        boxShadow: "0 4px 12px rgba(10,102,194,0.2)",
                      }}
                    >
                      🔔
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)", marginBottom: 2 }}>
                        Enable Push Notifications
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        Get instant alerts for chat replies, job referrals, and local updates — even when the app is in the background.
                      </div>
                    </div>
                  </div>

                  {/* Incentive badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🎁</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "rgb(22,163,74)" }}>
                        Earn 5 bonus credits
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        Get free credits added to your wallet when you enable notifications
                      </div>
                    </div>
                  </div>

                  {/* Enable button */}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      fontSize: 14,
                      fontWeight: 700,
                      borderRadius: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                    onClick={async () => {
                      try {
                        const permission = await Notification.requestPermission();
                        if (permission !== "granted") {
                          setToast({ message: "Notification permission denied. Please enable them in your device settings.", type: "error" });
                          return;
                        }
                        const fcmVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                        const { getMessaging, getToken, getFcmRegistration, isFirebaseConfigured } = await import("@/lib/firebase-client");
                        
                        if (!isFirebaseConfigured) {
                          setToast({ message: "Push notifications are not fully configured. Please try again later.", type: "error" });
                          return;
                        }

                        if (!fcmVapidKey) {
                          setToast({ message: "Push notification key is not set. Please try again later.", type: "error" });
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
                          const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
                          const res = await fetch("/api/fcm/register", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ token, platform: isIos ? "ios" : "web" }),
                          });
                          if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            throw new Error(errData.error || "Failed to register token with server");
                          }

                          // Claim the push reward credits
                          try {
                            const rewardRes = await fetch("/api/profile/push-reward", { method: "POST" });
                            if (rewardRes.ok) {
                              const rewardData = await rewardRes.json();
                              if (rewardData.success && rewardData.creditsAwarded > 0) {
                                setUser((prev) => ({ ...prev, wallet: rewardData.newBalance }));
                                window.dispatchEvent(new CustomEvent("proxnet:wallet-updated", { detail: { newBalance: rewardData.newBalance } }));
                                setToast({ message: `🎉 Notifications enabled! ${rewardData.creditsAwarded} bonus credits added to your wallet.`, type: "success" });
                              } else {
                                setToast({ message: "Notifications enabled successfully on this device!", type: "success" });
                              }
                            } else {
                              setToast({ message: "Notifications enabled successfully on this device!", type: "success" });
                            }
                          } catch {
                            setToast({ message: "Notifications enabled successfully on this device!", type: "success" });
                          }
                        } else {
                          throw new Error("No registration token received");
                        }
                      } catch (error: unknown) {
                        console.error("Subscription failed:", error);
                        const isConfigMissing = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
                        if (isConfigMissing) {
                          setToast({ message: "Firebase config keys are missing. Please contact support.", type: "error" });
                        } else {
                          const msg = error instanceof Error ? error.message : "Are you in a supported browser?";
                          setToast({ message: `Failed to subscribe: ${msg}`, type: "error" });
                        }
                      }
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 14.79 18 13.42 18 12V8a6 6 0 10-12 0v4c0 1.42-.21 2.79-.595 3.595L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                    </svg>
                    Enable Now & Earn Credits
                  </button>
                </div>
              );
            }

            return null;
          })()}
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn">
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-lg w-full max-h-[min(90dvh,calc(100vh-2rem))] overflow-hidden animate-scaleIn flex flex-col text-[var(--color-text)] relative">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border-light)] px-5 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📍</span>
                <div>
                  <h3 className="text-h2 font-bold text-[var(--color-primary)] m-0">Complete Your Profile</h3>
                  <p className="text-caption text-[var(--color-text-secondary)] mt-0.5 m-0">Please provide the missing details below to unlock all features.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissedModal(true)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer shrink-0"
                title="Fill directly on page"
                aria-label="Close modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-4 bg-[var(--color-surface-secondary)] p-3.5 rounded-xl border border-[var(--color-border-light)] shrink-0">
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
                  <h4 className="font-semibold text-sm m-0">{user.full_name}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">{user.email}</p>
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
              
              {/* Optional LinkedIn Import */}
              {!user.linkedin_profile_url?.trim() && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-2.5 bg-[var(--color-surface)]">
                  <label className="label font-semibold text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      🔗 LinkedIn Profile <span className="text-[11px] font-normal text-[var(--color-text-secondary)]">(Optional - auto-fills company & title)</span>
                    </span>
                    {fetchingLinkedInDetails && <span className="text-[10px] text-[var(--color-primary)] animate-pulse">Auto-detecting details...</span>}
                  </label>
                  <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-primary)] transition-all shadow-sm">
                    <div className="bg-[#0A66C2]/10 text-[#0A66C2] px-3 flex items-center justify-center border-r border-[var(--color-border-light)] shrink-0 select-none">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.66 1.66 0 0 0-1.66 1.66 1.66 1.66 0 0 0 1.66 1.66 1.66 1.66 0 0 0 1.66-1.66A1.66 1.66 0 0 0 7.83 6.2z"/>
                      </svg>
                    </div>
                    <input
                      type="url"
                      className="w-full bg-transparent px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none placeholder:text-[var(--color-text-tertiary)] placeholder:opacity-60"
                      value={linkedinUrl}
                      placeholder="https://www.linkedin.com/in/your-profile"
                      onChange={(e) => handleLinkedInInputChange(e.target.value)}
                      onBlur={() => handleLinkedInBlurFormatted(linkedinUrl)}
                    />
                    {linkedinUrl && linkedinUrl.includes("linkedin.com/in/") && (
                      <div className="flex items-center pr-3 shrink-0 text-emerald-600 dark:text-emerald-400 text-xs font-semibold gap-1">
                        ✓
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    💡 Tip: Paste your full profile link directly from the LinkedIn app.
                  </p>
                </div>
              )}

              {/* Personal Details Section (if name is missing) */}
              {showName && (
                <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-4">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5">
                    💼 Personal Details
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
                </div>
              )}

              {/* Location Settings Section */}
              <div className="border border-[var(--color-border-light)] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[var(--color-primary)] flex items-center gap-1.5 m-0">
                    📍 Home Location
                  </h4>
                  {user.home_lat != null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      ✓ Auto-detected
                    </span>
                  )}
                </div>

                {fetchingGeoAddress && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-2.5 text-xs text-[var(--color-primary)] animate-pulse">
                    <span className="spinner spinner-sm" /> Auto-detecting your current location for Home tab...
                  </div>
                )}

                {user.home_lat != null && (
                  <div className="p-2.5 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex items-center gap-2">
                    <span className="text-base">🏠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text)] m-0 truncate">
                        {user.home_name || "Current Location"}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] m-0">
                        {user.home_lat.toFixed(4)}, {user.home_lng?.toFixed(4)}
                      </p>
                    </div>
                  </div>
                )}

                {(!user.home_lat || showErrors) && (
                  <div>
                    <label className="label text-[11px] mb-1">Search Area / Apartment Complex Name</label>
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
                    {showErrors && !user.home_lat && (
                      <p className="text-xs text-red-500 mt-1">Please allow GPS location or search for your neighborhood</p>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Sticky Footer Buttons */}
            <div className="shrink-0 sticky bottom-0 z-10 bg-[var(--color-surface)] border-t border-[var(--color-border-light)] px-5 py-3.5 flex flex-col items-center gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
              <button
                type="button"
                className="btn btn-primary w-full py-2.5 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                disabled={saving}
                onClick={handleOnboardingComplete}
              >
                {saving ? (
                  <>
                    <span className="spinner spinner-sm" style={{ borderTopColor: "var(--color-text-inverse)" }} />
                    Completing…
                  </>
                ) : (
                  "Complete & Save Profile ✓"
                )}
              </button>
              <button
                type="button"
                onClick={() => setDismissedModal(true)}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors underline cursor-pointer bg-transparent border-none p-0"
              >
                Or fill details directly on full profile page →
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

      {/* Recharge Modal */}
      <RechargeModal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        walletBalance={user.wallet ?? 0}
      />
    </>
  );
}
