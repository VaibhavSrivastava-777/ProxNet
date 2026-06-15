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

  const posts = data?.posts || [];
  const myPost = data?.myPost;

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

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <span className="badge bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]">{score}% Match</span>;
    if (score >= 50) return <span className="badge bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]">{score}% Match</span>;
    return <span className="badge badge-neutral">{score}% Match</span>;
  };

  return (
    <div className="space-y-4 stagger-children">
      <div className="card p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col gap-3 w-full">
          <label className="flex items-center gap-2 cursor-pointer w-max">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              checked={isRadiusEnabled}
              onChange={(e) => setIsRadiusEnabled(e.target.checked)}
            />
            <span className="text-body-sm font-medium">Filter by distance</span>
          </label>
          
          {isRadiusEnabled && (
            <label className="flex flex-col gap-1 animate-fadeIn">
              <span className="label text-xs">Search Radius: {radius < 1000 ? radius + 'm' : (radius/1000).toFixed(1) + 'km'}</span>
              <input 
                type="range" 
                min="500" 
                max="50000" 
                step="500"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </label>
          )}
        </div>
        {!myPost && (
          <button onClick={() => onRequiresPost()} className="btn btn-primary sm:w-auto w-full whitespace-nowrap">
            Post a Route
          </button>
        )}
      </div>

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          {myPost 
            ? (myPost.type === "giver" ? "Professionals Needing a Ride" : "Professionals Driving Your Way")
            : "Available Carpools Near You"}
        </h3>
        <span className="text-caption bg-surface-secondary px-2 py-1 rounded">
          {myPost ? "Sorted by exact match %" : "Sorted by distance"}
        </span>
      </div>

      {myPost && (
        <div className="card p-5 mb-6 animate-fadeIn border border-[var(--color-primary)] bg-[var(--color-primary-light)]/10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="badge badge-primary mb-2">Your Active Route</span>
              <h4 className="text-h3 text-primary">
                {myPost.type === "giver" ? "Offering" : "Needs"} {myPost.seats} seat{myPost.seats > 1 ? "s" : ""}
              </h4>
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
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-primary mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                <div>
                  <span className="font-medium text-text-primary">Source: </span>
                  <span className="text-text-secondary">{myPost.start_name || "Location not specified"}</span>
                  <span className="text-caption ml-1">@ {myPost.time_start.slice(0,5)} - {myPost.time_end.slice(0,5)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-accent mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                <div>
                  <span className="font-medium text-text-primary">Destination: </span>
                  <span className="text-text-secondary">{myPost.dest_name || "Location not specified"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                {myPost.is_recurring 
                  ? `Recurring: ${myPost.recurring_days.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}` 
                  : new Date(myPost.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                }
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
                {myPost && getScoreBadge(post.score)}
                <span className="text-caption text-[var(--color-text-secondary)]">
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
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-primary mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  <div>
                    <span className="font-medium text-text-primary">Source: </span>
                    <span className="text-text-secondary">{post.start_name || "Location not specified"}</span>
                    <span className="text-caption ml-1">@ {post.time_start.slice(0,5)} - {post.time_end.slice(0,5)}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-accent mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                  <div>
                    <span className="font-medium text-text-primary">Destination: </span>
                    <span className="text-text-secondary">{post.dest_name || "Location not specified"}</span>
                  </div>
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
    </div>
  );
}
