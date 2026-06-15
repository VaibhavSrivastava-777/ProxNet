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
          setPosts(data.posts || []);
          setMyPost(data.myPost || null);
          setCurrentUserId(data.currentUserId || null);
          setOthersCount(data.othersCount || 0);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    
    fetchData();
  }, [refreshKey, radius, isRadiusEnabled]);

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

      <div className="card p-4 mb-6 flex flex-col gap-3">
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

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          {myPost 
            ? (myPost.type === "giver" ? "Professionals Seeking Referrals" : "Professionals Offering Referrals")
            : "Available Referrals & Candidates"}
        </h3>
        <span className="text-caption bg-surface-secondary px-2 py-1 rounded">
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
                <span className="badge badge-neutral text-xs px-2">{myPost.type === "giver" ? "Offering Referral" : "Looking for Role"}</span>
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
                    <h4 className="text-h3 mb-1 text-primary">{post.role}</h4>
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
                  </div>
                </div>
                <div className="flex items-center gap-3 text-caption text-text-secondary mb-3">
                  <span className="badge badge-neutral text-xs px-2">{post.type === "giver" ? "Offering Referral" : "Looking for Role"}</span>
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
                    {post.skills.split(',').map((s: string) => s.trim()).filter(Boolean).map((skill: string) => (
                      <span key={skill} className="badge badge-neutral text-xs px-2">{skill}</span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-2 border-t border-border-light">
                <button
                  className="btn btn-primary btn-sm"
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
