"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";

export function CarpoolFeed({ onRequiresPost }: { onRequiresPost: (data?: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/carpool/feed")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
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

  if (data?.requiresPost) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
        <div className="w-12 h-12 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
        </div>
        <h3 className="text-h3 text-[var(--color-text)] mb-2">Ready to Carpool?</h3>
        <p className="mb-6 max-w-md mx-auto">
          Post a route to see other professionals heading the same way. You can offer a ride or request one.
        </p>
        <button onClick={() => onRequiresPost()} className="btn btn-primary">
          Post a Route
        </button>
      </div>
    );
  }

  const posts = data.posts || [];
  const myPost = data.myPost;

  const handleInitiateChat = async (targetPostId: string) => {
    setInitiating(targetPostId);
    try {
      const res = await fetch("/api/carpool/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPostId, myPostId: myPost.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start chat");
      
      router.push(`/carpool/chat/${json.threadId}`);
    } catch (err: any) {
      alert(err.message);
      setInitiating(null);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <span className="badge bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]">{score}% Match</span>;
    if (score >= 50) return <span className="badge bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]">{score}% Match</span>;
    return <span className="badge badge-neutral">{score}% Match</span>;
  };

  const displayPosts = myPost ? [{ ...myPost, isMine: true }, ...posts] : posts;

  return (
    <div className="space-y-4 stagger-children">
      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          {myPost.type === "giver" ? "Professionals Needing a Ride" : "Professionals Driving Your Way"}
        </h3>
        <button onClick={() => onRequiresPost(myPost)} className="btn btn-secondary btn-sm">
          Edit Route
        </button>
      </div>

      {displayPosts.length === 1 && displayPosts[0].isMine && (
        <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
          <p>No matches found right now.</p>
          <p className="text-sm mt-1">We'll let you know when someone posts a matching route for this date.</p>
        </div>
      )}

      {displayPosts.map((post: any) => (
        <div key={post.id} className={`card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center transition-colors ${post.isMine ? "border-[var(--color-primary)]" : "hover:bg-[var(--color-surface-hover)]"}`}>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 mb-2">
                {post.isMine ? (
                  <span className="badge badge-accent text-xs">Your Route</span>
                ) : (
                  getScoreBadge(post.score)
                )}
                <span className="text-caption text-[var(--color-text-secondary)]">
                  {post.type === "giver" ? "Offering" : "Needs"} {post.seats} seat{post.seats > 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{post.isMine ? "You" : post.user?.job_title}</span>
              {!post.isMine && (
                <>
                  <span className="text-[var(--color-text-tertiary)]">at</span>
                  <span className="font-semibold text-[var(--color-primary)]">{post.user?.company}</span>
                </>
              )}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3">
              <div className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                {post.time_start.slice(0,5)} - {post.time_end.slice(0,5)}
              </div>
              {!post.isMine && post.distance !== undefined && (
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                  Destination within {post.distance < 1000 ? Math.round(post.distance) + "m" : (post.distance/1000).toFixed(1) + "km"}
                </div>
              )}
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <button 
              onClick={() => handleInitiateChat(post.id)}
              disabled={initiating === post.id || post.isMine}
              className={`btn w-full sm:w-auto ${post.type === "giver" ? "btn-accent" : "btn-primary"} ${post.isMine ? "btn-disabled" : ""}`}
            >
              {initiating === post.id ? "Opening..." : post.isMine ? "Your Route" : "Message Anonymously"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
