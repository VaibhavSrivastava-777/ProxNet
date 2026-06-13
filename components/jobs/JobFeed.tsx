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

  // Auto-Draft Modal State
  const [draftingPostId, setDraftingPostId] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<any>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);

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
      // Auto-draft flow
      setDraftingPostId(targetPostId);
      try {
        const res = await fetch("/api/jobs/auto-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetPostId }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        setDraftData(data);
        setIsDraftModalOpen(true);
      } catch (err: any) {
        console.error(err);
        setErrorMsg("Failed to auto-draft profile. " + (err.message || ""));
        setTimeout(() => setErrorMsg(""), 5000);
      } finally {
        setDraftingPostId(null);
      }
      return;
    }
    
    // Normal flow
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

  async function handleConfirmDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draftData || !startingChat) return; // Note: startingChat acts as targetPostId here

    try {
      setStartingChat(draftData.targetPostId); // Use it as a loading spinner
      
      // 1. Create the post
      const postRes = await fetch("/api/jobs/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "seeker",
          role: draftData.role,
          experience_years: draftData.experience_years,
          skills: draftData.skills,
          company: ""
        })
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error);
      
      setMyPost(postData.post);
      setIsDraftModalOpen(false);

      // 2. Start the chat
      const chatRes = await fetch("/api/jobs/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPostId: startingChat, myPostId: postData.post.id }),
      });
      const chatData = await chatRes.json();
      if (chatData.threadId) {
        router.push(`/jobs/chat/${chatData.threadId}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to create post or start chat: " + (err.message || ""));
      setTimeout(() => setErrorMsg(""), 5000);
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
    <div className="space-y-4 stagger-children relative">
      {/* Auto-Draft Modal */}
      {isDraftModalOpen && draftData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-surface card p-6 w-full max-w-lg shadow-xl animate-scaleIn relative">
            <button 
              onClick={() => setIsDraftModalOpen(false)}
              className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <h2 className="text-h2 mb-2 flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              AI Profile Draft
            </h2>
            <p className="text-body-sm text-text-secondary mb-6">
              We generated this anonymous "Seeker" profile to match the role you want to message. Review and edit before confirming.
            </p>
            <form onSubmit={handleConfirmDraft} className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="label">Role</span>
                <input 
                  type="text" 
                  className="input" 
                  value={draftData.role}
                  onChange={e => setDraftData({...draftData, role: e.target.value})}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Skills</span>
                <input 
                  type="text" 
                  className="input" 
                  value={draftData.skills}
                  onChange={e => setDraftData({...draftData, skills: e.target.value})}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Experience (Years)</span>
                <input 
                  type="number" 
                  className="input" 
                  value={draftData.experience_years}
                  onChange={e => setDraftData({...draftData, experience_years: e.target.value})}
                  required
                />
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-border-light">
                <button type="button" onClick={() => setIsDraftModalOpen(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={!!startingChat} className="btn btn-primary">
                  {startingChat ? "Confirming..." : "Confirm & Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  disabled={startingChat === post.id || draftingPostId === post.id || isMyOwnPost}
                >
                  {draftingPostId === post.id ? (
                    <><span className="spinner-sm mr-2" /> Drafting AI Profile...</>
                  ) : startingChat === post.id && myPost ? (
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
