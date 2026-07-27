"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";

import { EventInviteModal } from "@/components/forum/EventInviteModal";
import { EventFormModal } from "@/components/forum/EventFormModal";

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
  const [isEditOpen, setIsEditOpen] = useState(false);

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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this Meetup event?")) return;
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/?tab=forum");
      } else {
        alert("Failed to delete event.");
      }
    } catch (err) {
      console.error(err);
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#E56B42] uppercase tracking-wider">{dateStr}</span>
                {isCreator && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsEditOpen(true)} className="px-3 py-1 bg-[var(--color-surface-secondary)] text-[var(--color-primary)] font-bold rounded-lg text-xs hover:bg-[var(--color-primary-subtle)] transition-colors">✏️ Edit</button>
                    <button onClick={handleDelete} className="px-3 py-1 bg-red-500/10 text-red-600 font-bold rounded-lg text-xs hover:bg-red-500/20 transition-colors">🗑️ Delete</button>
                  </div>
                )}
              </div>
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
          
          {/* RSVP Bar */}
          <div className="p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-[var(--color-text)] text-base m-0">Are you going?</h4>
              <p className="text-xs text-[var(--color-text-secondary)] m-0 mt-0.5">Your RSVP will reveal your designation @ company to other attendees.</p>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                disabled={isSubmitting}
                onClick={() => handleRsvp("yes")}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  userRsvp === "yes" 
                    ? "bg-[var(--color-primary)] text-white shadow-md" 
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                ✓ Going
              </button>
              <button 
                disabled={isSubmitting}
                onClick={() => handleRsvp("maybe")}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  userRsvp === "maybe" 
                    ? "bg-[var(--color-border)] text-[var(--color-text)] shadow-sm" 
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                ? Maybe
              </button>
            </div>
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
              {going.map((r: any) => (
                <div key={r.user?.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {r.user?.profile_photo_url ? (
                      <img src={r.user.profile_photo_url} alt={r.user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      r.user?.full_name?.substring(0, 2).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--color-text)]">{r.user?.full_name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {r.user?.job_title} @ {r.user?.company}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA for Non-Logged in Users */}
        {!isLoggedIn && (
          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-blue-700 text-white text-center shadow-lg flex flex-col items-center gap-3">
            <h3 className="text-xl font-bold m-0">Join ProxNet to Attend</h3>
            <p className="text-sm text-white/80 max-w-md m-0">Connect with local professionals, see who's going, and get invited to exclusive local events.</p>
            <Link 
              href={`/login?callbackUrl=${encodeURIComponent(`/event/${event.id}`)}`}
              className="px-6 py-3 bg-white text-[var(--color-primary)] font-bold text-sm rounded-xl shadow hover:bg-white/90 transition-colors mt-2"
            >
              Sign Up / Login to RSVP
            </Link>
          </div>
        )}

      </div>

      {isInviteOpen && (
        <EventInviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          eventId={event.id}
          eventTitle={event.title}
        />
      )}

      {isEditOpen && (
        <EventFormModal
          isOpen={isEditOpen}
          initialData={event}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            setIsEditOpen(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}
