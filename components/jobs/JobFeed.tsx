"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface JobPost {
  id: string;
  type: "seeker" | "giver";
  role: string;
  company?: string;
  experience_years: number;
  skills?: string;
  score?: number;
  user?: { company?: string; job_title?: string };
}

export function JobFeed({ refreshKey }: { refreshKey: number }) {
  const [allPosts, setAllPosts] = useState<JobPost[]>([]);
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [myPost, setMyPost] = useState<JobPost | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [othersCount, setOthersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();



  const [radius, setRadius] = useState(1000);
  const [isRadiusEnabled, setIsRadiusEnabled] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"both" | "seeker" | "giver">("both");
  const [roleFilter, setRoleFilter] = useState("");
  const [expFilter, setExpFilter] = useState("any");
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    try {
      const saved = localStorage.getItem('proxnet_bookmarks');
      if (saved) setBookmarks(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const toggleBookmark = (id: string) => {
    const newBookmarks = { ...bookmarks, [id]: !bookmarks[id] };
    setBookmarks(newBookmarks);
    try {
      localStorage.setItem('proxnet_bookmarks', JSON.stringify(newBookmarks));
    } catch (e) {}
  };


  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let lat = "";
      let lng = "";
      try {
        const { getCurrentPosition } = await import("@/lib/geo/get-current-position");
        const pos = await getCurrentPosition();
        lat = pos.lat.toString();
        lng = pos.lng.toString();
      } catch (e) {
        // Ignore
      }
      
      const effectiveRadius = isRadiusEnabled ? radius : -1;
      fetch(`/api/jobs/feed?radius=${effectiveRadius}&lat=${lat}&lng=${lng}`)
        .then((res) => res.json())
        .then((data) => {
          setAllPosts(data.posts || []);
          setMyPost(data.myPost || null);
          setCurrentUserId(data.currentUserId || null);
          setOthersCount(data.othersCount || 0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    
    fetchData();
  }, [refreshKey, radius, isRadiusEnabled]);

  useEffect(() => {
    let filtered = allPosts;
    if (typeFilter !== "both") {
      filtered = filtered.filter((p: any) => p.type === typeFilter);
    }
    if (roleFilter.trim() !== "") {
      const q = roleFilter.toLowerCase();
      filtered = filtered.filter((p: any) => 
        p.role.toLowerCase().includes(q) || 
        (p.skills && p.skills.toLowerCase().includes(q)) ||
        (p.company && p.company.toLowerCase().includes(q))
      );
    }
    if (expFilter !== "any") {
      filtered = filtered.filter((p: any) => {
        if (expFilter === "entry") return p.experience_years >= 0 && p.experience_years <= 2;
        if (expFilter === "mid") return p.experience_years >= 3 && p.experience_years <= 5;
        if (expFilter === "senior") return p.experience_years > 5;
        return true;
      });
    }
    setPosts(filtered);
  }, [allPosts, typeFilter, roleFilter, expFilter]);

  async function handleStartChat(targetPostId: string) {
    setStartingChat(targetPostId);
    try {
      const res = await fetch("/api/jobs/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPostId, myPostId: myPost?.id }),
      });
      const data = await res.json();
      if (data.threadId) {
        router.push(`/jobs/chat/${data.threadId}`);
      } else {
        throw new Error(data.error || "Failed to start chat");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to start chat: " + (err.message || ""));
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setStartingChat(null);
    }
  }



  async function handleDelete() {
    if (!myPost) return;
    if (!confirm("Are you sure you want to delete your active post?")) return;
    
    try {
      const res = await fetch(`/api/jobs/post?id=${myPost.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      setMyPost(null);
      // Trigger a re-fetch of the feed
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 skeleton h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children relative">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">
          {errorMsg}
        </div>
      )}

      {myPost && (
        <div className="text-center py-3 text-sm text-[var(--color-text-secondary)]">
          {myPost.type === "giver" ? (
            <>You are offering a referral &bull; <strong>along with {othersCount} more offerings</strong></>
          ) : (
            <>You are seeking a referral &bull; <strong>along with {othersCount} more seekers</strong></>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          {myPost 
            ? (myPost.type === "giver" ? "Professionals Seeking Referrals" : "Professionals Offering Referrals")
            : "Available Referrals & Candidates"}
        </h3>
        <button 
          onClick={() => setShowFilters(!showFilters)} 
          className={`btn btn-secondary btn-sm flex items-center gap-2 ${showFilters ? "bg-primary/10 text-primary border-primary/20" : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="card p-4 mb-6 animate-fadeInDown border-t-4 border-primary">
          <h4 className="text-body-sm font-semibold mb-3">Advanced Filters</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <span className="label">Show Types</span>
              <div className="flex gap-2">
                {(["both", "seeker", "giver"] as const).map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer text-body-sm">
                    <input 
                      type="radio" 
                      name="typeFilter" 
                      value={type}
                      checked={typeFilter === type}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="accent-primary"
                    />
                    <span className="capitalize">{type === "both" ? "Both" : type === "seeker" ? "Seekers Only" : "Givers Only"}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer w-max">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  checked={isRadiusEnabled}
                  onChange={(e) => setIsRadiusEnabled(e.target.checked)}
                />
                <span className="label !mb-0">Distance</span>
              </label>
              {isRadiusEnabled && (
                <div className="flex flex-col gap-1 animate-fadeIn mt-2">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>500m</span>
                    <span className="font-medium text-primary">{radius < 1000 ? radius + 'm' : (radius/1000).toFixed(1) + 'km'}</span>
                    <span>50km</span>
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="50000" 
                    step="500"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="label">Role / Keywords</span>
              <input 
                type="text" 
                className="input text-sm" 
                placeholder="e.g. Frontend, React..." 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="label">Experience</span>
              <select 
                className="input text-sm"
                value={expFilter}
                onChange={(e) => setExpFilter(e.target.value)}
              >
                <option value="any">Any Experience</option>
                <option value="entry">0-2 years (Entry)</option>
                <option value="mid">3-5 years (Mid)</option>
                <option value="senior">5+ years (Senior)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 mt-6">
        <span className="text-caption bg-surface-secondary px-2 py-1 rounded hidden sm:inline-block">
          {myPost ? "Sorted by exact match %" : "Sorted by recent"}
        </span>
      </div>

      {myPost && (
        <div className="card p-5 mb-6 animate-fadeIn border border-[var(--color-primary)] bg-[var(--color-primary-light)]/10">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="badge badge-primary mb-2">Your Active Post</span>
              <h4 className="text-h3 mb-1 text-primary">{myPost.role}</h4>
              <div className="flex items-center gap-3 text-caption text-text-secondary">
                <span className={`badge text-xs px-2 ${myPost.type === "giver" ? "bg-primary/10 text-primary border border-primary/20" : "bg-accent/10 text-accent border border-accent/20"}`}>
                  {myPost.type === "giver" ? "Offering Referral" : "Looking for Role"}
                </span>
                {myPost.company && (
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4v18M13 3l8 4v14M7 11h2M7 15h2M15 11h2M15 15h2" /></svg>
                    {myPost.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  {myPost.experience_years} years exp
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const evt = new CustomEvent('editJobPost', { detail: myPost });
                  window.dispatchEvent(evt);
                }} 
                className="btn btn-secondary btn-sm"
              >
                Edit
              </button>
              <button onClick={handleDelete} className="btn btn-ghost btn-sm text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
                Delete
              </button>
            </div>
          </div>
          {myPost.skills && (
            <div className="flex flex-wrap gap-2 mt-3">
              {myPost.skills.split(',').map((s: string) => s.trim()).filter(Boolean).map((skill: string) => (
                <span key={skill} className="badge badge-neutral text-xs px-2">{skill}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="card p-8 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px]">
          <p className="text-body text-text-secondary font-medium">No matches found right now.</p>
          <p className="text-caption mt-1">Check back later as new professionals join.</p>
        </div>
      ) : (
        posts.map((post: any) => {
          return (
            <div key={post.id} className="card p-5 animate-fadeInUp flex flex-col gap-4">
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {post.id.charCodeAt(0) % 2 === 0 && (
                      <span className="badge bg-primary/10 text-primary border border-primary/20 text-[10px] px-1.5 font-bold uppercase tracking-wide shrink-0">New</span>
                    )}
                    <h4 className={`text-h3 mb-1 text-text ${expandedCards[post.id] ? "" : "line-clamp-1"}`}>{post.role}</h4>
                  </div>
                  <div className="flex gap-2">
                    {myPost && typeof post.score === "number" && (
                      <span className="badge border border-[var(--color-primary)] text-[var(--color-primary)] text-xs">
                        {Math.round(post.score)}% Match
                      </span>
                    )}
                    {!myPost && typeof post.distance === "number" && post.distance >= 0 && (
                      <span className="badge badge-neutral text-xs">
                        {post.distance < 1000 ? Math.round(post.distance) + "m away" : (post.distance/1000).toFixed(1) + "km away"}
                      </span>
                    )}
                    <button 
                      onClick={() => toggleBookmark(post.id)}
                      className={`transition-colors ${bookmarks[post.id] ? "text-primary" : "text-text-tertiary hover:text-primary"}`}
                      title={bookmarks[post.id] ? "Remove bookmark" : "Save post"}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarks[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-caption text-text-secondary mb-3">
                  <span className={`badge text-xs px-2 ${post.type === "giver" ? "bg-primary/10 text-primary border border-primary/20" : "bg-accent/10 text-accent border border-accent/20"}`}>
                    {post.type === "giver" ? "Offering Referral" : "Looking for Role"}
                  </span>
                  {post.company && (
                    <span className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4v18M13 3l8 4v14M7 11h2M7 15h2M15 11h2M15 15h2" /></svg>
                      {post.company}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    {post.experience_years} years exp
                  </span>
                </div>
                {post.skills && (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const skillsArray = post.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
                      const isExpanded = expandedCards[post.id];
                      const visibleSkills = isExpanded ? skillsArray : skillsArray.slice(0, 3);
                      const hiddenCount = skillsArray.length - visibleSkills.length;
                      
                      return (
                        <>
                          {visibleSkills.map((skill: string, idx: number) => {
                            const isEven = idx % 2 === 0;
                            return (
                              <span key={skill} className={`text-xs px-2.5 py-1 rounded-full font-medium ${isEven ? "bg-primary/10 text-primary border border-primary/20" : "bg-accent/10 text-accent border border-accent/20"}`}>
                                #{skill}
                              </span>
                            );
                          })}
                          {!isExpanded && hiddenCount > 0 && (
                            <button onClick={() => toggleExpand(post.id)} className="text-xs px-2.5 py-1 text-primary font-medium hover:underline cursor-pointer">
                              +{hiddenCount} more...
                            </button>
                          )}
                          {isExpanded && hiddenCount > 0 && (
                            <button onClick={() => toggleExpand(post.id)} className="text-xs px-2.5 py-1 text-primary font-medium hover:underline cursor-pointer">
                              Show less
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-2 border-t border-border-light">
                <button
                  className="btn btn-accent btn-sm"
                  onClick={() => handleStartChat(post.id)}
                  disabled={startingChat === post.id}
                >
                  {startingChat === post.id ? (
                    <><span className="spinner-sm mr-2" /> Connecting...</>
                  ) : (
                    "Message Anonymously"
                  )}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
