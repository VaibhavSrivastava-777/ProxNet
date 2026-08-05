"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JobPostCard({ 
  jobPost, 
  currentUserId, 
  onInterestUpdate,
  onEdit,
  onDelete
}: { 
  jobPost: any; 
  currentUserId?: string;
  onInterestUpdate?: () => void;
  onEdit?: (jobPost: any) => void;
  onDelete?: (jobPostId: string) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Like & Comment state
  const initialLikes = jobPost.likes || [];
  const initialHasLiked = currentUserId ? initialLikes.some((l: any) => l.user_id === currentUserId) : false;
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [likesCount, setLikesCount] = useState(initialLikes.length);
  const [isLiking, setIsLiking] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsCount, setCommentsCount] = useState(jobPost.comments?.length || 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const creatorId = jobPost.creator_id || jobPost.user_id;
  const isCreator = currentUserId && currentUserId === creatorId;

  const isSeeker = jobPost.type === "seeker";
  const badgeText = isSeeker ? "Looking for Role" : "Hiring / Referring";
  const badgeBg = isSeeker ? "bg-blue-500/10 text-blue-600 border-blue-200" : "bg-emerald-500/10 text-emerald-600 border-emerald-200";

  const interests = jobPost.interests || [];
  const interestedCount = interests.filter((i: any) => i.status === "interested").length;

  const userInterest = interests.find((i: any) => i.user_id === currentUserId)?.status;
  const isInterested = userInterest === "interested";

  const handleInterest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/job-post/${jobPost.id}`)}`);
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
      if (res.ok && onInterestUpdate) {
        onInterestUpdate();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/job-post/${jobPost.id}`)}`);
      return;
    }
    if (isLiking) return;

    setIsLiking(true);
    const newLiked = !hasLiked;
    setHasLiked(newLiked);
    setLikesCount((prev: number) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/job-posts/${jobPost.id}/like`, { method: "POST" });
      if (!res.ok) {
        setHasLiked(!newLiked);
        setLikesCount((prev: number) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
      }
    } catch (err) {
      console.error(err);
      setHasLiked(!newLiked);
      setLikesCount((prev: number) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
    } finally {
      setIsLiking(false);
    }
  };

  const toggleComments = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !showComments;
    setShowComments(nextState);

    if (nextState && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/job-posts/${jobPost.id}/comments`);
        const data = await res.json();
        if (data.comments) {
          setComments(data.comments);
          setCommentsCount(data.comments.length);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) {
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
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((prev: any[]) => [...prev, data.comment]);
        setCommentsCount((prev: number) => prev + 1);
        setCommentText("");
      } else {
        alert(data.error || "Failed to post comment");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPostingComment(false);
    }
  };

  const handleShareWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/job-post/${jobPost.id}`;
    const shareData = {
      title: jobPost.role,
      text: `Check out this job opportunity on ProxNet: ${jobPost.role} ${jobPost.company ? `at ${jobPost.company}` : ''}`,
      url: url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Job post link copied to clipboard!");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this job post?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/job-posts/${jobPost.id}`, { method: "DELETE" });
      if (res.ok) {
        if (onDelete) onDelete(jobPost.id);
        else if (onInterestUpdate) onInterestUpdate();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to delete job post.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting job post.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(jobPost);
  };

  return (
    <div 
      onClick={() => router.push(`/job-post/${jobPost.id}`)}
      className="card p-5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3 relative overflow-hidden group"
    >
      {/* Top Bar: Badge & Creator Actions */}
      <div className="flex justify-between items-start">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeBg}`}>
          {badgeText}
        </span>

        {isCreator && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleEdit}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-surface-secondary)] text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors"
              title="Edit Job Post"
            >
              ✏️ Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              title="Delete Job Post"
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {/* Role & Company Header */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg font-bold text-[var(--color-text)] leading-tight group-hover:text-[var(--color-primary)] transition-colors">{jobPost.role}</h3>
        {jobPost.company && (
          <p className="text-sm font-semibold text-[var(--color-primary)] m-0 flex items-center gap-1">
            <span>🏢</span> {jobPost.company}
          </p>
        )}
      </div>

      {/* Metadata pills (Experience & Skills) */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        {jobPost.experience_years && (
          <span className="bg-[var(--color-surface-secondary)] px-2 py-0.5 rounded font-medium border border-[var(--color-border-light)]">
            ⏳ {jobPost.experience_years}
          </span>
        )}
        {jobPost.skills && (
          <span className="bg-[var(--color-surface-secondary)] px-2 py-0.5 rounded font-medium border border-[var(--color-border-light)] truncate max-w-[200px]">
            🛠️ {jobPost.skills}
          </span>
        )}
      </div>

      {/* Description Snippet */}
      {jobPost.description && (
        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 m-0 leading-relaxed">
          {jobPost.description}
        </p>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--color-border-light)]">
        <div className="flex items-center gap-2">
          {/* Role Specific RSVP Action Button */}
          <button
            disabled={isSubmitting}
            onClick={handleInterest}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none ${
              isInterested
                ? "bg-emerald-600 text-white shadow-sm"
                : isSeeker
                ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            }`}
          >
            {isInterested
              ? "✓ Interest Registered"
              : isSeeker
              ? "📩 Contact / Offer Referral"
              : "🚀 Interested in Opportunity"}
          </button>
          
          {interestedCount > 0 && (
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {interestedCount} interested
            </span>
          )}

          {/* Like Button */}
          <button
            onClick={handleLike}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
              hasLiked ? "bg-red-500/10 text-red-600 border border-red-200 dark:border-red-800" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
            title="Like this Job Post"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span>{likesCount}</span>
          </button>

          {/* Comment Toggle Button */}
          <button
            onClick={toggleComments}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
              showComments ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
            title="Comment on this Job Post"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>{commentsCount}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShareWhatsapp}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition-colors flex items-center gap-1.5 cursor-pointer border border-[#25D366]/20"
            title="Share on WhatsApp"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.105 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            <span>WhatsApp</span>
          </button>

          <button 
            onClick={handleShare}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors rounded-lg hover:bg-[var(--color-primary-subtle)] flex items-center gap-1 text-xs font-semibold"
            title="Share with apps"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Collapsible Inline Comments Section */}
      {showComments && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="mt-3 pt-3 border-t border-[var(--color-border-light)] flex flex-col gap-3 animate-fadeIn"
        >
          <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Comments ({commentsCount})</h4>
          
          {loadingComments ? (
            <div className="text-xs text-[var(--color-text-tertiary)] py-2">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-[var(--color-text-tertiary)] italic">No comments yet. Be the first to comment!</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="bg-[var(--color-surface-secondary)] p-2.5 rounded-lg border border-[var(--color-border-light)] flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--color-text)]">{c.user?.full_name || "Neighbor"}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] m-0">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Comment Form */}
          <form onSubmit={handlePostComment} className="flex gap-2 mt-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={postingComment || !commentText.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Creator Info */}
      <div className="text-[10px] text-[var(--color-text-tertiary)] text-right mt-1">
        Posted by {jobPost.creator?.full_name || "Neighbor"}
      </div>
    </div>
  );
}
