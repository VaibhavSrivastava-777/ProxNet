"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import type { User } from "@/lib/types";

interface Props {
  user?: User;
  onSuccess?: () => void;
}

const emptyUser = {
  full_name: "",
  email: "",
  company: "",
  job_title: "",
  profile_photo_url: "",
  linkedin_profile_url: "",
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
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

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
      }));

      setAutofillSuccess(
        data.full_name
          ? `Autofilled profile for ${data.full_name} using AI text parsing!`
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
      }));

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

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      {/* Smart Import & Autofill Panel */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-5 mb-6 shadow-sm">
        <h2 className="text-lg mb-3 flex items-center gap-2 font-semibold text-[var(--color-text)]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[var(--color-primary)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.982-11.795M20.625 3c-.72 0-1.353.447-1.625 1.096L17.25 8.5M20.625 3c.72 0 1.353.447 1.625 1.096L20.5 8.5m-3.25 0h6.5m-6.5 0L14.25 14M20.5 8.5L17.25 14" />
          </svg>
          Smart Import & Autofill
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          Populate user fields automatically using a URL crawl, copy-pasted text/HTML, or screenshot.
        </p>

        {/* Tab Buttons */}
        <div className="flex border-b border-[var(--color-border-light)] mb-4">
          <button
            type="button"
            onClick={() => { setActiveTab("link"); setAutofillSuccess(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.linkedin_profile_url}
                onChange={(e) => setForm({ ...form, linkedin_profile_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
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
                className="btn btn-outline whitespace-nowrap text-sm cursor-pointer"
              >
                {scraping ? "Crawling..." : "Crawl"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "text" && (
          <div className="space-y-3">
            <textarea
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              rows={4}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste raw profile text, HTML, or unformatted resume content..."
              style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAITextParse}
                disabled={parsingText || !textInput.trim()}
                className="btn btn-primary text-sm px-4 py-2 rounded-full cursor-pointer"
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
                onClick={() => document.getElementById("ai-image-upload")?.click()}
                className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--color-primary)] transition-all bg-[var(--color-surface)]"
              >
                <input
                  type="file"
                  id="ai-image-upload"
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
                    className="btn btn-primary text-sm px-4 py-2 rounded-full cursor-pointer"
                  >
                    {scanningImage ? "Scanning..." : "AI Scan"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Autofill Toast Message */}
        {autofillSuccess && (
          <div className="mt-4 p-3 rounded-md bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 text-[var(--color-success)] text-xs font-medium flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {autofillSuccess}
            </span>
            <button type="button" onClick={() => setAutofillSuccess(null)} className="hover:opacity-80 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {[
        ["full_name", "Full name"],
        ["email", "Email"],
        ["company", "Company"],
        ["job_title", "Job title"],
        ["profile_photo_url", "Profile photo URL"],
        ["linkedin_profile_url", "LinkedIn profile URL"],
      ].map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="font-medium">{label}</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form[key as keyof typeof form] as string}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            required={key === "full_name"}
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          />
        </label>
      ))}

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

      <label className="block text-sm">
        <span className="font-medium">Default location</span>
        <select
          className="mt-1 block w-full rounded border px-3 py-2"
          value={form.active_location}
          onChange={(e) =>
            setForm({ ...form, active_location: e.target.value as typeof form.active_location })
          }
        >
          <option value="home">Home</option>
          <option value="office">Office</option>
          <option value="current">Current</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        Active
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold text-red-600">
        <input
          type="checkbox"
          checked={form.is_blocked}
          onChange={(e) => setForm({ ...form, is_blocked: e.target.checked })}
        />
        Block User
      </label>

      <label className="block text-sm">
        <span className="font-medium">About</span>
        <textarea
          className="mt-1 w-full rounded border px-3 py-2"
          rows={3}
          value={form.about}
          onChange={(e) => setForm({ ...form, about: e.target.value })}
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Professional Bio</span>
        <textarea
          className="mt-1 w-full rounded border px-3 py-2"
          rows={3}
          value={form.professional_bio}
          onChange={(e) => setForm({ ...form, professional_bio: e.target.value })}
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Wallet Balance</span>
        <input
          type="number"
          className="mt-1 w-full rounded border px-3 py-2"
          value={form.wallet}
          onChange={(e) => setForm({ ...form, wallet: Number(e.target.value) })}
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Tags (comma separated)</span>
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={form.tags.join(", ")}
          onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
      </label>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="flex justify-between items-center pt-4 border-t border-[var(--color-border-light)] mt-6">
        <div>
          {user && (
            <button
              type="button"
              onClick={async () => {
                if (confirm(`Are you sure you want to permanently delete user "${user.full_name}"? This will purge all of their messages, follows, posts, and location details.`)) {
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
              style={{ backgroundColor: "transparent", color: "var(--color-error, #dc2626)", border: "1px solid var(--color-error, #dc2626)", cursor: "pointer", padding: "8px 16px", borderRadius: "var(--radius-md, 8px)", fontSize: "14px" }}
            >
              Delete user
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? "Saving..." : user ? "Update user" : "Create user"}
          </button>
        </div>
      </div>
    </form>
  );
}
