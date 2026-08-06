"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";

import { EventInviteModal } from "@/components/forum/EventInviteModal";
import { EventFormModal } from "@/components/forum/EventFormModal";
import { EventReminderModal } from "@/components/forum/EventReminderModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function EventClientPage({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoRsvp = searchParams?.get("auto_rsvp");
  
  // Try fetching current user session to see if logged in
  const { data: profile } = useSWR("/api/profile", fetcher, { 
    errorRetryCount: 0,
    shouldRetryOnError: false 
  });
  
  const { data, error, isLoading, mutate } = useSWR(`/api/events/${id}`, fetcher);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);

  // Likes state
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  // Comments state
  const { data: commentsData, mutate: mutateComments } = useSWR(`/api/events/${id}/comments`, fetcher);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const isLoggedIn = !!profile && !profile.error;
  const currentUserId = profile?.user?.id || profile?.id;

  useEffect(() => {
    if (data?.event?.likes) {
      setLikesCount(data.event.likes.length);
      if (currentUserId) {
        setHasLiked(data.event.likes.some((l: any) => l.user_id === currentUserId));
      }
    }
  }, [data, currentUserId]);

  useEffect(() => {
    if (autoRsvp && isLoggedIn && data?.event) {
      handleRsvp(autoRsvp);
      const newUrl = `/event/${id}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [autoRsvp, isLoggedIn, data]);

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
  
  const rsvps = event.rsvps || [];
  const going = rsvps.filter((r: any) => r.status === "yes");
  const maybe = rsvps.filter((r: any) => r.status === "maybe");

  const handleRsvp = async (status: string) => {
    if (!isLoggedIn) {
      const cb = encodeURIComponent(`/event/${event.id}?auto_rsvp=${status}`);
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

  const handleLike = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/event/${event.id}`)}`);
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const newLiked = !hasLiked;
    setHasLiked(newLiked);
    setLikesCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/events/${event.id}/like`, { method: "POST" });
      if (!res.ok) {
        setHasLiked(!newLiked);
        setLikesCount((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
      } else {
        mutate();
      }
    } catch (err) {
      console.error(err);
      setHasLiked(!newLiked);
      setLikesCount((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
    } finally {
      setIsLiking(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/event/${event.id}`)}`);
      return;
    }
    if (!commentText.trim() || postingComment) return;

    setPostingComment(true);
    try {
      const res = await fetch(`/api/events/${event.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentText.trim() }),
      });
      const resData = await res.json();
      if (res.ok) {
        setCommentText("");
        mutateComments();
      } else {
        alert(resData.error || "Failed to post comment");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPostingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this Meetup event?")) return;
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/?tab=forum");
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to delete event.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startObj = new Date(event.starts_at);
  const endObj = new Date(event.ends_at);
  const dateStr = startObj.toLocaleDateString("en-US", { 
    weekday: "short", 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
  const timeStr = `${startObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  const handleShareWhatsapp = () => {
    const shortUrl = `${window.location.origin}/e/${event.id}`;
    const hostName = event.creator?.full_name || "Neighbor";
    
    const agenda = event.subtitle || (event.description ? (event.description.length > 120 ? event.description.substring(0, 120) + '...' : event.description) : '');
    const agendaLine = agenda ? `📋 *Agenda:* ${agenda}\n` : '';

    const text = `📌 *${event.title}*\n${agendaLine}📅 ${dateStr} • ${timeStr}\n📍 ${event.venue_name}\n👤 Hosted by ${hostName}\n\nRSVP in 1-tap:\n✅ Going: ${shortUrl}?auto_rsvp=yes\n❓ Maybe: ${shortUrl}?auto_rsvp=maybe`;

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: event.title,
        text: text,
        url: shortUrl,
      }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const comments = commentsData?.comments || [];

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Back Link */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-6 font-semibold transition-colors"
        >
          ← Back
        </button>

        {/* Main Card */}
        <div className="card bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-6 md:p-8 flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="inline-block px-3 py-1 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-xs rounded-full w-fit">
                MEETUP EVENT
              </span>

              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-text)] leading-tight m-0">{event.title}</h1>
              {event.subtitle && (
                <p className="text-base text-[var(--color-text-secondary)] m-0 font-medium">{event.subtitle}</p>
              )}
            </div>

            {/* Creator Actions & Likes */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleLike}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                  hasLiked ? "bg-red-500/10 text-red-600 border-red-200" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span>{likesCount} Likes</span>
              </button>

              {(isCreator || isAdmin) && (
                <>
                  <button
                    onClick={() => setIsReminderOpen(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
                    title="Send real time reminder"
                  >
                    <span>🔔</span> Real-time Reminder
                  </button>
                  <button
                    onClick={() => setIsEditOpen(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-xl">📅</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--color-text)]">{dateStr}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{timeStr}</span>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-xl">📍</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--color-text)]">{event.venue_name}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">Location</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h3 font-bold text-[var(--color-text)]">About this Meetup</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleShareWhatsapp}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <span>💬</span> Share on WhatsApp
                </button>
                {isLoggedIn && (
                  <button 
                    onClick={() => setIsInviteOpen(true)}
                    className="px-4 py-2 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold rounded-lg text-sm hover:opacity-80 transition-opacity"
                  >
                    + Invite People
                  </button>
                )}
              </div>
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

        {/* Comments Section */}
        <div className="mt-6 card bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-6 flex flex-col gap-4">
          <h3 className="text-h3 font-bold text-[var(--color-text)] m-0">
            Discussion & Comments ({comments.length})
          </h3>

          {comments.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] italic m-0">No comments yet. Have a question or note? Start the discussion!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((c: any) => (
                <div key={c.id} className="bg-[var(--color-surface-secondary)] p-3 rounded-xl border border-[var(--color-border-light)] flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--color-text)]">{c.user?.full_name || "Neighbor"}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] m-0 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Comment Form */}
          <form onSubmit={handlePostComment} className="flex gap-3 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={isLoggedIn ? "Write a comment..." : "Log in to join the discussion"}
              disabled={!isLoggedIn}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!isLoggedIn || postingComment || !commentText.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
            >
              Post Comment
            </button>
          </form>
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

      {isReminderOpen && (
        <EventReminderModal
          isOpen={isReminderOpen}
          onClose={() => setIsReminderOpen(false)}
          event={event}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  );
}
