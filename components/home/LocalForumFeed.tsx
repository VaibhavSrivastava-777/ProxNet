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

const CATEGORIES = ["General", "Recommendations", "Events", "Buy/Sell", "Help Needed"];

export function LocalForumFeed() {
  const router = useRouter();
  const [locationMode, setLocationMode] = useState<"home" | "office" | "current">("home");
  
  // Fetch profile for office checking and avatar initials
  const { data: profile } = useSWR("/api/profile", fetcher);
  
  // Fetch questions SWR with dynamic location mode
  const { data, isLoading } = useSWR(`/api/questions?locationMode=${locationMode}`, fetcher, { 
    refreshInterval: 10000 
  });
  
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState("General");
  const [isPosting, setIsPosting] = useState(false);
  const [filter2km, setFilter2km] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLocationChange = (newMode: "home" | "office" | "current") => {
    if (newMode === "office" && profile && (!profile.office_lat || !profile.office_lng)) {
      alert("Please configure your Office location on your Profile page first.");
      router.push("/profile?missingOffice=true");
      return;
    }
    setLocationMode(newMode);
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
    mutate(`/api/questions?locationMode=${locationMode}`, { ...data, forum: updatedForum }, false);

    // Network request
    try {
      await fetch(`/api/questions/forum/${q.id}/like`, { method: "POST" });
    } catch (err) {
      mutate(`/api/questions?locationMode=${locationMode}`);
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
          centerLat: locationMode === "home" ? profile?.home_lat : profile?.office_lat,
          centerLng: locationMode === "home" ? profile?.home_lng : profile?.office_lng,
          radiusMeters: 2000,
        }),
      });

      if (res.ok) {
        setPostBody("");
        setPostCategory("General");
        setIsModalOpen(false);
        mutate(`/api/questions?locationMode=${locationMode}`);
      } else {
        alert("Failed to post.");
      }
    } catch (err) {
      alert("An error occurred.");
    } finally {
      setIsPosting(false);
    }
  };

  const userInitials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "ME";

  const forum = data?.forum || [];
  const filteredForum = forum.filter((q: any) => {
    if (!filter2km) return true;
    if (q.distance === null) return false;
    return q.distance <= 2000;
  });

  return (
    <div className="flex flex-col gap-4 mt-6 animate-fadeInUp relative min-h-screen pb-20">
      
      {/* LinkedIn-Style Compose Card */}
      <div className="card p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shrink-0">
            {userInitials}
          </div>
          <button
            onClick={() => {
              setPostCategory("General");
              setIsModalOpen(true);
            }}
            className="flex-1 text-left px-4 py-2.5 rounded-full bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-sm text-[var(--color-text-secondary)] font-medium transition-colors cursor-pointer"
          >
            Start a post in your neighborhood anonymously...
          </button>
        </div>
        <div className="flex items-center justify-around gap-2 mt-3 pt-3 border-t border-[var(--color-border-light)]">
          {[
            { icon: "💡", label: "Recommend", cat: "Recommendations" },
            { icon: "🙋‍♂️", label: "Help", cat: "Help Needed" },
            { icon: "🛒", label: "Buy/Sell", cat: "Buy/Sell" },
          ].map((act) => (
            <button
              key={act.label}
              onClick={() => {
                setPostCategory(act.cat);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-primary)] transition-all cursor-pointer bg-transparent border-0"
            >
              <span className="text-sm">{act.icon}</span>
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed Location Header Bar & Filter */}
      <div className="flex justify-between items-center px-2 py-1 mt-2">
        <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Neighborhood Feed {filter2km ? "(2km)" : "(Unfiltered)"}
        </span>
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className={`p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer border border-[var(--color-border-light)] flex items-center justify-center shrink-0 ${
            filtersExpanded
              ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] border-[var(--color-primary)]"
              : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
          }`}
          style={{ width: "32px", height: "32px" }}
          title="Filter neighborhood feed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>
      </div>

      {filtersExpanded && (
        <div className="card p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-md animate-fadeInDown flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forum-filter-2km"
                checked={filter2km}
                onChange={(e) => setFilter2km(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
              <label htmlFor="forum-filter-2km" className="text-xs font-bold text-[var(--color-text)] cursor-pointer select-none">
                Limit feed to 2 km radius
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">Near:</span>
              <select
                value={locationMode}
                onChange={(e) => handleLocationChange(e.target.value as any)}
                className="input py-1 px-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]"
                style={{ color: "var(--color-text)" }}
              >
                <option value="home">Home Address</option>
                <option value="office">Office Address</option>
                <option value="current">Current Location</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Loader */}
      {isLoading ? (
        <div className="flex flex-col gap-4 mt-2">
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredForum.length === 0 ? (
            <div className="card p-8 text-center border border-dashed border-[var(--color-border)] flex flex-col items-center justify-center min-h-[200px] bg-[var(--color-surface)]/50 rounded-xl">
              <p className="text-body text-[var(--color-text-secondary)] font-medium">No posts found near this location.</p>
              <p className="text-caption text-[var(--color-text-tertiary)] mt-1">Be the first to share an update with your neighbors!</p>
            </div>
          ) : (
            filteredForum.map((q: any, index: number) => {
              // Extract category and raw body
              let displayBody = q.body;
              let displayCategory = "General";
              const match = displayBody.match(/^\[([\s\S]*?)\] ([\s\S]*)/);
              if (match) {
                displayCategory = match[1];
                displayBody = match[2];
              }

              return (
                <div key={q.id} className="flex flex-col gap-4">
                  <div
                    className="card p-4 sm:p-5 flex flex-col gap-3 bg-[var(--color-surface)] border hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/qa/forum/${q.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex items-center justify-center font-bold text-sm border border-[var(--color-border)] shadow-sm shrink-0">
                        🏡
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {q.anonymous_name}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)] truncate">
                          {q.poster_title} @ {q.poster_company}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1.5 mt-0.5">
                          {formatRelative(q.created_at)}
                          <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[10px] font-medium border border-[var(--color-border-light)] text-[var(--color-text-secondary)]">
                            📍 {displayCategory}
                          </span>
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-body-sm text-[var(--color-text)] mt-1 whitespace-pre-wrap leading-relaxed">
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
                        className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        <span>{q.likes_count || 0} Likes</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/qa/forum/${q.id}`) }} 
                        className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer bg-transparent border-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>{q.comments_count || 0} Comments</span>
                      </button>
                      <button 
                        onClick={(e) => handleShare(e, q.id)} 
                        className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ml-auto cursor-pointer bg-transparent border-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        <span>Share</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Invite card after every 5th post */}
                  {(index + 1) % 5 === 0 && (
                    <div
                      className="card p-4 flex items-center justify-between gap-4 bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20 cursor-pointer"
                      style={{ borderRadius: "var(--radius-lg)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/grow");
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h4 className="text-body font-semibold m-0" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text)" }}>
                          <span>💡</span> Strengthen Your Local Network
                        </h4>
                        <p className="text-caption m-0 mt-1" style={{ color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                          Know a professional neighbor who should be in this conversation? Invite them to ProxNet and unlock more local opportunities together.
                        </p>
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ padding: "8px 16px", fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        Invite &rarr;
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

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
                  {CATEGORIES.map(c => (
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
