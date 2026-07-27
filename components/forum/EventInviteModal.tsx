"use client";

import { useState, useEffect } from "react";

export function EventInviteModal({ 
  eventId,
  isOpen, 
  onClose,
  eventTitle
}: { 
  eventId: string;
  isOpen: boolean; 
  onClose: () => void;
  eventTitle: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedUsers(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/events/${eventId}/search-users?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.users || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, eventId]);

  const toggleUser = (userId: string) => {
    const next = new Set(selectedUsers);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUsers(next);
  };

  const handleSendInvites = async () => {
    if (selectedUsers.size === 0) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedUsers) })
      });
      if (res.ok) {
        alert("Invites sent successfully!");
        onClose();
      } else {
        alert("Failed to send invites.");
      }
    } catch (err) {
      alert("Error sending invites.");
    } finally {
      setIsSending(false);
    }
  };

  const shareWhatsApp = () => {
    const text = `Join me at "${eventTitle}"\n${window.location.origin}/event/${eventId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--color-surface)] rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center shrink-0">
          <h3 className="text-h3 font-bold text-[var(--color-text)]">Invite People</h3>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/30">
          <button 
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share via WhatsApp
          </button>
        </div>

        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Or invite ProxNet members directly</label>
          <div className="relative mb-3 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">@</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or company..."
              className="input w-full pl-8 p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-[150px]">
            {isSearching ? (
              <div className="text-center p-4 text-sm text-[var(--color-text-tertiary)]">Searching...</div>
            ) : results.length > 0 ? (
              <div className="flex flex-col gap-2">
                {results.map(user => (
                  <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-[var(--color-surface-hover)] rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <div className="w-8 h-8 rounded-full bg-[var(--color-border)] overflow-hidden shrink-0">
                      {user.profile_photo_url ? (
                        <img src={user.profile_photo_url} alt={user.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-[var(--color-text-secondary)] text-xs">
                          {user.full_name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[var(--color-text)]">{user.full_name}</span>
                      {(user.job_title || user.company) && (
                        <span className="text-xs text-[var(--color-text-tertiary)] truncate max-w-[200px]">
                          {user.job_title} @ {user.company}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : query.length > 1 ? (
              <div className="text-center p-4 text-sm text-[var(--color-text-tertiary)]">No users found.</div>
            ) : (
              <div className="text-center p-4 text-sm text-[var(--color-text-tertiary)]">Type to search professionals nearby...</div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--color-border-light)] shrink-0">
          <button
            onClick={handleSendInvites}
            disabled={selectedUsers.size === 0 || isSending}
            className="w-full py-3 rounded-xl font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSending ? "Sending..." : `Send ${selectedUsers.size > 0 ? selectedUsers.size : ''} Invites`}
          </button>
        </div>
      </div>
    </div>
  );
}
