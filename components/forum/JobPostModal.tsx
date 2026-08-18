"use client";

import { useState, useEffect } from "react";

export function JobPostModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialData,
  locationMode = "home",
  profile
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
  locationMode?: "home" | "office" | "current";
  profile?: any;
}) {
  const isEditing = !!initialData?.id;

  const [type, setType] = useState<"seeker" | "giver">(initialData?.type || "seeker");
  const [role, setRole] = useState(initialData?.role || "");
  const [company, setCompany] = useState(initialData?.company || "");
  const [experienceYears, setExperienceYears] = useState(initialData?.experience_years || "");
  const [skills, setSkills] = useState(initialData?.skills || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [contactInfo, setContactInfo] = useState(initialData?.contact_info || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite states
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search based on name");

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || "seeker");
      setRole(initialData.role || "");
      setCompany(initialData.company || "");
      setExperienceYears(initialData.experience_years || "");
      setSkills(initialData.skills || "");
      setDescription(initialData.description || "");
      setContactInfo(initialData.contact_info || "");
    }
  }, [initialData]);

  useEffect(() => {
    const terms = ["name", "company", "designation"];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % terms.length;
      setSearchPlaceholder(`Search based on ${terms[i]}`);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (inviteQuery.length < 2) {
      setInviteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/job-posts/00000000-0000-0000-0000-000000000000/search-users?q=${encodeURIComponent(inviteQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setInviteResults(data.users || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery]);

  const toggleInvitee = (userId: string) => {
    const next = new Set(selectedInvitees);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedInvitees(next);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      alert("Please fill out the role title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/job-posts/${initialData.id}` : "/api/job-posts";
      const method = isEditing ? "PATCH" : "POST";

      let centerLat = initialData?.center_lat || 28.6139;
      let centerLng = initialData?.center_lng || 77.2090;

      if (!isEditing) {
        const profileRes = await fetch("/api/profile");
        const profile = await profileRes.json();
        centerLat = profile?.home_lat || 28.6139;
        centerLng = profile?.home_lng || 77.2090;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          role,
          company,
          experienceYears,
          skills,
          description,
          contactInfo,
          centerLat,
          centerLng,
          isPublic: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const jobPostId = isEditing ? initialData.id : data.jobPost?.id;

        // Send invites if selected
        if (selectedInvitees.size > 0 && jobPostId) {
          await fetch(`/api/job-posts/${jobPostId}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: Array.from(selectedInvitees) })
          });
        }

        if (!isEditing) {
          setRole("");
          setCompany("");
          setExperienceYears("");
          setSkills("");
          setDescription("");
          setContactInfo("");
          setInviteQuery("");
          setSelectedInvitees(new Set());
        }
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Failed to ${isEditing ? "update" : "create"} job post.`);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[1000] overflow-y-auto px-4 py-8 sm:p-8 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-start sm:justify-center animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--color-surface)] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[75vh] max-h-[75dvh] shrink-0 border border-[var(--color-border)] relative"
      >
        <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center shrink-0 bg-[var(--color-surface)]">
          <h3 className="text-h3 font-bold text-[var(--color-text)]">
            {isEditing ? "Edit Job Post" : "Create Job Post"}
          </h3>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 overscroll-contain">
          <form id="job-post-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Type selector toggle */}
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">I want to *</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-light)]">
                <button
                  type="button"
                  onClick={() => setType("seeker")}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    type === "seeker"
                      ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  🔍 Look for a Role
                </button>
                <button
                  type="button"
                  onClick={() => setType("giver")}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    type === "giver"
                      ? "bg-[var(--color-surface)] text-emerald-600 shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  📢 Hire / Refer
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Role Title *</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={type === "seeker" ? "e.g. Senior Product Manager" : "e.g. Lead Frontend Engineer"}
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Google, Startup, Remote"
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Experience</label>
                <input
                  type="text"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 5+ years"
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Key Skills</label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. React, Node.js, Python, System Design"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={type === "seeker" ? "Describe your background, what you're looking for, or notice period..." : "Describe the job responsibilities, team, requirements, or referral process..."}
                rows={3}
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none resize-none bg-[var(--color-surface)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Contact Info (Optional)</label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="e.g. Email or WhatsApp number for direct reachout"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div className="pt-2 border-t border-[var(--color-border-light)]">
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">Invite People (Optional)</label>
              <div className="relative mb-2">
                <input
                  type="text"
                  value={inviteQuery}
                  onChange={(e) => setInviteQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)] transition-all duration-300"
                />
              </div>

              {inviteQuery.length > 0 && (
                <div className="bg-[var(--color-surface-secondary)]/50 rounded-lg max-h-[150px] overflow-y-auto p-2">
                  {isSearching ? (
                    <div className="text-center p-2 text-sm text-[var(--color-text-tertiary)]">Searching...</div>
                  ) : inviteResults.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {inviteResults.map(user => (
                        <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-[var(--color-surface-hover)] rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedInvitees.has(user.id)}
                            onChange={() => toggleInvitee(user.id)}
                            className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <div className="w-6 h-6 rounded-full bg-[var(--color-border)] overflow-hidden shrink-0 flex items-center justify-center font-bold text-[var(--color-text-secondary)] text-[10px]">
                            {user.profile_photo_url ? (
                              <img src={user.profile_photo_url} alt={user.full_name} className="w-full h-full object-cover" />
                            ) : (
                              user.full_name?.substring(0, 2).toUpperCase() || "U"
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[var(--color-text)]">{user.full_name}</span>
                            {(user.job_title || user.company) && (
                              <span className="text-[10px] text-[var(--color-text-tertiary)] truncate max-w-[150px]">
                                {user.job_title} @ {user.company}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : inviteQuery.length > 1 ? (
                    <div className="text-center p-2 text-sm text-[var(--color-text-tertiary)]">No users found.</div>
                  ) : null}
                </div>
              )}
              {selectedInvitees.size > 0 && (
                <div className="text-xs text-[var(--color-primary)] mt-1 font-semibold">
                  {selectedInvitees.size} person(s) selected for invitation
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface)] shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="job-post-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer border-none"
          >
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Post Job Opportunity"}
          </button>
        </div>
      </div>
    </div>
  );
}
