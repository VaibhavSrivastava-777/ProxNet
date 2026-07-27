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

  const handleShareWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/job-post/${jobPost.id}`;
    const badgeEmoji = isSeeker ? "🔍" : "📢";
    const text = `${badgeEmoji} *${jobPost.role}* ${jobPost.company ? `at ${jobPost.company}` : ''}\n${jobPost.description ? jobPost.description.slice(0, 120) + '...' : ''}\n\n👉 View details on ProxNet:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
    if (!confirm("Are you sure you want to delete this Job post?")) return;

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

  const skillsList = jobPost.skills 
    ? jobPost.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return (
    <div 
      onClick={() => router.push(`/job-post/${jobPost.id}`)}
      className="card p-5 bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:shadow-md transition-all cursor-pointer rounded-2xl flex flex-col gap-3 group relative overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex items-center justify-center font-bold text-sm border border-[var(--color-border)] shadow-sm shrink-0">
            {jobPost.creator?.profile_photo_url ? (
              <img src={jobPost.creator.profile_photo_url} alt={jobPost.creator.full_name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span>💼</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[var(--color-text)] truncate">
              {jobPost.creator?.full_name || "Neighbor"}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] truncate">
              {jobPost.creator?.job_title} @ {jobPost.creator?.company}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCreator && (
            <div className="flex items-center gap-1">
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

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeBg} uppercase tracking-wider`}>
            {badgeText}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 mt-1">
        <h3 className="text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors leading-snug">
          {jobPost.role}
        </h3>
        {jobPost.company && (
          <p className="text-xs text-[var(--color-text-secondary)] font-medium">
            🏢 {jobPost.company} {jobPost.experience_years ? `• ⌛ ${jobPost.experience_years}` : ''}
          </p>
        )}
      </div>

      {jobPost.description && (
        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
          {jobPost.description}
        </p>
      )}

      {skillsList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {skillsList.slice(0, 4).map((skill: string, i: number) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-[var(--color-surface-secondary)] text-[10px] font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
              {skill}
            </span>
          ))}
          {skillsList.length > 4 && (
            <span className="text-[10px] text-[var(--color-text-tertiary)] self-center font-medium">
              +{skillsList.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--color-border-light)]">
        <span className="text-xs text-[var(--color-text-tertiary)] font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          {interestedCount} Interested
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsapp}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 transition-colors flex items-center gap-1"
            title="Share on WhatsApp"
          >
            <span>💬</span> WhatsApp
          </button>

          <button
            onClick={handleShare}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors rounded-lg hover:bg-[var(--color-primary-subtle)] flex items-center gap-1 text-xs font-semibold"
            title="Share with apps"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>

          <button
            onClick={handleInterest}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isInterested
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-300"
                : "bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm"
            }`}
          >
            {isInterested ? "✓ Interested" : "I'm Interested"}
          </button>
        </div>
      </div>
    </div>
  );
}
