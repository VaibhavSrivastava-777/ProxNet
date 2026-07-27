"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { EventCard } from "@/components/forum/EventCard";
import { EventFormModal } from "@/components/forum/EventFormModal";
import { JobPostCard } from "@/components/forum/JobPostCard";
import { JobPostModal } from "@/components/forum/JobPostModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LocalForumFeed({ 
  profile: propProfile 
}: { 
  profile?: any 
}) {
  const router = useRouter();

  // Fetch user profile if not passed explicitly as prop
  const { data: profileData } = useSWR(propProfile ? null : "/api/profile", fetcher);
  const profile = propProfile || profileData?.user || profileData?.profile || profileData;

  // Active Location Mode: "home" | "office" | "current"
  const [locationMode, setLocationMode] = useState<"home" | "office" | "current">("home");

  // Fetch Questions SWR based on locationMode
  const questionsUrl = `/api/questions?locationMode=${locationMode}`;
  const { data, isLoading } = useSWR(
    questionsUrl,
    fetcher,
    {
      refreshInterval: 30000,
    }
  );

  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postCategory, setPostCategory] = useState("General");
  const [isPosting, setIsPosting] = useState(false);
  const [filter2km, setFilter2km] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editingJob, setEditingJob] = useState<any>(null);

  const activeLat = locationMode === "home" ? profile?.home_lat : profile?.office_lat;
  const activeLng = locationMode === "home" ? profile?.home_lng : profile?.office_lng;

  // Fetch events SWR based on location and radius
  const eventsUrl = `/api/events?lat=${activeLat ?? ''}&lng=${activeLng ?? ''}&radius=${filter2km ? 2000 : 50000}`;
  const { data: eventsData } = useSWR(eventsUrl, fetcher, { refreshInterval: 30000 });

  // Fetch job posts SWR based on location and radius
  const jobPostsUrl = `/api/job-posts?lat=${activeLat ?? ''}&lng=${activeLng ?? ''}&radius=${filter2km ? 2000 : 50000}`;
  const { data: jobPostsData } = useSWR(jobPostsUrl, fetcher, { refreshInterval: 30000 });

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

  const handleShareWhatsapp = (e: React.MouseEvent, q: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/qa/forum/${q.id}`;
    const text = `💬 *${q.question_text}*\n\n👉 Join conversation on ProxNet:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShare = async (e: React.MouseEvent, q: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/qa/forum/${q.id}`;
    const shareData = {
      title: "Local Forum Post | ProxNet",
      text: q.question_text,
      url: url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
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
      mutate(`/api/questions?locationMode=${locationMode}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postBody.trim()) return;

    setIsPosting(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: postBody,
          category: postCategory,
          targetAudience: "neighborhood",
          locationMode,
        }),
      });

      if (res.ok) {
        setPostBody("");
        setIsModalOpen(false);
        mutate(`/api/questions?locationMode=${locationMode}`);
        mutate("/api/profile"); // refresh credits
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to create post.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating post.");
    } finally {
      setIsPosting(false);
    }
  };

  // Combine Questions, Events & Jobs chronologically
  const forumList = (data?.forum || []).map((q: any) => ({ ...q, _type: 'question' }));
  const eventsList = (eventsData?.events || []).map((e: any) => ({ ...e, _type: 'event' }));
  const jobsList = (jobPostsData?.jobPosts || []).map((j: any) => ({ ...j, _type: 'job' }));

  const combinedFeed = [...forumList, ...eventsList, ...jobsList].sort((a, b) => {
    const timeA = new Date(a.created_at || a.starts_at).getTime();
    const timeB = new Date(b.created_at || b.starts_at).getTime();
    return timeB - timeA;
  });

  return (
    <div className="space-y-6">
      {/* Top Location Selector & Controls Bar */}
      <div className="card p-4 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Location Mode Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-light)] text-xs font-bold">
            <button
              onClick={() => handleLocationChange("home")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                locationMode === "home"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm font-extrabold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              🏠 Home
            </button>
            <button
              onClick={() => handleLocationChange("office")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                locationMode === "office"
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm font-extrabold"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              🏢 Office
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEventModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#E56B42] text-white font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>🎉</span> Meetup
            </button>
            <button
              onClick={() => setIsJobModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[var(--color-primary)] text-white font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>💼</span> Jobs
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] font-bold text-xs hover:bg-[var(--color-surface-hover)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>✍️</span> Post
            </button>
          </div>
        </div>

        {/* Filters Toggle Bar */}
        <div className="flex items-center justify-between border-t border-[var(--color-border-light)] pt-3 text-xs">
          <button
            onClick={() => setFilter2km(!filter2km)}
            className={`flex items-center gap-2 font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              filter2km
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
            }`}
          >
            <span>📍</span>
            <span>{filter2km ? "Within 2 km" : "All Distances"}</span>
          </button>

          <span className="text-[var(--color-text-tertiary)] font-medium">
            Showing {combinedFeed.length} updates nearby
          </span>
        </div>
      </div>

      {/* Main Feed Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {combinedFeed.length === 0 ? (
            <div className="card p-8 text-center border border-dashed border-[var(--color-border)] flex flex-col items-center justify-center min-h-[200px] bg-[var(--color-surface)]/50 rounded-xl">
              <p className="text-body text-[var(--color-text-secondary)] font-medium">No posts or events found near this location.</p>
              <p className="text-caption text-[var(--color-text-tertiary)] mt-1">Be the first to share an update with your neighbors!</p>
            </div>
          ) : (
            combinedFeed.map((item: any, index: number) => {
              if (item._type === 'event') {
                return (
                  <EventCard 
                    key={`ev-${item.id}`} 
                    event={item} 
                    currentUserId={profile?.id} 
                    onRsvpUpdate={() => mutate(eventsUrl)} 
                    onEdit={(evt) => {
                      setEditingEvent(evt);
                      setIsEventModalOpen(true);
                    }}
                    onDelete={() => mutate(eventsUrl)}
                  />
                );
              }
              if (item._type === 'job') {
                return (
                  <JobPostCard
                    key={`job-${item.id}`}
                    jobPost={item}
                    currentUserId={profile?.id}
                    onInterestUpdate={() => mutate(jobPostsUrl)}
                    onEdit={(job) => {
                      setEditingJob(job);
                      setIsJobModalOpen(true);
                    }}
                    onDelete={() => mutate(jobPostsUrl)}
                  />
                );
              }

              // Standard Q&A Forum Post
              const q = item;
              const displayBody = q.question_text || "";
              const formattedDate = new Date(q.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              });

              return (
                <div key={`qa-${q.id}`} className="space-y-4">
                  <div
                    onClick={() => router.push(`/qa/forum/${q.id}`)}
                    className="card p-5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 group"
                  >
                    {/* Header: User info & category */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs border border-[var(--color-primary)]/20 shadow-sm shrink-0 overflow-hidden">
                          {q.asker?.profile_photo_url ? (
                            <img src={q.asker.profile_photo_url} alt={q.asker.full_name} className="w-full h-full object-cover" />
                          ) : (
                            q.asker?.full_name?.substring(0, 2).toUpperCase() || "U"
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[var(--color-text)]">
                            {q.asker?.full_name || "Neighbor"}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      {q.category && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
                          {q.category}
                        </span>
                      )}
                    </div>

                    {/* Question Content */}
                    <p className="text-sm text-[var(--color-text)] font-medium leading-relaxed m-0">
                      {displayBody.length > 150 && !expandedPosts[q.id] ? `${displayBody.slice(0, 150)}...` : displayBody}
                      {displayBody.length > 150 && (
                        <button 
                          onClick={(e) => toggleExpand(e, q.id)} 
                          className="text-[var(--color-primary)] font-medium ml-1 hover:underline inline-block cursor-pointer bg-transparent border-0"
                        >
                          {expandedPosts[q.id] ? "show less" : "show more"}
                        </button>
                      )}
                    </p>
                    
                    {/* Action Bar */}
                    <div className="flex items-center gap-4 mt-2 border-t border-[var(--color-border-light)] pt-3">
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
                        onClick={(e) => handleShareWhatsapp(e, q)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 transition-colors ml-auto flex items-center gap-1 cursor-pointer border-0"
                        title="Share on WhatsApp"
                      >
                        <span>💬</span> WhatsApp
                      </button>

                      <button 
                        onClick={(e) => handleShare(e, q)} 
                        className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer bg-transparent border-0"
                        title="Share with apps"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        <span className="hidden sm:inline">Share</span>
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
                        <h4 className="text-body font-semibold m-0 flex items-center gap-1.5 text-[var(--color-text)]">
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

      {/* Modal for creating General Post */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--color-surface)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center">
              <h3 className="text-h3 font-bold text-[var(--color-text)]">Create Forum Post (1 Credit)</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded-full hover:bg-[var(--color-surface-hover)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Category</label>
                <select
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none bg-[var(--color-surface)]"
                >
                  <option value="General">General</option>
                  <option value="Advice">Advice</option>
                  <option value="Recommendation">Recommendation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Post Content *</label>
                <textarea
                  required
                  rows={4}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share an update, ask for recommendations, or start a discussion with your neighbors..."
                  className="input w-full p-2.5 rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none resize-none bg-[var(--color-surface)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPosting || !postBody.trim()}
                  className="px-6 py-2 rounded-xl bg-[var(--color-primary)] text-white font-bold disabled:opacity-50 hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  {isPosting ? "Posting..." : "Post (1 Credit)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <EventFormModal 
        isOpen={isEventModalOpen} 
        initialData={editingEvent}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }} 
        onSuccess={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
          mutate(eventsUrl);
          mutate("/api/profile");
        }} 
      />

      <JobPostModal
        isOpen={isJobModalOpen}
        initialData={editingJob}
        onClose={() => {
          setIsJobModalOpen(false);
          setEditingJob(null);
        }}
        onSuccess={() => {
          setIsJobModalOpen(false);
          setEditingJob(null);
          mutate(jobPostsUrl);
          mutate("/api/profile");
        }}
      />
    </div>
  );
}
