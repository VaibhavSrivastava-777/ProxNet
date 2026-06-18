"use client";

import { useState, useEffect } from "react";

interface Props {
  onPosted: () => void;
}

export function JobForm({ onPosted }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"seeker" | "giver">("seeker");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [contactNumber, setContactNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const handleEdit = (e: any) => {
      const post = e.detail;
      setIsOpen(true);
      setIsEditing(true);
      setEditId(post.id);
      setType(post.type);
      setRole(post.role || "");
      setCompany(post.company || "");
      setExperience(post.experience_years?.toString() || "");
      setSkills(post.skills || "");
      setIsOnBehalf(post.is_on_behalf || false);
      setContactNumber(post.contact_number || "");
    };
    window.addEventListener("editJobPost", handleEdit);
    return () => window.removeEventListener("editJobPost", handleEdit);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const method = isEditing ? "PATCH" : "POST";
    const bodyPayload: any = {
      type,
      role,
      company,
      experience_years: experience,
      skills,
      is_on_behalf: isOnBehalf,
      contact_number: contactNumber
    };
    if (isEditing && editId) {
      bodyPayload.id = editId;
    }

    const res = await fetch("/api/jobs/post", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });

    setLoading(false);
    if (res.ok) {
      setIsSuccess(true);
      setMessage(`Successfully ${isEditing ? "updated" : "posted"} as a ${type === "seeker" ? "Candidate" : "Referrer"}!`);
      setIsOpen(false);
      setIsEditing(false);
      setEditId(null);
      onPosted();
    } else {
      setIsSuccess(false);
      setMessage("Failed to post.");
    }
    
    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="card p-6 sticky top-24">
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left focus:outline-none"
      >
        <h3 className="text-h3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.896 1.982-2.007 1.982H5.757c-1.111 0-2.007-.888-2.007-1.982v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v3.896m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          Post a Job or Referral
        </h3>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" viewBox="0 0 24 24" 
          strokeWidth={2} stroke="currentColor" 
          className={`w-5 h-5 text-text-tertiary transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-6 animate-fadeIn">
          <div className="flex gap-2 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === "seeker" 
                  ? "bg-[var(--color-primary)] text-white shadow-sm" 
                  : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]"
              }`}
              onClick={() => setType("seeker")}
            >
              I'm Looking (Seeker)
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === "giver" 
                  ? "bg-[var(--color-accent)] text-white shadow-sm" 
                  : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]"
              }`}
              onClick={() => setType("giver")}
            >
              I'm Referring (Giver)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{type === "seeker" ? "Target Role" : "Hiring Role"}</label>
              <input
                required
                className="input"
                placeholder="e.g. Senior Frontend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            {type === "giver" && (
              <div>
                <label className="label">Hiring Company</label>
                <input
                  required
                  className="input"
                  placeholder="e.g. Google"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label">Experience (Years)</label>
              <input
                required
                type="number"
                min="0"
                max="50"
                className="input"
                placeholder="e.g. 5"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Key Skills (Comma separated)</label>
              <input
                required
                className="input"
                placeholder="e.g. React, Node.js, Typescript"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input 
                type="checkbox" 
                id="isOnBehalf"
                checked={isOnBehalf}
                onChange={e => setIsOnBehalf(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary"
              />
              <label htmlFor="isOnBehalf" className="text-sm font-medium text-[var(--color-text)]">
                Posting on behalf of someone else?
              </label>
            </div>

            {isOnBehalf && (
              <div className="animate-fadeIn">
                <label className="label">Their Contact Number (for WhatsApp)</label>
                <input
                  required
                  type="tel"
                  className="input"
                  placeholder="e.g. +919876543210"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                />
              </div>
            )}

            {isEditing ? (
              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={loading} className={`btn btn-primary flex-1 ${loading ? "opacity-50 cursor-not-allowed bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] border-transparent hover:bg-[var(--color-surface-hover)]" : ""}`}>
                  {loading ? <span className="spinner-sm" /> : "Update Post"}
                </button>
                <button type="button" onClick={() => { setIsOpen(false); setIsEditing(false); setEditId(null); }} className="btn btn-secondary text-text-tertiary">
                  Skip
                </button>
              </div>
            ) : (
              <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
                {loading ? <span className="spinner-sm" /> : `Post as ${type === "seeker" ? "Seeker" : "Giver"}`}
              </button>
            )}
          </form>
        </div>
      )}

      {message && (
        <div className={`alert ${isSuccess ? "alert-success" : "alert-error"} mt-4 animate-fadeIn`}>
          {message}
        </div>
      )}
    </div>
  );
}
