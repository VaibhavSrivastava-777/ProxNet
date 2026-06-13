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
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch("/api/jobs/feed")
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.posts || []);
        setMyPost(data.myPost || null);
        setCurrentUserId(data.currentUserId || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  async function handleStartChat(targetPostId: string) {
    if (!myPost) {
      setErrorMsg("You must create your own Job Post (as a Giver or Seeker) before you can message someone.");
      setTimeout(() => setErrorMsg(""), 5000);
      return;
    }
    setStartingChat(targetPostId);
    try {
      const res = await fetch("/api/jobs/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPostId, myPostId: myPost.id }),
      });
      const data = await res.json();
      if (data.threadId) {
        router.push(`/jobs/chat/${data.threadId}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStartingChat(null);
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
    <div className="space-y-4 stagger-children">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">
          {errorMsg}
        </div>
      )}

      {myPost ? (
        <div className="alert alert-info">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>
            You have an active post as a <strong>{myPost.type === "seeker" ? "Seeker" : "Giver"}</strong> for <strong>{myPost.role}</strong>.
          </span>
        </div>
      ) : (
        <div className="alert alert-warning">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>
            You are browsing the feed without an active post. <strong>Create a post</strong> to message professionals!
          </span>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          Available Referrals & Candidates
        </h3>
        <span className="text-caption bg-surface-secondary px-2 py-1 rounded">Sorted by relevance</span>
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px]">
          <p className="text-body text-text-secondary font-medium">No matches found right now.</p>
          <p className="text-caption mt-1">Check back later as new professionals join.</p>
        </div>
      ) : (
        posts.map((post: any) => {
          const isMyOwnPost = post.user_id === currentUserId;

          return (
            <div key={post.id} className={`card p-5 animate-fadeInUp flex flex-col gap-4 ${isMyOwnPost ? "border-primary" : ""}`}>
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <h4 className="text-h3 mb-1 text-primary">{post.role}</h4>
                    {isMyOwnPost && <span className="badge badge-accent text-xs">Your Post</span>}
                  </div>
                  {post.score && post.score > 20 && !isMyOwnPost && (
                    <span className="badge badge-success text-xs">High Match</span>
                  )}
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
                  disabled={startingChat === post.id || isMyOwnPost}
                >
                  {startingChat === post.id ? (
                    <><span className="spinner-sm mr-2" /> Connecting...</>
                  ) : isMyOwnPost ? (
                    "Your Post"
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
