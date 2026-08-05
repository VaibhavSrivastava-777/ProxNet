"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import type { User } from "@/lib/types";

interface Props {
  user?: User;
  onSuccess?: () => void;
}

/* ----------------------------------------------------------------
   Collapsible Section Component
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
        setMaxHeight(`${el.scrollHeight}px`);
        const timer = setTimeout(() => setMaxHeight("none"), 300);
        return () => clearTimeout(timer);
      }
    } else {
      const el = contentRef.current;
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`);
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
          padding: "16px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text)",
        }}
      >
        <span style={{ display: "flex", color: "var(--color-accent)", fontSize: 20 }}>
          {icon}
        </span>
        <span className="text-h3" style={{ flex: 1, textAlign: "left", fontSize: 16, fontWeight: 700 }}>
          {title}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{
            transition: "transform var(--transition-normal)",
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
          transition: "max-height var(--transition-normal)",
        }}
      >
        <div style={{ padding: "0 20px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

/* Icons */
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

const SparklesIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.795M20.625 3c-.72 0-1.353.447-1.625 1.096L17.25 8.5M20.625 3c.72 0 1.353.447 1.625 1.096L20.5 8.5m-3.25 0h6.5m-6.5 0L14.25 14M20.5 8.5L17.25 14" />
  </svg>
);

