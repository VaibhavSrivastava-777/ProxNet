"use client";

import { useState, useEffect } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";

export function EventFormModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueCoords, setVenueCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite states
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search based on name");

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
        // We use a general users search if possible, but /api/events/[id]/search-users doesn't actually require the event ID structurally for searching users
        // Let's call /api/events/00000000-0000-0000-0000-000000000000/search-users as a workaround since the ID is ignored in the handler
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
      const res = await fetch("/api/events", {
        method: "POST",
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
          centerLat: venueCoords.lat, // defaults to venue
          centerLng: venueCoords.lng,
          isPublic: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Send invites if any selected
        if (selectedInvitees.size > 0 && data.event?.id) {
          await fetch(`/api/events/${data.event.id}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: Array.from(selectedInvitees) })
          });
        }

        setTitle("");
        setSubtitle("");
        setDescription("");
        setStartsAt("");
        setEndsAt("");
        setVenueName("");
        setVenueCoords(null);
        setInviteQuery("");
        setSelectedInvitees(new Set());
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create event.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--color-surface)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center shrink-0">
          <h3 className="text-h3 font-bold text-[var(--color-text)]">Create Meetup</h3>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1">
          <form id="event-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Event Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekend Professional Meetup"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Casual networking over coffee"
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Start Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">End Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Venue Name *</label>
              <LocationAutocomplete
                value={venueName}
                onChange={setVenueName}
                onSelect={(sel) => {
                  setVenueName(sel.name);
                  setVenueCoords({ lat: sel.lat, lng: sel.lng });
                }}
                placeholder="Search venue or e.g. Starbucks, Indiranagar"
              />
              <div className="mt-3">
                <LocationPicker
                  legend="Pinpoint Venue Location *"
                  lat={venueCoords?.lat.toString() || ""}
                  lng={venueCoords?.lng.toString() || ""}
                  onChange={(lat, lng) => setVenueCoords({ lat: parseFloat(lat), lng: parseFloat(lng) })}
                  defaultShowMap={true}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the agenda? Who should attend?"
                rows={4}
                className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none resize-none bg-[var(--color-surface)]"
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
                              user.full_name.substring(0, 2).toUpperCase()
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

        <div className="p-4 border-t border-[var(--color-border-light)] shrink-0 flex justify-end gap-3">
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
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Meetup"}
          </button>
        </div>
      </div>
    </div>
  );
}
