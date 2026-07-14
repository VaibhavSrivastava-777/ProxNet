"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CATEGORIES = ["All", "General", "Recommendations", "Events", "Buy/Sell", "Help Needed"];

export function LocalForumFeed() {
  const router = useRouter();
  const { data, isLoading } = useSWR("/api/questions", fetcher, { refreshInterval: 10000 });
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  
  // Filtering
  const [activeCategory, setActiveCategory] = useState("All");

  // Compose Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState("General");
  const [isPosting, setIsPosting] = useState(false);

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/qa/forum/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Local Forum Post", url });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const handleLike = async (e: React.MouseEvent, q: any) => {
    e.stopPropagation();
    
    // Optimistic update
    const currentForum = data?.forum || [];
    const updatedForum = currentForum.map((item: any) => {
      if (item.id === q.id) {
        return { ...item, likes_count: (item.likes_count || 0) + 1 };
      }
      return item;
    });
    mutate("/api/questions", { ...data, forum: updatedForum }, false);

    // Network request
    try {
      await fetch(`/api/questions/forum/${q.id}/like`, { method: "POST" });
    } catch (err) {
      // Revert if error
      mutate("/api/questions");
    }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postBody.trim()) return;

    setIsPosting(true);
    try {
      const fullBody = `[${postCategory}] ${postBody}`;
      
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionBody: fullBody,
          companyFilter: null,
          titleFilter: null,
          targetUserId: null,
          centerLat: null,
          centerLng: null,
          radiusMeters: 5000,
        }),
      });

      if (res.ok) {
        setPostBody("");
        setPostCategory("General");
        setIsModalOpen(false);
        mutate("/api/questions"); // refresh feed
      } else {
        alert("Failed to post.");
      }
    } catch (err) {
      alert("An error occurred.");
    } finally {
      setIsPosting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 mt-8">
        <h2 className="text-h2 px-4 md:px-0">Local Forum</h2>
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );
  }

  const rawForum = data?.forum || [];
  
  // Filter by category
  const forum = rawForum.filter((q: any) => {
    if (activeCategory === "All") return true;
    return q.body.startsWith(`[${activeCategory}]`);
  });

  return (
    <div className="flex flex-col gap-4 mt-8 animate-fadeInUp relative min-h-screen pb-20">
      <h2 className="text-h2 px-4 md:px-0 mb-2">Local Forum</h2>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 px-4 md:px-0 hide-scrollbar" style={{ msOverflowStyle: "none", scrollbarWidth: "none" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === cat
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {forum.length === 0 ? (
          <div className="card p-8 text-center border border-dashed border-[var(--color-border)] flex flex-col items-center justify-center min-h-[200px] bg-[var(--color-surface)]/50 rounded-xl mt-4">
            <p className="text-body text-[var(--color-text-secondary)] font-medium">No posts found in this category.</p>
            <p className="text-caption text-[var(--color-text-tertiary)] mt-1">Be the first to start a conversation in your neighborhood!</p>
          </div>
        ) : (
          forum.map((q: any) => {
            // Extract category and raw body
            let displayBody = q.body;
            let displayCategory = "General";
            const match = displayBody.match(/^\[([\s\S]*?)\] ([\s\S]*)/);
            if (match) {
              displayCategory = match[1];
              displayBody = match[2];
            }

            return (
              <div
                key={q.id}
                className="card p-4 sm:p-5 flex flex-col gap-3 bg-[var(--color-surface)] border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/qa/forum/${q.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-sm">
                    {q.asker_alias.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-body font-semibold text-[var(--color-text)] flex items-center gap-2">
                      {q.asker_alias}
                      <span className="badge bg-primary/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        📍 {displayCategory}
                      </span>
                    </span>
                    <span className="text-caption text-[var(--color-text-secondary)]">{formatRelative(q.created_at)}</span>
                  </div>
                </div>
                
                <p className="text-body text-[var(--color-text)] mt-1 whitespace-pre-wrap">
                  {displayBody.length > 150 && !expandedPosts[q.id] ? `${displayBody.slice(0, 150)}...` : displayBody}
                  {displayBody.length > 150 && (
                    <button 
                      onClick={(e) => toggleExpand(e, q.id)} 
                      className="text-[var(--color-primary)] font-medium ml-1 hover:underline inline-block"
                    >
                      {expandedPosts[q.id] ? "show less" : "show more"}
                    </button>
                  )}
                </p>
                
                <div className="flex items-center gap-6 mt-2 border-t border-[var(--color-border-light)] pt-3">
                  <button 
                    onClick={(e) => handleLike(e, q)}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    <span className="font-medium">{q.likes_count || 0} Likes</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); router.push(`/qa/forum/${q.id}`) }} 
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span className="font-medium">{q.comments_count || 0} Comments</span>
                  </button>
                  <button 
                    onClick={(e) => handleShare(e, q.id)} 
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ml-auto"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    <span className="font-medium">Share</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[var(--color-primary)] text-white rounded-full shadow-xl hover:shadow-2xl hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center z-40"
        aria-label="New Post"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </button>

      {/* Compose Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--color-border)] flex flex-col animate-scaleIn overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
              <h3 className="text-h3 m-0 flex items-center gap-2 text-[var(--color-text)]">
                ✏️ New Forum Post
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={submitPost} className="flex flex-col p-5 gap-4">
              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Category</label>
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  {CATEGORIES.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1 block">Message</label>
                <textarea
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share a recommendation, ask for help, or post an event..."
                  className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] min-h-[120px] resize-none"
                  required
                />
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Posting anonymously as your alias
                </span>
                
                <button
                  type="submit"
                  disabled={isPosting || !postBody.trim()}
                  className="px-6 py-2 rounded-xl bg-[var(--color-primary)] text-white font-bold disabled:opacity-50 hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  {isPosting ? "Posting..." : "Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

