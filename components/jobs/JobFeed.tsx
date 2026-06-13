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
  const [requiresPost, setRequiresPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    fetch("/api/jobs/feed")
      .then((res) => res.json())
      .then((data) => {
        if (data.requiresPost) {
          setRequiresPost(true);
        } else {
          setRequiresPost(false);
          setPosts(data.posts || []);
          setMyPost(data.myPost);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  async function handleStartChat(targetPostId: string) {
    if (!myPost) return;
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

  if (requiresPost) {
    return (
      <div className="card p-8 text-center bg-surface-secondary border border-dashed border-border-light flex flex-col items-center justify-center animate-fadeIn min-h-[300px]">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-text-tertiary mb-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.896 1.982-2.007 1.982H5.757c-1.111 0-2.007-.888-2.007-1.982v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v3.896m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
        <h3 className="text-h3 mb-2">Post First to View the Feed</h3>
        <p className="text-body-sm text-text-secondary max-w-sm">
          Once you post your availability or referral, you'll instantly see matching professionals here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children">
      <div className="alert alert-info">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span>
          You have an active post as a <strong>{myPost?.type === "seeker" ? "Seeker" : "Giver"}</strong> for <strong>{myPost?.role}</strong>.
        </span>
      </div>

      <div className="flex justify-between items-center mb-6 mt-6">
        <h3 className="text-h3">
          {myPost?.type === "giver" ? "Candidates Looking for Roles" : "Available Referrals & Jobs"}
        </h3>
        <span className="text-caption bg-surface-secondary px-2 py-1 rounded">Sorted by relevance</span>
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center border border-dashed border-border flex flex-col items-center animate-fadeIn min-h-[250px]">
          <p className="text-body text-text-secondary font-medium">No matches found right now.</p>
          <p className="text-caption mt-1">Check back later as new professionals join.</p>
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="card p-5 animate-fadeInUp flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-start">
                <h4 className="text-h3 mb-1 text-primary">{post.role}</h4>
                {post.score && post.score > 20 && (
                  <span className="badge badge-success text-xs">High Match</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-caption text-text-secondary mb-3">
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
                  {post.skills.split(',').map(s => s.trim()).filter(Boolean).map(skill => (
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
        ))
      )}
    </div>
  );
}
