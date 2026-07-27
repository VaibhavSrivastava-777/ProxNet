"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EventCard({ event, onRsvpUpdate, currentUserId }: { event: any, onRsvpUpdate: () => void, currentUserId?: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse attendees
  const rsvps = event.rsvps || [];
  const going = rsvps.filter((r: any) => r.status === "yes").length;
  const maybe = rsvps.filter((r: any) => r.status === "maybe").length;
  
  const myRsvp = rsvps.find((r: any) => r.user_id === currentUserId)?.status;

  const handleRsvp = async (e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    if (!currentUserId) {
      alert("You must be logged in to RSVP.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        onRsvpUpdate();
      } else {
        alert("Failed to update RSVP.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.id}`;
    if (navigator.share) {
      navigator.share({ title: event.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert("Event link copied to clipboard!");
    }
  };

  // Format date and time
  const startObj = new Date(event.starts_at);
  const endObj = new Date(event.ends_at);
  const dateStr = startObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  const timeStr = `${startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  return (
    <div 
      onClick={() => router.push(`/event/${event.id}`)}
      className="card p-5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3 relative overflow-hidden"
    >
      {/* Date badge */}
      <div className="absolute top-0 right-0 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] px-3 py-1 rounded-bl-xl text-xs font-bold shadow-sm">
        MEETUP
      </div>

      <div className="flex flex-col gap-1 pr-16">
        <span className="text-xs font-bold text-[#E56B42] tracking-wide">{dateStr} · {timeStr}</span>
        <h3 className="text-lg font-bold text-[var(--color-text)] leading-tight">{event.title}</h3>
        {event.subtitle && <p className="text-sm font-medium text-[var(--color-text-secondary)]">{event.subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mt-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span className="truncate">{event.venue_name}</span>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="flex -space-x-2">
          {/* Avatar placeholders based on count */}
          {Array.from({ length: Math.min(going, 3) }).map((_, i) => (
            <div key={i} className="w-6 h-6 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-border)]" />
          ))}
        </div>
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {going} going {maybe > 0 && `· ${maybe} maybe`}
        </span>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border-light)]">
        <div className="flex gap-2">
          <button 
            disabled={isSubmitting}
            onClick={(e) => handleRsvp(e, "yes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${myRsvp === "yes" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"}`}
          >
            ✓ Yes
          </button>
          <button 
            disabled={isSubmitting}
            onClick={(e) => handleRsvp(e, "maybe")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${myRsvp === "maybe" ? "bg-[var(--color-border)] text-[var(--color-text)]" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"}`}
          >
            ? Maybe
          </button>
        </div>
        
        <button 
          onClick={handleShare}
          className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors rounded-lg hover:bg-[var(--color-primary-subtle)]"
          title="Share Event"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      
      {/* Creator Info */}
      <div className="text-[10px] text-[var(--color-text-tertiary)] text-right mt-1">
        Hosted by {event.creator?.full_name}
      </div>
    </div>
  );
}
