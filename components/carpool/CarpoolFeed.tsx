"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPosition } from "@/lib/geo/get-current-position";

export function CarpoolFeed({ onRequiresPost }: { onRequiresPost: (data?: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState<string | null>(null);
  const [radius, setRadius] = useState(1000);
  const [isRadiusEnabled, setIsRadiusEnabled] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"both" | "seeker" | "giver">("both");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let lat = "";
      let lng = "";
      try {
        const pos = await getCurrentPosition();
        lat = pos.lat.toString();
        lng = pos.lng.toString();
      } catch (e) {
        // Ignore
      }
      
      const effectiveRadius = isRadiusEnabled ? radius : -1;
      const res = await fetch(`/api/carpool/feed?radius=${effectiveRadius}&lat=${lat}&lng=${lng}`);
      const d = await res.json();
      setData(d);
      setLoading(false);
    }
    fetchData();
  }, [radius, isRadiusEnabled]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 skeleton h-24" />
        ))}
      </div>
    );
  }

  const myPost = data?.myPost;
  let posts = data?.posts || [];
  let suggestions = data?.suggestions || [];
  
  // Apply local type filter
  if (typeFilter !== "both") {
    posts = posts.filter((p: any) => p.type === typeFilter);
  }

  const handleInitiateChat = async (targetPostId: string) => {
    setInitiating(targetPostId);
    try {
      const res = await fetch("/api/carpool/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // myPostId could be undefined if they don't have a post
        body: JSON.stringify({ targetPostId, myPostId: myPost?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start chat");
      
      router.push(`/carpool/chat/${json.threadId}`);
    } catch (err: any) {
      alert(err.message);
      setInitiating(null);
    }
  };

  const handleInitiateDirectChat = async (targetUserId: string) => {
    setInitiating(targetUserId);
    try {
      const res = await fetch("/api/carpool/chat/init-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start chat");
      
      router.push(`/carpool/chat/${json.threadId}`);
    } catch (err: any) {
      alert(err.message);
      setInitiating(null);
    }
  };

  const handleDelete = async () => {
    if (!myPost) return;
    if (!confirm("Are you sure you want to delete your active route?")) return;
    try {
      const res = await fetch(`/api/carpool/post?id=${myPost.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post");
      setData({ ...data, myPost: null });
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getMatchRing = (score: number) => {
    let color = "var(--color-primary)";
    if (score >= 80) color = "var(--color-success)";
    else if (score >= 50) color = "var(--color-warning)";
    else color = "var(--color-text-tertiary)";
    
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center w-12 h-12 flex-shrink-0" title={`${score}% Match`}>
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} stroke="currentColor" strokeWidth="3" fill="transparent" className="text-border" />
          <circle cx="24" cy="24" r={radius} stroke={color} strokeWidth="3" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
        </svg>
        <span className="absolute text-[10px] font-bold" style={{ color }}>{score}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4 stagger-children">
      <div className="flex justify-between items-center mb-4">
        <div className="flex bg-surface-secondary p-1 rounded-lg">
          <button 
            onClick={() => setViewMode("list")} 
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === "list" ? "bg-surface shadow-sm font-medium" : "text-text-secondary hover:text-text"}`}
          >
            List
          </button>
          <button 
            onClick={() => setViewMode("map")} 
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === "map" ? "bg-surface shadow-sm font-medium" : "text-text-secondary hover:text-text"}`}
          >
            Map
          </button>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`btn btn-secondary btn-sm flex items-center gap-2 ${showFilters ? "bg-primary/10 text-primary border-primary/20" : ""}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
          </button>
          {!myPost && (
            <button onClick={() => onRequiresPost()} className="btn btn-primary btn-sm hidden sm:block">
              Post a Route
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 mb-6 animate-fadeInDown border-t-4 border-primary">
          <h4 className="text-body-sm font-semibold mb-3">Filter Options</h4>
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
                    <span className="capitalize">{type === "both" ? "Both" : type + "s Only"}</span>
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
                <span className="label !mb-0">Filter by Distance</span>
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
          </div>
        </div>
      )}

      {viewMode === "map" ? (
        <div className="card p-8 flex flex-col items-center justify-center animate-fadeIn text-center min-h-[300px]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary mb-4"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          <h3 className="text-h3 mb-2">Interactive Map View</h3>
          <p className="text-body-sm text-text-secondary max-w-sm mx-auto">
            This feature is coming soon. You'll be able to see all carpools visually on a map.
          </p>
          <button onClick={() => setViewMode("list")} className="btn btn-secondary mt-4">Return to List</button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4 mt-6">
            <h3 className="text-h3">
              {myPost 
                ? (myPost.type === "giver" ? "Professionals Needing a Ride" : "Professionals Driving Your Way")
                : "Available Carpools Near You"}
            </h3>
            <span className="text-caption bg-surface-secondary px-2 py-1 rounded">
              {myPost ? "Sorted by exact match %" : "Sorted by distance"}
            </span>
          </div>

      {suggestions.length > 0 && (
        <div className="mb-8">
          <h4 className="text-h4 mb-4 text-primary flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
            Suggested Connections
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map((s: any) => (
              <div key={s.user.id} className="card p-4 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                  <div className="avatar avatar-md">
                    {s.user.profile_photo_url ? (
                      <img src={s.user.profile_photo_url} alt={s.user.full_name} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-primary font-bold">
                        {s.user.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{s.user.full_name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{s.user.job_title} at {s.user.company}</div>
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span>Home Compatibility:</span> <strong>{s.homeDist < 1000 ? Math.round(s.homeDist) + "m" : (s.homeDist/1000).toFixed(1) + "km"}</strong></div>
                  <div className="flex justify-between"><span>Office Compatibility:</span> <strong>{s.officeDist < 1000 ? Math.round(s.officeDist) + "m" : (s.officeDist/1000).toFixed(1) + "km"}</strong></div>
                </div>
                <button 
                  onClick={() => handleInitiateDirectChat(s.user.id)}
                  disabled={initiating === s.user.id}
                  className="btn btn-sm btn-accent w-full mt-auto"
                >
                  {initiating === s.user.id ? "Opening..." : "Message"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {myPost && (
        <div className="card p-5 mb-6 animate-fadeIn border border-[var(--color-primary)] bg-[var(--color-primary-light)]/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className={`badge mb-2 text-xs px-2 ${myPost.type === "giver" ? "bg-primary/10 text-primary border border-primary/20" : "bg-accent/10 text-accent border border-accent/20"}`}>
                Your Active Route: {myPost.type === "giver" ? "Offering" : "Needs"} {myPost.seats} seat{myPost.seats > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onRequiresPost(myPost)} className="btn btn-secondary btn-sm">
                Edit
              </button>
              <button onClick={handleDelete} className="btn btn-ghost btn-sm text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
                Delete
              </button>
            </div>
          </div>
          
          <div className="text-sm text-[var(--color-text-secondary)] grid grid-cols-1 gap-y-2">
            <div className="flex flex-col gap-1.5 bg-[var(--color-surface)] p-3 rounded border border-border">
              <div>
                <strong>Summary: </strong>
                {myPost.type === "giver" ? "Offering" : "Seeking"} {myPost.seats} seat{myPost.seats > 1 ? 's' : ''} for travel from <em>{myPost.start_name}</em> to <em>{myPost.dest_name}</em>, on {myPost.is_recurring 
                  ? "recurring days" 
                  : new Date(myPost.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                }. Will wait between {myPost.time_start.slice(0,5)} and {myPost.time_end.slice(0,5)}.
              </div>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
          <p>No matches found right now.</p>
          <p className="text-sm mt-1">We'll let you know when someone posts a matching route for this date.</p>
        </div>
      )}

      {posts.map((post: any) => (
        <div key={post.id} className="card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-[var(--color-surface-hover)] transition-colors">
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 mb-2">
                {myPost && getMatchRing(post.score)}
                <span className={`badge text-xs px-2 ${post.type === "giver" ? "bg-primary/10 text-primary border border-primary/20" : "bg-accent/10 text-accent border border-accent/20"}`}>
                  {post.type === "giver" ? "Offering" : "Needs"} {post.seats} seat{post.seats > 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{post.user?.job_title}</span>
              <span className="text-[var(--color-text-tertiary)]">at</span>
              <span className="font-semibold text-[var(--color-primary)]">{post.user?.company}</span>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] grid grid-cols-1 gap-y-2 mt-3">
              <div className="flex flex-col gap-1.5 bg-[var(--color-surface)] p-3 rounded border border-border">
                <div>
                  <strong>Summary: </strong>
                  {post.type === "giver" ? "Offering" : "Seeking"} {post.seats} seat{post.seats > 1 ? 's' : ''} for travel from <em>{post.start_name}</em> to <em>{post.dest_name}</em>, on {post.is_recurring 
                    ? "recurring days" 
                    : new Date(post.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                  }. Will wait between {post.time_start.slice(0,5)} and {post.time_end.slice(0,5)}.
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                  {post.is_recurring 
                    ? `Recurring: ${post.recurring_days.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}` 
                    : new Date(post.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                  }
                </div>
                {post.distance !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                    Within {post.distance < 1000 ? Math.round(post.distance) + "m" : (post.distance/1000).toFixed(1) + "km"}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <button 
              onClick={() => handleInitiateChat(post.id)}
              disabled={initiating === post.id}
              className={`btn w-full sm:w-auto ${post.type === "giver" ? "btn-accent" : "btn-primary"}`}
            >
              {initiating === post.id ? "Opening..." : "Message Anonymously"}
            </button>
          </div>
        </div>
      ))}
        </>
      )}
    </div>
  );
}
