"use client";

import { useState, useEffect } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";

function formatDateForInput(isoStr?: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function EventFormModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialData
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}) {
  const isEditing = !!initialData?.id;

  const [title, setTitle] = useState(initialData?.title || "");
  const [subtitle, setSubtitle] = useState(initialData?.subtitle || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [startsAt, setStartsAt] = useState(formatDateForInput(initialData?.starts_at) || "");
  const [endsAt, setEndsAt] = useState(formatDateForInput(initialData?.ends_at) || "");
  const [venueName, setVenueName] = useState(initialData?.venue_name || "");
  const [venueCoords, setVenueCoords] = useState<{lat: number, lng: number} | null>(
    initialData?.venue_lat && initialData?.venue_lng ? { lat: initialData.venue_lat, lng: initialData.venue_lng } : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite states
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search based on name");

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setSubtitle(initialData.subtitle || "");
      setDescription(initialData.description || "");
      setStartsAt(formatDateForInput(initialData.starts_at));
      setEndsAt(formatDateForInput(initialData.ends_at));
      setVenueName(initialData.venue_name || "");
      if (initialData.venue_lat && initialData.venue_lng) {
        setVenueCoords({ lat: initialData.venue_lat, lng: initialData.venue_lng });
      }
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
        const res = await fetch(`/api/events/00000000-0000-0000-0000-000000000000/search-users?q=${encodeURIComponent(inviteQuery)}`);
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
    if (!title || !startsAt || !endsAt || !venueName || !venueCoords) {
      alert("Please fill out all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/events/${initialData.id}` : "/api/events";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          description,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          venueName,
          venueLat: venueCoords.lat,
          venueLng: venueCoords.lng,
          centerLat: venueCoords.lat,
          centerLng: venueCoords.lng,
          isPublic: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const eventId = isEditing ? initialData.id : data.event?.id;
        
        // Send invites if any selected
        if (selectedInvitees.size > 0 && eventId) {
          await fetch(`/api/events/${eventId}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: Array.from(selectedInvitees) })
          });
        }

        if (!isEditing) {
          setTitle("");
          setSubtitle("");
          setDescription("");
          setStartsAt("");
          setEndsAt("");
          setVenueName("");
          setVenueCoords(null);
          setInviteQuery("");
          setSelectedInvitees(new Set());
        }
        onSuccess();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || `Failed to ${isEditing ? "update" : "create"} event.`);
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
            {isEditing ? "Edit Meetup" : "Create Meetup Event"}
          </h3>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 overscroll-contain">
          <form id="event-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Event Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bi-weekly Professional Tech Meetup"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Discussing AI, Startups & Career Growth"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide event details, agenda, target audience, or prerequisites..."
                rows={3}
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none resize-none bg-[var(--color-surface)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Starts At *</label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Ends At</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Venue Name / Location *</label>
              <LocationAutocomplete
                value={venueName}
                onChange={(val) => setVenueName(val)}
                onSelect={(loc: any) => {
                  setVenueName(loc.name);
                  setVenueCoords({ lat: loc.lat, lng: loc.lng });
                }}
                placeholder="e.g. Third Wave Coffee, HSR Sector 6"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Pin Map Location (Optional)</label>
              <LocationPicker
                legend="Venue location Pin"
                lat={venueCoords?.lat?.toString() || ""}
                lng={venueCoords?.lng?.toString() || ""}
                onChange={(latStr, lngStr) => setVenueCoords({ lat: Number(latStr), lng: Number(lngStr) })}
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
            form="event-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[#E56B42] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer border-none"
          >
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Meetup"}
          </button>
        </div>
      </div>
    </div>
  );
}