function extractLinkedInHandle(url: string | null | undefined): string {
  if (!url) return "";
  let clean = url.trim();
  if (clean.includes("linkedin.com/in/")) {
    clean = clean.split("linkedin.com/in/")[1] || "";
  }
  clean = clean.replace(/^https?:\/\/[^\/]+\//, "").replace(/^\/+|\/+$/g, "");
  return clean;
}

const emptyUser = {
  full_name: "",
  email: "",
  company: "",
  job_title: "",
  profile_photo_url: "",
  linkedin_profile_url: "",
  anonymous_name: "",
  home_lat: "",
  home_lng: "",
  office_lat: "",
  office_lng: "",
  active_location: "home" as const,
  is_active: true,
  is_blocked: false,
  about: "",
  professional_bio: "",
  wallet: 0,
  tags: [] as string[],
};

export function UserForm({ user, onSuccess }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(
    user
      ? {
          full_name: user.full_name,
          email: user.email ?? "",
          company: user.company ?? "",
          job_title: user.job_title ?? "",
          profile_photo_url: user.profile_photo_url ?? "",
          linkedin_profile_url: user.linkedin_profile_url ?? "",
          anonymous_name: user.anonymous_name ?? "",
          home_lat: user.home_lat?.toString() ?? "",
          home_lng: user.home_lng?.toString() ?? "",
          office_lat: user.office_lat?.toString() ?? "",
          office_lng: user.office_lng?.toString() ?? "",
          active_location: user.active_location,
          is_active: user.is_active,
          is_blocked: user.is_blocked || false,
          about: user.about ?? "",
          professional_bio: user.professional_bio ?? "",
          wallet: user.wallet ?? 0,
          tags: user.tags ?? [],
        }
      : emptyUser
  );

  const [linkedinHandle, setLinkedinHandle] = useState<string>(() => 
    extractLinkedInHandle(user?.linkedin_profile_url)
  );

  const handleLinkedInInputChange = (val: string) => {
    let cleanHandle = val.trim();
    if (cleanHandle.includes("linkedin.com/in/")) {
      cleanHandle = cleanHandle.split("linkedin.com/in/")[1] || "";
    }
    cleanHandle = cleanHandle.replace(/^https?:\/\/[^\/]+\//, "").replace(/^\/+|\/+$/g, "");
    setLinkedinHandle(cleanHandle);
    const fullUrl = cleanHandle ? `https://www.linkedin.com/in/${cleanHandle}` : "";
    setForm(prev => ({ ...prev, linkedin_profile_url: fullUrl }));
  };

  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

  /* Smart Import Tab States */
  const [activeTab, setActiveTab] = useState<"link" | "text" | "image">("link");
  const [textInput, setTextInput] = useState("");
  const [parsingText, setParsingText] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAITextParse = async () => {
    if (!textInput.trim()) return;
    setParsingText(true);
    setAutofillSuccess(null);
    try {
      const res = await fetch("/api/admin/parse-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setForm((prev) => ({
        ...prev,
        full_name: data.full_name || prev.full_name,
        email: data.email || prev.email,
        company: data.company || prev.company,
        job_title: data.job_title || prev.job_title,
        profile_photo_url: data.profile_photo_url || prev.profile_photo_url,
        linkedin_profile_url: data.linkedin_profile_url || prev.linkedin_profile_url,
        about: data.about || prev.about,
        professional_bio: data.professional_bio || prev.professional_bio,
      }));

      if (data.linkedin_profile_url) {
        setLinkedinHandle(extractLinkedInHandle(data.linkedin_profile_url));
      }

      setAutofillSuccess(
        data.full_name
          ? `Autofilled profile for ${data.full_name} using AI Text Parsing!`
          : "Autofill completed successfully!"
      );
      setTextInput("");
    } catch (err) {
      alert("AI Text parsing failed.");
    } finally {
      setParsingText(false);
    }
  };

  const handleAIImageScan = async () => {
    if (!selectedImage) return;
    setScanningImage(true);
    setAutofillSuccess(null);
    try {
      const res = await fetch("/api/admin/parse-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      setForm((prev) => ({
        ...prev,
        full_name: data.full_name || prev.full_name,
        email: data.email || prev.email,
        company: data.company || prev.company,
        job_title: data.job_title || prev.job_title,
        profile_photo_url: data.profile_photo_url || prev.profile_photo_url,
        linkedin_profile_url: data.linkedin_profile_url || prev.linkedin_profile_url,
        about: data.about || prev.about,
        professional_bio: data.professional_bio || prev.professional_bio,
      }));

      if (data.linkedin_profile_url) {
        setLinkedinHandle(extractLinkedInHandle(data.linkedin_profile_url));
      }

      setAutofillSuccess(
        data.full_name
          ? `Autofilled profile for ${data.full_name} using AI image scan!`
          : "Autofill completed successfully!"
      );
      setSelectedImage(null);
      setImageFile(null);
    } catch (err) {
      alert("AI Image scanning failed.");
    } finally {
      setScanningImage(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      company: form.company || null,
      job_title: form.job_title || null,
      profile_photo_url: form.profile_photo_url || null,
      linkedin_profile_url: form.linkedin_profile_url || null,
      anonymous_name: form.anonymous_name || null,
      home_lat: form.home_lat ? Number(form.home_lat) : null,
      home_lng: form.home_lng ? Number(form.home_lng) : null,
      office_lat: form.office_lat ? Number(form.office_lat) : null,
      office_lng: form.office_lng ? Number(form.office_lng) : null,
      active_location: form.active_location,
      is_active: form.is_active,
      is_blocked: form.is_blocked,
      about: form.about || null,
      professional_bio: form.professional_bio || null,
      wallet: Number(form.wallet) || 0,
      tags: form.tags,
    };

    const url = user ? `/api/admin/users/${user.id}` : "/api/admin/users";
    const method = user ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin");
        router.refresh();
      }
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save user.");
    }
  }

  /* Initials helper */
  const initials = (form.full_name || "PR")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const subtitle = [form.job_title, form.company].filter(Boolean).join(" at ");

  return (
    <form onSubmit={handleSubmit} className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── 1. Profile Header Banner & Avatar Card (Resembling Profile page) ── */}
      <div className="card" style={{ overflow: "hidden", position: "relative" }}>
        <div
          style={{
            height: 90,
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(4px)",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--color-primary)",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          {user ? "Admin Mode: Editing User Profile" : "Admin Mode: New User"}
        </div>

        <div
          style={{
            padding: "0 20px 20px",
            marginTop: -45,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          {/* Avatar */}
          <div
            className="avatar avatar-xl"
            style={{
              border: "4px solid var(--color-surface)",
              boxShadow: "var(--shadow-md)",
              width: 76,
              height: 76,
              borderRadius: "50%",
              overflow: "hidden",
            }}
          >
            {form.profile_photo_url ? (
              <img src={form.profile_photo_url} alt={form.full_name || "User Avatar"} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold flex items-center justify-center text-xl">
                {initials}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-h2 m-0" style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)" }}>
              {form.full_name || "New Professional"}
            </h2>
            {subtitle && (
              <p className="text-body-sm m-0 mt-0.5 text-[var(--color-text-secondary)] font-medium">
                {subtitle}
              </p>
            )}
            {form.email && (
              <p className="text-caption m-0 mt-0.5 text-[var(--color-text-tertiary)]">
                {form.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Smart Import & Autofill Panel (Accordion Card) ── */}
      <CollapsibleSection icon={SparklesIcon} title="Smart Import & AI Autofill" defaultOpen={false}>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          Populate user fields automatically using a URL crawl, copy-pasted text/HTML, or screenshot.
        </p>

        {/* Tab Buttons */}
        <div className="flex border-b border-[var(--color-border-light)] mb-4">
          <button
            type="button"
            onClick={() => { setActiveTab("link"); setAutofillSuccess(null); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "link"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
            LinkedIn URL
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("text"); setAutofillSuccess(null); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "text"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
            Paste Text/HTML
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("image"); setAutofillSuccess(null); }}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "image"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>
            Scan Screenshot/Resume
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === "link" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="input w-full"
                value={form.linkedin_profile_url}
                onChange={(e) => {
                  setForm({ ...form, linkedin_profile_url: e.target.value });
                  setLinkedinHandle(extractLinkedInHandle(e.target.value));
                }}
                placeholder="https://linkedin.com/in/..."
              />
              <button
                type="button"
                onClick={async () => {
                  if (!form.linkedin_profile_url) return;
                  setScraping(true);
                  setAutofillSuccess(null);
                  try {
                    const res = await fetch("/api/admin/scrape", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: form.linkedin_profile_url }),
                    });
                    const data = await res.json();
                    if (data.full_name) {
                      setForm((prev) => ({
                        ...prev,
                        full_name: data.full_name || prev.full_name,
                        company: data.company || prev.company,
                        job_title: data.job_title || prev.job_title,
                      }));
                      setAutofillSuccess(`Autofilled profile for ${data.full_name}`);
                    } else {
                      alert("Could not extract data. LinkedIn may have blocked the request.");
                    }
                  } catch (e) {
                    alert("Scraping failed.");
                  } finally {
                    setScraping(false);
                  }
                }}
                disabled={scraping || !form.linkedin_profile_url}
                className="btn btn-outline whitespace-nowrap text-xs cursor-pointer px-4"
              >
                {scraping ? "Crawling..." : "Crawl"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "text" && (
          <div className="space-y-3">
            <textarea
              className="input w-full"
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste raw profile text, HTML, or unformatted resume content..."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAITextParse}
                disabled={parsingText || !textInput.trim()}
                className="btn btn-primary text-xs px-4 py-2 rounded-full cursor-pointer"
              >
                {parsingText ? "Parsing..." : "AI Parse"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "image" && (
          <div className="space-y-3">
            {!selectedImage ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById("ai-image-upload-admin")?.click()}
                className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--color-primary)] transition-all bg-[var(--color-surface)]"
              >
                <input
                  type="file"
                  id="ai-image-upload-admin"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto text-[var(--color-text-tertiary)] mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-sm font-medium text-[var(--color-text)]">Drag & drop profile screenshot or resume here</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">or click to browse (PNG, JPG, WEBP • Max 5MB)</p>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">
                <div className="relative w-16 h-16 rounded overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] flex items-center justify-center">
                  <img src={selectedImage} alt="Preview" className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-[var(--color-text)]">{imageFile?.name || "Uploaded Image"}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{(imageFile ? imageFile.size / 1024 : 0).toFixed(1)} KB</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedImage(null); setImageFile(null); }}
                    className="btn btn-ghost text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1.5 rounded cursor-pointer"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={handleAIImageScan}
                    disabled={scanningImage}
                    className="btn btn-primary text-xs px-4 py-2 rounded-full cursor-pointer"
                  >
                    {scanningImage ? "Scanning..." : "AI Scan"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {autofillSuccess && (
          <div className="mt-4 p-3 rounded-md bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 text-[var(--color-success)] text-xs font-medium flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {autofillSuccess}
            </span>
            <button type="button" onClick={() => setAutofillSuccess(null)} className="hover:opacity-80 cursor-pointer border-none bg-transparent">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </CollapsibleSection>

      {/* ── 3. Section: Personal Information (Resembling Profile page) ── */}
      <CollapsibleSection icon={PersonIcon} title="Personal Information" defaultOpen>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">
              <span>LinkedIn profile URL</span>
            </label>
            <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-primary)]">
              <span className="bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] text-xs font-semibold px-3 flex items-center border-r border-[var(--color-border-light)] select-none shrink-0">
                https://www.linkedin.com/in/
              </span>
              <input
                className="w-full bg-transparent px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
                value={linkedinHandle}
                placeholder="VaibhavSrivastava777"
                onChange={(e) => handleLinkedInInputChange(e.target.value)}
              />
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Profile photo URL</label>
            <input
              className="input"
              value={form.profile_photo_url}
              placeholder="https://..."
              onChange={(e) => setForm({ ...form, profile_photo_url: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Full name <span className="text-red-500">*</span></label>
            <input
              className="input"
              value={form.full_name}
              required
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Anonymous Alias Name</label>
            <input
              className="input"
              value={form.anonymous_name}
              placeholder="e.g. Neighbour-1234"
              onChange={(e) => setForm({ ...form, anonymous_name: e.target.value })}
            />
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              Used on the local forum feed for anonymous posts.
            </p>
          </div>

          <div>
            <label className="label">Company</label>
            <input
              className="input"
              value={form.company}
              placeholder="Where do they work?"
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Job title</label>
            <input
              className="input"
              value={form.job_title}
              placeholder="e.g. Senior Software Engineer"
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">About (Bio Summary)</label>
            <textarea
              className="input w-full"
              rows={3}
              value={form.about}
              placeholder="Brief summary..."
              onChange={(e) => setForm({ ...form, about: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Professional Bio</label>
            <textarea
              className="input w-full"
              rows={3}
              value={form.professional_bio}
              placeholder="Detailed career bio or resume overview..."
              onChange={(e) => setForm({ ...form, professional_bio: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Skills & Tags (comma separated)</label>
            <input
              className="input w-full"
              value={form.tags.join(", ")}
              placeholder="e.g. #IIM Lucknow, #React, #Product Management"
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                })
              }
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* ── 4. Section: Proximity Locations (Resembling Profile page) ── */}
      <CollapsibleSection icon={MapPinIcon} title="Proximity Locations" defaultOpen>
        <div className="space-y-4">
          <div>
            <label className="label">Default active location</label>
            <select
              className="input w-full py-2 text-xs rounded-lg"
              value={form.active_location}
              onChange={(e) =>
                setForm({ ...form, active_location: e.target.value as typeof form.active_location })
              }
              style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface-secondary)" }}
            >
              <option value="home">Home Location</option>
              <option value="office">Office Location</option>
              <option value="current">Current Location</option>
            </select>
          </div>

          <LocationPicker
            legend="Home location"
            lat={form.home_lat}
            lng={form.home_lng}
            autoCapture={!user}
            onChange={(home_lat, home_lng) => setForm({ ...form, home_lat, home_lng })}
          />

          <LocationPicker
            legend="Office location"
            lat={form.office_lat}
            lng={form.office_lng}
            onChange={(office_lat, office_lng) => setForm({ ...form, office_lat, office_lng })}
          />
        </div>
      </CollapsibleSection>

      {/* ── 5. Section: Admin & Account Controls (ShieldIcon) ── */}
      <CollapsibleSection icon={ShieldIcon} title="Admin & Account Controls" defaultOpen>
        <div className="space-y-4">
          <div>
            <label className="label">Wallet Balance Credits</label>
            <input
              type="number"
              className="input w-full"
              value={form.wallet}
              onChange={(e) => setForm({ ...form, wallet: Number(e.target.value) })}
            />
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              Credit balance for ProxNet AI assistant prompts.
            </p>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
              />
              Active User
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-red-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_blocked}
                onChange={(e) => setForm({ ...form, is_blocked: e.target.checked })}
                className="w-4 h-4 rounded border-red-500 text-red-600 focus:ring-red-500"
              />
              Block User
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── 6. Footer Actions Bar ── */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 mt-2">
        <div>
          {user && (
            <button
              type="button"
              onClick={async () => {
                if (
                  confirm(
                    `Are you sure you want to permanently delete user "${user.full_name}"? This will purge all of their messages, follows, posts, and location details.`
                  )
                ) {
                  try {
                    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
                    if (res.ok) {
                      alert("User deleted successfully.");
                      if (onSuccess) onSuccess();
                      else router.push("/admin");
                      router.refresh();
                    } else {
                      const data = await res.json();
                      alert(`Error deleting user: ${data.error || "unknown"}`);
                    }
                  } catch (e) {
                    alert("Failed to delete user.");
                  }
                }
              }}
              className="btn btn-ghost text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-500/30 text-xs font-semibold px-4 py-2 cursor-pointer"
            >
              Delete User
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onSuccess) onSuccess();
              else router.push("/admin");
            }}
            className="btn btn-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary text-xs px-6 py-2 font-bold"
          >
            {saving ? "Saving..." : user ? "Update User Profile" : "Create User Profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
