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
  created_at: string;
  is_on_behalf?: boolean;
  contact_number?: string;
}

export function JobFeed({ refreshKey }: { refreshKey: number }) {
  const [allPosts, setAllPosts] = useState<JobPost[]>([]);
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [myPosts, setMyPosts] = useState<JobPost[]>([]);
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
          setMyPosts(data.myPosts || (data.myPost ? [data.myPost] : []));
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
  
  useEffect(() => {
    if (posts.length > 0 || myPosts.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('id');
      if (targetId) {
        const el = document.getElementById(`post-${targetId}`);
        if (el) {
          // Add a short delay to let layout settle
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setExpandedCards(prev => ({ ...prev, [targetId]: true }));
            
            // Add highlight
            el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-[var(--color-background)]', 'transition-all');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-[var(--color-background)]');
            }, 3000);
          }, 100);
        }
      }
    }
  }, [posts, myPosts]);

  const handleShare = async (post: any) => {
    const text = `Check out this post for ${post.role}${post.company ? ` at ${post.company}` : ''} on ProxNet!`;
    const url = `${window.location.origin}/jobs?id=${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ProxNet Job Post',
          text: text,
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert("Link copied to clipboard!");
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  };

  async function handleStartChat(targetPostId: string) {
    setStartingChat(targetPostId);
    try {
      // Find the opposite type post from myPosts to link this chat to
      const targetPost = allPosts.find(p => p.id === targetPostId);
      let myPostId = myPosts[0]?.id;
      if (targetPost) {
        const compatiblePost = myPosts.find(p => p.type !== targetPost.type);
        if (compatiblePost) myPostId = compatiblePost.id;
      }

      const res = await fetch("/api/jobs/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPostId, myPostId }),
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



  async function handleDelete(postId: string) {
    if (!confirm("Are you sure you want to delete this active post?")) return;
    
    try {
      const res = await fetch(`/api/jobs/post?id=${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      setMyPosts(prev => prev.filter(p => p.id !== postId));
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

      {myPosts.length > 0 && (
        <div className="card p-4 bg-primary/5 border border-primary/20 flex flex-col gap-3">
          <h4 className="text-body-sm font-bold text-primary">Your Active Posts</h4>
          {myPosts.map(myPost => (
            <div key={myPost.id} id={`post-${myPost.id}`} className="card p-5 animate-fadeInUp flex flex-col gap-4 border border-[var(--color-primary)] bg-[var(--color-primary-light)]/10">
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    <span className="badge badge-primary text-[10px] px-1.5 font-bold uppercase tracking-wide shrink-0 mt-1">Your Post</span>
                    <div>
                      <h4 className={`text-h3 mb-1 text-primary ${expandedCards[myPost.id] ? "" : "line-clamp-1"}`}>{myPost.role}</h4>
                      {myPost.role.length > 25 && (
                        <button onClick={() => toggleExpand(myPost.id)} className="text-xs text-primary font-medium hover:underline cursor-pointer">
                          {expandedCards[myPost.id] ? "less" : "more"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleShare(myPost)}
                      className="btn btn-ghost btn-sm text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/20 px-2"
                      title="Share Post"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button 
                      onClick={() => {
                        const evt = new CustomEvent('editJobPost', { detail: myPost });
                        window.dispatchEvent(evt);
                      }} 
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(myPost.id)}
                      className="btn btn-ghost btn-sm text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                      title="Delete Post"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-caption text-text-secondary mb-3 mt-2">
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
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Posted {new Date(myPost.created_at).toLocaleDateString()}
                  </span>
                </div>
                {myPost.skills && (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const skillsArray = myPost.skills!.split(',').map((s: string) => s.trim()).filter(Boolean);
                      const isExpanded = expandedCards[myPost.id];
                      const visibleSkills = isExpanded ? skillsArray : skillsArray.slice(0, 3);
                      const originalHiddenCount = skillsArray.length - 3;
                      
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
                          {!isExpanded && originalHiddenCount > 0 && (
                            <button onClick={() => toggleExpand(myPost.id)} className="text-xs px-2.5 py-1 text-primary font-medium hover:underline cursor-pointer">
                              +{originalHiddenCount} more...
                            </button>
                          )}
                          {isExpanded && originalHiddenCount > 0 && (
                            <button onClick={() => toggleExpand(myPost.id)} className="text-xs px-2.5 py-1 text-primary font-medium hover:underline cursor-pointer">
                              Show less
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="text-xs text-text-secondary mt-1">
            There are {othersCount} active candidates right now.
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          Available Referrals & Candidates
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
          {myPosts.length > 0 ? "Sorted by exact match %" : "Sorted by recent"}
        </span>
      </div>

    
      {posts.length === 0 ? (
        <div className="card p-8 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px]">
          <p className="text-body text-text-secondary font-medium">No matches found right now.</p>
          <p className="text-caption mt-1">Check back later as new professionals join.</p>
        </div>
      ) : (
        posts.map((post: any) => {
          return (
            <div key={post.id} id={`post-${post.id}`} className="card p-5 animate-fadeInUp flex flex-col gap-4">
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    {post.id.charCodeAt(0) % 2 === 0 && (
                      <span className="badge bg-primary/10 text-primary border border-primary/20 text-[10px] px-1.5 font-bold uppercase tracking-wide shrink-0 mt-1">New</span>
                    )}
                    <div>
                      <h4 className={`text-h3 mb-1 text-text ${expandedCards[post.id] ? "" : "line-clamp-1"}`}>{post.role}</h4>
                      {post.role.length > 25 && (
                        <button onClick={() => toggleExpand(post.id)} className="text-xs text-primary font-medium hover:underline cursor-pointer">
                          {expandedCards[post.id] ? "less" : "more"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {myPosts.length > 0 && typeof post.score === "number" && (
                      <span className="badge border border-[var(--color-primary)] text-[var(--color-primary)] text-xs">
                        {Math.round(post.score)}% Match
                      </span>
                    )}
                    {myPosts.length === 0 && typeof post.distance === "number" && post.distance >= 0 && (
                      <span className="badge badge-neutral text-xs">
                        {post.distance < 1000 ? Math.round(post.distance) + "m away" : (post.distance/1000).toFixed(1) + "km away"}
                      </span>
                    )}
                    <button 
                      onClick={() => handleShare(post)}
                      className="text-text-tertiary hover:text-primary transition-colors"
                      title="Share Post"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
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
                  <span className="flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Posted {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
                {post.skills && (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const skillsArray = post.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
                      const isExpanded = expandedCards[post.id];
                      const visibleSkills = isExpanded ? skillsArray : skillsArray.slice(0, 3);
                      const originalHiddenCount = skillsArray.length - 3;
                      
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
                          {!isExpanded && originalHiddenCount > 0 && (
                            <button onClick={() => toggleExpand(post.id)} className="text-xs px-2.5 py-1 text-primary font-medium hover:underline cursor-pointer">
                              +{originalHiddenCount} more...
                            </button>
                          )}
                          {isExpanded && originalHiddenCount > 0 && (
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
              
              <div className="flex justify-end pt-2 border-t border-border-light gap-2">
                {post.is_on_behalf && post.contact_number ? (
                  <a
                    href={`https://wa.me/${post.contact_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I saw your post for ${post.role}${post.company ? ` at ${post.company}` : ''} on ProxNet.in (https://www.proxnet.in/jobs).`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm flex items-center gap-2 border-[var(--color-primary)] text-[var(--color-primary)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    WhatsApp
                  </a>
                ) : (
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
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
