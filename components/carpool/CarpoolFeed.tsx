"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPosition } from "@/lib/geo/get-current-position";
import { RouteMap } from "@/components/map/RouteMap";

export function CarpoolFeed({ onRequiresPost }: { onRequiresPost: (data?: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMapPost, setActiveMapPost] = useState<any | null>(null);
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        let lat = "";
        let lng = "";
        try {
          const pos = await getCurrentPosition();
          lat = pos.lat.toString();
          lng = pos.lng.toString();
          setCoords({ lat: pos.lat, lng: pos.lng });
        } catch (e) {
          // Ignore
        }

        // Just fetch the feed within 2km (2000m)
        const res = await fetch(`/api/carpool/feed?radius=2000&lat=${lat}&lng=${lng}`);
        const d = await res.json();
        
        // For a chat feed, we usually want chronological order. The API might return sorted by score.
        // We will sort them by created_at ascending (oldest first, newest at bottom) for a chat feel,
        // or descending if we want newest at top. Let's do descending (newest at top) so they don't have to scroll down.
        if (d.posts) {
          d.posts.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }
        
        setData(d);
      } catch (e) {
        // Ignore
      }
      setLoading(false);
    }
    fetchData();
  }, []);

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

  // Include myPost in the feed if it exists so I can see my own shout
  if (myPost && !posts.find((p: any) => p.id === myPost.id)) {
    posts = [myPost, ...posts].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  const handleInitiateChat = async (targetPostId: string) => {
    setInitiating(targetPostId);
    try {
      const res = await fetch("/api/carpool/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; const p = Math.PI / 180;
    const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  };

  const getLocDisplay = (post: any, isStart: boolean, isMe: boolean) => {
    let name = isStart ? post.start_name : post.dest_name;
    const lat = isStart ? post.start_lat : post.dest_lat;
    const lng = isStart ? post.start_lng : post.dest_lng;
    
    let isGeneric = !name || name.toLowerCase() === "home" || name.toLowerCase() === "office";
    
    if (isGeneric && post.user) {
      const userHomeLat = Number(post.user.home_lat);
      const userHomeLng = Number(post.user.home_lng);
      const userOfficeLat = Number(post.user.office_lat);
      const userOfficeLng = Number(post.user.office_lng);

      if (userHomeLat && userHomeLng && Math.abs(lat - userHomeLat) < 0.0001 && Math.abs(lng - userHomeLng) < 0.0001) {
        if (post.user.home_name && post.user.home_name.toLowerCase() !== "home") {
          name = post.user.home_name;
          isGeneric = false;
        }
      } else if (userOfficeLat && userOfficeLng && Math.abs(lat - userOfficeLat) < 0.0001 && Math.abs(lng - userOfficeLng) < 0.0001) {
        if (post.user.office_name && post.user.office_name.toLowerCase() !== "office") {
          name = post.user.office_name;
          isGeneric = false;
        }
      }
    }

    if (isMe) {
      return name || (isStart ? "Home" : "Office");
    }

    if (isGeneric) {
      if (coords) {
        const dist = haversineDistance(coords.lat, coords.lng, lat, lng);
        const distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
        return `${isStart ? "their Home" : "their Office"} (${distStr} away)`;
      }
      return isStart ? "their Home" : "their Office";
    }

    return name;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[var(--color-surface-secondary)] p-3 rounded-lg">
        <h3 className="text-h4 font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
          Live Commute Stream
        </h3>
        {!myPost && (
          <button onClick={() => onRequiresPost()} className="btn btn-primary btn-sm">
            Post a Route
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4" ref={feedRef}>
        {posts.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
            <p>No active commutes right now.</p>
            <p className="text-sm mt-1">Be the first to post a route today!</p>
          </div>
        )}

        {posts.map((post: any) => {
          const isMe = myPost && post.id === myPost.id;
          const userName = post.user?.full_name || post.user?.name || "Professional";
          const firstName = userName.split(" ")[0];
          const initial = firstName.charAt(0).toUpperCase();

          return (
            <div key={post.id} className="flex flex-col gap-1 animate-fadeInUp">
              {/* Main Chat Bubble */}
              <div className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 border transition-all ${
                  isMe
                    ? "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
                    : post.type === "giver"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                }`}>
                  {initial}
                </div>
                
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%]`}>
                  <div className="text-xs text-[var(--color-text-tertiary)] mb-1 flex items-center gap-2">
                    <span className="font-semibold text-[var(--color-text-secondary)]">{userName}</span>
                    <span>•</span>
                    <span>{post.user?.job_title} at {post.user?.company}</span>
                  </div>

                  <div className={`p-4 rounded-2xl text-sm border shadow-sm relative group transition-all ${
                    isMe 
                      ? "rounded-tr-sm bg-gradient-to-l from-indigo-50/20 via-[var(--color-surface)] to-[var(--color-surface)] border-l-4 border-l-indigo-500 border-t-indigo-500/10 border-r-indigo-500/10 border-b-indigo-500/10 text-[var(--color-text)]" 
                      : post.type === "giver" 
                        ? "rounded-tl-sm bg-gradient-to-r from-emerald-50/20 via-[var(--color-surface)] to-[var(--color-surface)] border-l-4 border-l-emerald-500 border-t-emerald-500/10 border-r-emerald-500/10 border-b-emerald-500/10" 
                        : "rounded-tl-sm bg-gradient-to-r from-amber-50/20 via-[var(--color-surface)] to-[var(--color-surface)] border-l-4 border-l-amber-500 border-t-amber-500/10 border-r-amber-500/10 border-b-amber-500/10"
                  }`}>
                    {/* Commute Pill Badge */}
                    <div className="mb-2 flex flex-wrap gap-2 items-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isMe
                          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                          : post.type === "giver"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}>
                        {isMe ? "My Commute ✨" : post.type === "giver" ? "Driving 🚗" : "Seeking Ride 🚶‍♂️"}
                      </span>

                      {!isMe && typeof post.score === "number" && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          post.score >= 70
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : post.score >= 50
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                              : "bg-gray-50 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
                        }`}>
                          {post.score >= 50 ? `${Math.round(post.score)}% Match` : "Less than 50% match"}
                        </span>
                      )}
                    </div>

                    <span>
                      <strong className="text-[var(--color-text)]">{firstName}</strong> is <strong>{post.type === "giver" ? "driving" : "seeking a ride"}</strong> from <span className="font-medium text-[var(--color-text)]">{getLocDisplay(post, true, !!isMe)}</span> to <span className="font-medium text-[var(--color-text)]">{getLocDisplay(post, false, !!isMe)}</span> around <span className="font-medium text-[var(--color-text)]">{formatTime(post.time_start)}</span> today.
                    </span>

                    <div className="mt-3 flex gap-2 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setActiveMapPost(post)}
                        className="btn btn-ghost btn-sm text-primary h-8 min-h-0 px-3"
                      >
                        View Map
                      </button>
                      {isMe ? (
                        <button onClick={handleDelete} className="btn btn-ghost btn-sm text-[var(--color-error)] h-8 min-h-0 px-3">
                          Delete
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleInitiateChat(post.id)}
                          disabled={initiating === post.id}
                          className={`btn btn-sm h-8 min-h-0 px-4 ${post.type === "giver" ? "btn-accent" : "btn-primary"}`}
                        >
                          {initiating === post.id ? "Opening..." : "Message"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ProxNet AI Reply */}
              {post.ai_summary && (
                <div className={`flex gap-3 mt-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="w-10 h-10 flex-shrink-0" /> {/* Spacer */}
                  <div className="flex items-start gap-2 bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] p-2 px-3 rounded-2xl rounded-tl-sm text-xs text-[var(--color-text-secondary)] max-w-[70%]">
                    <span className="text-lg leading-none">✨</span>
                    <div>
                      <span className="font-semibold text-primary">ProxNet AI:</span> {post.ai_summary}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Route Map Modal */}
      {activeMapPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scaleIn">
            <div className="p-4 border-b border-[var(--color-border-light)] flex justify-between items-center bg-[var(--color-surface-secondary)]">
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Commute Route: {activeMapPost.user?.full_name || "Professional"}
              </h3>
              <button onClick={() => setActiveMapPost(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                ✕
              </button>
            </div>
            <div className="h-96 w-full relative">
              <RouteMap 
                startLat={activeMapPost.start_lat}
                startLng={activeMapPost.start_lng}
                destLat={activeMapPost.dest_lat}
                destLng={activeMapPost.dest_lng}
                startName={activeMapPost.start_name}
                destName={activeMapPost.dest_name}
              />
            </div>
            <div className="p-4 bg-[var(--color-surface-secondary)] border-t border-[var(--color-border-light)] flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
              <div><strong>From:</strong> {getLocDisplay(activeMapPost, true, activeMapPost.id === myPost?.id)}</div>
              <div><strong>To:</strong> {getLocDisplay(activeMapPost, false, activeMapPost.id === myPost?.id)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
