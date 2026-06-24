"use client";

import { useState, useEffect } from "react";

interface Props {
  onPosted: () => void;
  onCancel: () => void;
  initialData?: any;
}

export function JobForm({ onPosted, onCancel, initialData }: Props) {
  const [type, setType] = useState<"seeker" | "giver">(initialData?.type || "seeker");
  const [role, setRole] = useState(initialData?.role || "");
  const [company, setCompany] = useState(initialData?.company || "");
  const [experience, setExperience] = useState(initialData?.experience_years?.toString() || "");
  const [skills, setSkills] = useState(initialData?.skills || "");
  const [isOnBehalf, setIsOnBehalf] = useState(initialData?.is_on_behalf || false);
  const [contactNumber, setContactNumber] = useState(initialData?.contact_number || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [previewName, setPreviewName] = useState("You");
  const [initial, setInitial] = useState("Y");

  useEffect(() => {
    fetch("/api/profile")
      .then(res => res.json())
      .then(user => {
        if (user && user.full_name) {
          const firstName = user.full_name.split(" ")[0];
          setPreviewName(firstName);
          setInitial(firstName.charAt(0).toUpperCase());
        }
      })
      .catch(() => {});
  }, []);

  const isEditing = !!initialData?.id;

  // Experience label for preview
  const expLabel = experience ? `${experience} years exp` : "";

  // Build preview text
  const previewAction = type === "seeker" ? "looking for" : "referring for";
  const previewRole = role || "a role";
  const previewCompany = type === "giver" && company ? ` at ${company}` : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) return;
    setLoading(true);
    setError("");

    try {
      const method = isEditing ? "PATCH" : "POST";
      const bodyPayload: any = {
        type,
        role,
        company: type === "giver" ? company : "",
        experience_years: experience,
        skills,
        is_on_behalf: isOnBehalf,
        contact_number: contactNumber,
      };
      if (isEditing) bodyPayload.id = initialData.id;

      const res = await fetch("/api/jobs/post", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post");
      }

      onPosted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-xl mx-auto p-0 animate-scaleIn overflow-hidden border border-[var(--color-border-light)] shadow-lg relative">
      {/* Header */}
      <div className="bg-[var(--color-surface-secondary)] p-4 flex justify-between items-center border-b border-[var(--color-border-light)]">
        <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.896 1.982-2.007 1.982H5.757c-1.111 0-2.007-.888-2.007-1.982v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v3.896m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          {isEditing ? "Edit Post" : "Quick Post"}
        </h2>
        <button onClick={onCancel} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-5 md:p-6 bg-[var(--color-surface)] space-y-5">
        {error && (
          <div className="p-3 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Chat Bubble Preview */}
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
            {initial}
          </div>
          <div className={`p-4 rounded-2xl rounded-tl-sm text-sm border shadow-sm ${type === "giver" ? "bg-accent/5 border-accent/20" : "bg-primary/5 border-primary/20"}`}>
            <span className="font-semibold text-[var(--color-text)]">{previewName}</span>
            {" "}
            {type === "seeker" ? "are" : "are"}{" "}
            <strong>{previewAction}</strong>{" "}
            <span className="font-medium text-[var(--color-text)]">{previewRole}</span>
            <span className="font-medium text-[var(--color-text)]">{previewCompany}</span>.
            {expLabel && <> <span className="text-[var(--color-text-secondary)]">{expLabel}.</span></>}
            {skills && (
              <span className="text-[var(--color-text-secondary)]">
                {" "}Skills: {skills.split(",").slice(0, 3).map((s: string) => s.trim()).filter(Boolean).map((s: string) => `#${s}`).join(" ")}
                {skills.split(",").length > 3 ? " ..." : ""}
              </span>
            )}
            {isOnBehalf && <span className="text-[var(--color-text-tertiary)]"> (on behalf)</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Toggle + Experience */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">I am</span>
              <div className="flex bg-[var(--color-surface-secondary)] p-1 rounded-lg">
                <button type="button" onClick={() => setType("seeker")} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${type === "seeker" ? "bg-[var(--color-surface)] shadow-sm text-primary" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>
                  Looking 🔍
                </button>
                <button type="button" onClick={() => setType("giver")} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${type === "giver" ? "bg-[var(--color-surface)] shadow-sm text-accent" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>
                  Referring 🤝
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Experience</span>
              <select
                className="input h-[42px] text-sm"
                value={experience}
                onChange={e => setExperience(e.target.value)}
                required
              >
                <option value="">Select...</option>
                <option value="1">0-2 years (Entry)</option>
                <option value="3">3-5 years (Mid)</option>
                <option value="6">5-8 years (Senior)</option>
                <option value="10">8+ years (Lead)</option>
              </select>
            </div>
          </div>

          {/* Role + Company (for referrer) */}
          <div className={type === "giver" ? "grid grid-cols-2 gap-3" : ""}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                {type === "seeker" ? "Target Role" : "Hiring Role"}
              </span>
              <input
                required
                className="input text-sm"
                placeholder="e.g. Senior Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            {type === "giver" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Company</span>
                <input
                  required
                  className="input text-sm"
                  placeholder="e.g. Google"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Key Skills</span>
            <input
              required
              className="input text-sm"
              placeholder="e.g. React, Node.js, TypeScript"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>

          {/* On-behalf */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-secondary)]">
            <input
              type="checkbox"
              id="onBehalf"
              checked={isOnBehalf}
              onChange={e => setIsOnBehalf(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary"
            />
            <label htmlFor="onBehalf" className="text-sm text-[var(--color-text-secondary)] cursor-pointer">
              Posting on behalf of someone? (share their WhatsApp)
            </label>
          </div>

          {isOnBehalf && (
            <div className="flex flex-col gap-1.5 animate-fadeIn">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">WhatsApp Number</span>
              <input
                required
                type="tel"
                className="input text-sm"
                placeholder="e.g. +919876543210"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`btn w-full btn-lg ${type === "giver" ? "btn-accent" : "btn-primary"} disabled:opacity-50 mt-2`}
          >
            {loading ? "Posting..." : isEditing ? "Update Post" : "Shout to Group"}
          </button>
        </form>
      </div>
    </div>
  );
}
