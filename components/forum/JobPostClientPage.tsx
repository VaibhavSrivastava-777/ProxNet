"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { EventInviteModal } from "@/components/forum/EventInviteModal";
import { JobPostModal } from "@/components/forum/JobPostModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function JobPostClientPage({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoAction = searchParams?.get("action");

  // Session
  const { data: profile } = useSWR("/api/profile", fetcher, { 
    errorRetryCount: 0,
    shouldRetryOnError: false 
  });
  
  const { data, error, isLoading, mutate } = useSWR(`/api/job-posts/${id}`, fetcher);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Likes state
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  // Comments state
  const { data: commentsData, mutate: mutateComments } = useSWR(`/api/job-posts/${id}/comments`, fetcher);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const isLoggedIn = !!profile && !profile.error;
  const currentUserId = profile?.user?.id || profile?.id;

  useEffect(() => {
    if (data?.jobPost?.likes) {
      setLikesCount(data.jobPost.likes.length);
      if (currentUserId) {
        setHasLiked(data.jobPost.likes.some((l: any) => l.user_id === currentUserId));
      }
    }
  }, [data, currentUserId]);

  useEffect(() => {
    if (autoAction === "interested" && isLoggedIn && data?.jobPost && data?.userInterest !== "interested") {
      handleInterest();
      window.history.replaceState({}, "", `/job-post/${id}`);
    }
  }, [autoAction, isLoggedIn, data]);

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
        <h1 className="text-h2 font-bold text-[var(--color-text)]">Job Post Not Found</h1>
        <p className="text-body text-[var(--color-text-secondary)] mt-2">This job post may have been removed.</p>
        <button onClick={() => router.push("/")} className="btn btn-primary mt-6">Go Home</button>
      </div>
    );
  }

  const { jobPost, userInterest, isCreator } = data;

  const isSeeker = jobPost.type === "seeker";
  const badgeText = isSeeker ? "Looking for Role" : "Hiring / Referring";
  const badgeBg = isSeeker ? "bg-blue-600" : "bg-emerald-600";

  const interests = jobPost.interests || [];
  const interestedList = interests.filter((i: any) => i.status === "interested");

  const isInterested = userInterest === "interested";

  const handleInterest = async () => {
    if (!isLoggedIn) {
      const cb = encodeURIComponent(`/job-post/${jobPost.id}`);
      router.push(`/login?callbackUrl=${cb}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const nextStatus = isInterested ? "not_interested" : "interested";
      const res = await fetch(`/api/job-posts/${jobPost.id}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        mutate();
      } else {
        alert("Failed to update interest.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/job-post/${jobPost.id}`)}`);
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const newLiked = !hasLiked;
    setHasLiked(newLiked);
    setLikesCount((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/job-posts/${jobPost.id}/like`, { method: "POST" });
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
      router.push(`/login?callbackUrl=${encodeURIComponent(`/job-post/${jobPost.id}`)}`);
      return;
    }
    if (!commentText.trim() || postingComment) return;

    setPostingComment(true);
    try {
      const res = await fetch(`/api/job-posts/${jobPost.id}/comments`, {
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
    if (!confirm("Are you sure you want to delete this Job post?")) return;
    try {
      const res = await fetch(`/api/job-posts/${jobPost.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/?tab=forum");
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to delete job post.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareWhatsapp = () => {
    const shortUrl = `${window.location.origin}/j/${jobPost.id}`;
    const actionLabel = isSeeker ? "📩 Contact Candidate / Refer" : "🚀 Express Interest / Apply";
    
    const text = `${isSeeker ? "🔍" : "📢"} *${jobPost.role}* ${jobPost.company ? `at *${jobPost.company}*` : ''}\n${jobPost.location ? `📍 ${jobPost.location}\n` : ''}${jobPost.description ? `_"${jobPost.description.slice(0, 110)}..."_\n` : ''}\n${actionLabel}:\n${shortUrl}?action=interested`;

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: jobPost.role,
        text: text,
        url: shortUrl,
      }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const skillsList = jobPost.skills 
    ? jobPost.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

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
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${badgeBg}`}>
                  {badgeText}
                </span>
                {jobPost.experience_years && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
                    ⏳ {jobPost.experience_years}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-text)] leading-tight m-0">{jobPost.role}</h1>
              {jobPost.company && (
                <span className="text-lg font-bold text-[var(--color-primary)]">🏢 {jobPost.company}</span>
              )}
            </div>

            {/* Action buttons side / top */}
            <div className="flex flex-col gap-2 shrink-0 min-w-[180px]">
              {isCreator && (
                <div className="flex gap-2 justify-end mb-2">
                  <button
                    onClick={() => setIsEditOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-surface-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}

              <button
                disabled={isSubmitting}
                onClick={handleInterest}
                className={`w-full px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                  isInterested 
                    ? "bg-emerald-600 text-white" 
                    : isSeeker
                    ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {isInterested 
                  ? "✓ Interest Registered" 
                  : isSeeker 
                  ? "📩 Contact / Offer Referral" 
                  : "🚀 Interested in Opportunity"}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleLike}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                    hasLiked ? "bg-red-500/10 text-red-600 border-red-200" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  <span>{likesCount} Likes</span>
                </button>

                <button
                  onClick={handleShareWhatsapp}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm"
                  title="Share via WhatsApp"
                >
                  <span>💬</span> WhatsApp
                </button>
              </div>
            </div>
          </div>

          {/* Posted By */}
          <div className="flex items-center gap-4 py-4 border-y border-[var(--color-border-light)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex items-center justify-center font-bold text-base border border-[var(--color-border)] shadow-sm shrink-0 overflow-hidden">
              {jobPost.creator?.profile_photo_url ? (
                <img src={jobPost.creator.profile_photo_url} alt={jobPost.creator.full_name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span>💼</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-[var(--color-text)]">{jobPost.creator?.full_name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Posted by {jobPost.creator?.job_title} @ {jobPost.creator?.company}
              </span>
            </div>
          </div>

          {/* Skills */}
          {skillsList.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Required / Key Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((skill: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-[var(--color-surface-secondary)] text-xs font-semibold text-[var(--color-text)] border border-[var(--color-border-light)]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h3 font-bold text-[var(--color-text)]">About this Opportunity</h3>
              {isLoggedIn && (
                <button 
                  onClick={() => setIsInviteOpen(true)}
                  className="px-4 py-2 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold rounded-lg text-xs hover:opacity-80 transition-opacity"
                >
                  + Invite People
                </button>
              )}
            </div>
            <p className="text-body text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {jobPost.description || "No additional description provided."}
            </p>
          </div>

          {/* Contact Info */}
          {jobPost.contact_info && (
            <div className="p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
              <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider block mb-1">Direct Contact</span>
              <span className="text-sm font-semibold text-[var(--color-text)]">{jobPost.contact_info}</span>
            </div>
          )}

        </div>

        {/* Interested Professionals List */}
        <div className="mt-6 card bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-6">
          <h3 className="text-h3 font-bold text-[var(--color-text)] mb-4">
            Interested Professionals ({interestedList.length})
          </h3>
          
          {interestedList.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] italic">No one has expressed interest yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-4">
              {interestedList.map((i: any) => (
                <div key={i.user?.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {i.user?.profile_photo_url ? (
                      <img src={i.user.profile_photo_url} alt={i.user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      i.user?.full_name?.substring(0, 2).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--color-text)]">{i.user?.full_name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {i.user?.job_title} @ {i.user?.company}
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
            <h3 className="text-xl font-bold m-0">Join ProxNet to Express Interest</h3>
            <p className="text-sm text-white/80 max-w-md m-0">Connect directly with professionals in your neighborhood and get direct job referrals.</p>
            <Link 
              href={`/login?callbackUrl=${encodeURIComponent(`/job-post/${jobPost.id}`)}`}
              className="px-6 py-3 bg-white text-[var(--color-primary)] font-bold text-sm rounded-xl shadow hover:bg-white/90 transition-colors mt-2"
            >
              Sign Up / Login to Respond
            </Link>
          </div>
        )}

      </div>

      {isInviteOpen && (
        <EventInviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          eventId={jobPost.id}
          eventTitle={jobPost.role}
        />
      )}

      {isEditOpen && (
        <JobPostModal
          isOpen={isEditOpen}
          initialData={jobPost}
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
