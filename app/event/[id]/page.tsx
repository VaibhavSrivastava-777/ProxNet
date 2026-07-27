"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";

import { EventInviteModal } from "@/components/forum/EventInviteModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  // Try fetching current user session to see if logged in
  const { data: profile } = useSWR("/api/profile", fetcher, { 
    errorRetryCount: 0,
    shouldRetryOnError: false 
  });
  
  const { data, error, isLoading, mutate } = useSWR(`/api/events/${resolvedParams.id}`, fetcher);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="skeleton h-64 w-full max-w-2xl rounded-xl"></div>
      </div>
    );
  }

  if (error || !data || data.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-4">
        <h1 className="text-h2 font-bold text-[var(--color-text)]">Event Not Found</h1>
        <p className="text-body text-[var(--color-text-secondary)] mt-2">This event may have been deleted or is private.</p>
        <button onClick={() => router.push("/")} className="btn btn-primary mt-6">Go Home</button>
      </div>
    );
  }

  const { event, userRsvp, isAdmin, isCreator } = data;
  const isLoggedIn = !!profile && !profile.error;
  
  const rsvps = event.rsvps || [];
  const going = rsvps.filter((r: any) => r.status === "yes");
  const maybe = rsvps.filter((r: any) => r.status === "maybe");

  const handleRsvp = async (status: string) => {
    if (!isLoggedIn) {
      // Redirect to login with callback
      const cb = encodeURIComponent(`/event/${event.id}`);
      router.push(`/login?callbackUrl=${cb}`);
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
        mutate();
      } else {
        alert("Failed to RSVP.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startObj = new Date(event.starts_at);
  const endObj = new Date(event.ends_at);
  const dateStr = startObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeStr = `${startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      {/* Header Image / Pattern Area */}
      <div className="h-48 w-full bg-gradient-to-br from-[var(--color-primary-subtle)] to-[var(--color-primary)] opacity-80" />
      
      <div className="max-w-3xl mx-auto px-4 -mt-24 relative z-10">
        {/* Main Event Card */}
        <div className="card bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border-light)] p-6 md:p-8 flex flex-col gap-6">
          
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex flex-col gap-2 flex-1">
              <span className="text-sm font-bold text-[#E56B42] uppercase tracking-wider">{dateStr}</span>
              <h1 className="text-3xl md:text-4xl font-black text-[var(--color-text)] leading-tight">{event.title}</h1>
              {event.subtitle && <p className="text-lg text-[var(--color-text-secondary)] font-medium mt-1">{event.subtitle}</p>}
            </div>
            
            <div className="shrink-0 flex flex-col items-center justify-center bg-[var(--color-surface-secondary)] p-4 rounded-xl min-w-[120px] border border-[var(--color-border)] shadow-inner">
              <span className="text-xs text-[var(--color-text-tertiary)] uppercase font-bold tracking-wider mb-1">Time</span>
              <span className="text-lg font-bold text-[var(--color-text)]">{startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 py-6 border-y border-[var(--color-border-light)]">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-xl">📍</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--color-text)]">{event.venue_name}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">Location</span>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-xl">👤</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--color-text)]">{event.creator?.full_name}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Hosted by {event.creator?.job_title} @ {event.creator?.company}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h3 font-bold text-[var(--color-text)]">About this Meetup</h3>
              {isLoggedIn && (
                <button 
                  onClick={() => setIsInviteOpen(true)}
                  className="px-4 py-2 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold rounded-lg text-sm hover:opacity-80 transition-opacity"
                >
                  + Invite People
                </button>
              )}
            </div>
            <p className="text-body text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {event.description || "No additional details provided."}
            </p>
          </div>
          
        </div>

        {/* Attendee List */}
        <div className="mt-6 card bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-6">
          <h3 className="text-h3 font-bold text-[var(--color-text)] mb-4">
            Attendees ({going.length} going{maybe.length > 0 ? `, ${maybe.length} maybe` : ''})
          </h3>
          
          {going.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] italic">Be the first to RSVP!</p>
          ) : (
            <div className="flex flex-col gap-4">
              {going.slice(0, 5).map((r: any) => (
                <div key={r.user.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-border)] overflow-hidden shrink-0">
                    {r.user.profile_photo_url ? (
                      <img src={r.user.profile_photo_url} alt={r.user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-[var(--color-text-secondary)] text-sm">
                        {r.user.full_name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--color-text)] text-sm">{r.user.full_name}</div>
                    {(r.user.job_title || r.user.company) && (
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {r.user.job_title} {r.user.company ? `@ ${r.user.company}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {going.length > 5 && (
                <button className="text-sm font-bold text-[var(--color-primary)] mt-2 hover:underline self-start">
                  See all {going.length} attendees
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar for RSVP */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border-light)] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] p-4 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          
          <div className="hidden sm:flex flex-col shrink-0">
            <span className="font-bold text-[var(--color-text)]">{event.title}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">{dateStr}</span>
          </div>

          {!isLoggedIn ? (
            <button 
              onClick={() => handleRsvp("yes")}
              className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-[var(--color-primary)] text-white hover:opacity-90 shadow-md text-sm transition-all"
            >
              Join ProxNet to RSVP
            </button>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button 
                disabled={isSubmitting}
                onClick={() => handleRsvp("yes")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all ${userRsvp === "yes" ? "bg-[var(--color-primary)] text-white shadow-md" : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]"}`}
              >
                {userRsvp === "yes" ? "✓ Going" : "Yes"}
              </button>
              <button 
                disabled={isSubmitting}
                onClick={() => handleRsvp("maybe")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all ${userRsvp === "maybe" ? "bg-[var(--color-border)] text-[var(--color-text)] shadow-sm" : "bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]"}`}
              >
                {userRsvp === "maybe" ? "✓ Maybe" : "Maybe"}
              </button>
              <button 
                disabled={isSubmitting}
                onClick={() => handleRsvp("no")}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all ${userRsvp === "no" ? "bg-red-500/10 text-red-600 border border-red-500/20" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]"}`}
              >
                {userRsvp === "no" ? "Not Going" : "No"}
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoggedIn && event && (
        <EventInviteModal 
          isOpen={isInviteOpen} 
          onClose={() => setIsInviteOpen(false)} 
          eventId={event.id} 
          eventTitle={event.title} 
        />
      )}
    </div>
  );
}
