"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CarpoolFeedProps {
  onRequiresPost: () => void;
}

export function CarpoolFeed({ onRequiresPost }: CarpoolFeedProps) {
  const router = useRouter();
  const { data, error, mutate } = useSWR("/api/carpool/feed", fetcher);
  const [initiating, setInitiating] = useState<string | null>(null);

  if (error) return <div className="alert alert-error">Failed to load matches.</div>;
  
  if (!data) return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 skeleton h-32 w-full" />
      ))}
    </div>
  );

  if (data.requiresPost) {
    return (
      <div className="text-center py-12 animate-fadeInUp">
        <div className="w-16 h-16 mx-auto bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center mb-4 text-[var(--color-text-secondary)]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
        </div>
        <h3 className="text-h3 mb-2">No Active Route</h3>
        <p className="text-body-sm text-[var(--color-text-secondary)] mb-6 max-w-sm mx-auto">
          Post your daily commute or one-off route to see matching professionals heading the same way.
        </p>
        <button onClick={onRequiresPost} className="btn btn-primary">
          Post a Route
        </button>
      </div>
    );
  }

  const posts = data.posts || [];
  const myPost = data.myPost;

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
        <p>No matches found right now.</p>
        <p className="text-sm mt-1">We'll let you know when someone posts a matching route.</p>
        <button onClick={onRequiresPost} className="btn btn-ghost btn-sm mt-4">
          Update My Route
        </button>
      </div>
    );
  }

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

  return (
    <div className="space-y-4 stagger-children">
      <div className="alert alert-info">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span>
          You are currently <strong>{myPost.type === "giver" ? "offering" : "seeking"} {myPost.seats} seat(s)</strong> as a {myPost.type === "giver" ? "Giver" : "Seeker"}.
        </span>
      </div>

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          {myPost.type === "giver" ? "Professionals Needing a Ride" : "Professionals Driving Your Way"}
        </h3>
        <button onClick={onRequiresPost} className="btn btn-ghost btn-sm">
          Edit Route
        </button>
      </div>

      {posts.map((post: any) => (
        <div key={post.id} className="card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-[var(--color-surface-hover)] transition-colors">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getScoreBadge(post.score)}
              <span className="text-caption text-[var(--color-text-secondary)]">
                {post.type === "giver" ? "Offering" : "Needs"} {post.seats} seat{post.seats > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{post.user.job_title}</span>
              <span className="text-[var(--color-text-tertiary)]">at</span>
              <span className="font-semibold text-[var(--color-primary)]">{post.user.company}</span>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)] grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3">
              <div className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                {post.time_start.slice(0,5)} - {post.time_end.slice(0,5)}
              </div>
              <div className="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                Destination within {post.distance < 1000 ? Math.round(post.distance) + "m" : (post.distance/1000).toFixed(1) + "km"}
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
