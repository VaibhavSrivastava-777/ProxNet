"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface JobPost {
  id: string;
  type: "seeker" | "giver";
  role: string;
  company?: string;
  experience_years: number;
  skills?: string;
  score?: number;
  distance?: number;
  user?: { id?: string; company?: string; job_title?: string; full_name?: string };
  created_at: string;
  is_on_behalf?: boolean;
  contact_number?: string;
  ai_summary?: string;
}

export function JobFeed({ refreshKey }: { refreshKey: number }) {
  const [allPosts, setAllPosts] = useState<JobPost[]>([]);
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [myPosts, setMyPosts] = useState<JobPost[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"both" | "seeker" | "giver">("both");
  const [roleFilter, setRoleFilter] = useState("");
  const [expFilter, setExpFilter] = useState("any");

  const feedRef = useRef<HTMLDivElement>(null);

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

      fetch(`/api/jobs/feed?radius=-1&lat=${lat}&lng=${lng}`)
        .then((res) => res.json())
        .then((data) => {
          const fetchedPosts = data.posts || [];
          // Sort chronologically (newest first for chat feel)
          fetchedPosts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setAllPosts(fetchedPosts);
          setMyPosts(data.myPosts || []);
          setCurrentUserId(data.currentUserId || null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }

    fetchData();
  }, [refreshKey]);

  // Client-side filter
  useEffect(() => {
    let filtered = allPosts;
    if (typeFilter !== "both") {
      filtered = filtered.filter((p) => p.type === typeFilter);
    }
    if (roleFilter.trim()) {
      const q = roleFilter.toLowerCase();
      filtered = filtered.filter((p) =>
        p.role.toLowerCase().includes(q) ||
        (p.skills && p.skills.toLowerCase().includes(q)) ||
        (p.company && p.company.toLowerCase().includes(q))
      );
    }
    if (expFilter !== "any") {
      filtered = filtered.filter((p) => {
        if (expFilter === "entry") return p.experience_years >= 0 && p.experience_years <= 2;
        if (expFilter === "mid") return p.experience_years >= 3 && p.experience_years <= 5;
        if (expFilter === "senior") return p.experience_years > 5;
        return true;
      });
    }
    setPosts(filtered);
  }, [allPosts, typeFilter, roleFilter, expFilter]);

  async function handleStartChat(targetPostId: string) {
    setStartingChat(targetPostId);
    try {
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
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const handleShare = async (post: any) => {
    const text = `Check out this post for ${post.role}${post.company ? ` at ${post.company}` : ""} on ProxNet!`;
    const url = `${window.location.origin}/jobs?id=${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "ProxNet Job Post", text, url });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert("Link copied to clipboard!");
      } catch (err) {}
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 skeleton h-24" />
        ))}
      </div>
    );
  }

  // Merge myPosts into the feed for display
  const allFeedPosts = [...posts];
  for (const mp of myPosts) {
    if (!allFeedPosts.find(p => p.id === mp.id)) {
      allFeedPosts.push(mp);
    }
  }
  allFeedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="alert alert-error animate-fadeInUp">{errorMsg}</div>
      )}

      {/* Header + Filters */}
      <div className="flex justify-between items-center bg-[var(--color-surface-secondary)] p-3 rounded-lg">
        <h3 className="text-h4 font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
          Jobs Board
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
        <div className="card p-4 animate-fadeInDown border-t-4 border-primary">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Type</span>
              <div className="flex bg-[var(--color-surface-secondary)] p-1 rounded-lg">
                {(["both", "seeker", "giver"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === t ? "bg-[var(--color-surface)] shadow-sm text-primary" : "text-[var(--color-text-secondary)]"}`}
                  >
                    {t === "both" ? "All" : t === "seeker" ? "Seekers" : "Referrers"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Experience</span>
              <select className="input text-sm" value={expFilter} onChange={e => setExpFilter(e.target.value)}>
                <option value="any">Any</option>
                <option value="entry">0-2 yrs (Entry)</option>
                <option value="mid">3-5 yrs (Mid)</option>
                <option value="senior">5+ yrs (Senior)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Keywords</span>
              <input
                type="text"
                className="input text-sm"
                placeholder="React, Google..."
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Feed */}
      <div className="flex flex-col gap-4" ref={feedRef}>
        {allFeedPosts.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
            <p className="font-medium">No active job posts right now.</p>
            <p className="text-sm mt-1">Be the first to shout your opportunity or skills!</p>
          </div>
        ) : (
          allFeedPosts.map((post) => {
            const isMe = myPosts.some(mp => mp.id === post.id);
            const userName = post.user?.full_name || "Professional";
            const firstName = userName.split(" ")[0];
            const initial = firstName.charAt(0).toUpperCase();
            const jobTitle = post.user?.job_title || "";
            const userCompany = post.user?.company || "";

            return (
              <div key={post.id} className="flex flex-col gap-1 animate-fadeInUp">
                {/* Main Chat Bubble */}
                <div className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 border transition-all ${
                    isMe
                      ? "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
                      : post.type === "giver"
                        ? "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800"
                        : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                  }`}>
                    {initial}
                  </div>

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%] w-full`}>
                    <div className="text-xs text-[var(--color-text-tertiary)] mb-1 flex items-center gap-2 w-full">
                      <span className="font-semibold text-[var(--color-text-secondary)]">{userName}</span>
                      {(jobTitle || userCompany) && (
                        <>
                          <span>•</span>
                          <span>{[jobTitle, userCompany].filter(Boolean).join(" at ")}</span>
                        </>
                      )}
                      {post.is_on_behalf && post.contact_number && (
                        <a
                          href={`https://wa.me/${post.contact_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I saw your post for ${post.role}${post.company ? ` at ${post.company}` : ""} on ProxNet.in (https://www.proxnet.in/jobs).`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900 transition-all hover:scale-105 shrink-0"
                          title="Contact via WhatsApp"
                        >
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.458h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </a>
                      )}
                    </div>

                    <div className={`p-4 rounded-2xl text-sm border shadow-sm relative group transition-all ${
                      isMe
                        ? "rounded-tr-sm bg-gradient-to-l from-indigo-50/20 via-[var(--color-surface)] to-[var(--color-surface)] border-l-4 border-l-indigo-500 border-t-indigo-500/10 border-r-indigo-500/10 border-b-indigo-500/10 text-[var(--color-text)]"
                        : post.type === "giver"
                          ? "rounded-tl-sm bg-gradient-to-r from-teal-50/20 via-[var(--color-surface)] to-[var(--color-surface)] border-l-4 border-l-teal-500 border-t-teal-500/10 border-r-teal-500/10 border-b-teal-500/10"
                          : "rounded-tl-sm bg-gradient-to-r from-blue-50/20 via-[var(--color-surface)] to-[var(--color-surface)] border-l-4 border-l-blue-500 border-t-blue-500/10 border-r-blue-500/10 border-b-blue-500/10"
                    }`}>
                      {/* Role Pill Badge */}
                      <div className="mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isMe
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : post.type === "giver"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>
                          {isMe ? "My Post ✨" : post.type === "giver" ? "Referrer 🤝" : "Seeker 🔍"}
                        </span>
                      </div>

                      <span>
                        <strong className="text-[var(--color-text)]">{firstName}</strong>{" "}
                        is <strong>{post.type === "giver" ? "referring" : "looking"}</strong>{" "}
                        for <span className="font-medium text-[var(--color-text)]">{post.role}</span>
                        {post.type === "giver" && post.company && (
                          <> at <span className="font-medium text-[var(--color-text)]">{post.company}</span></>
                        )}
                        . {post.experience_years > 0 && <span className="text-[var(--color-text-secondary)]"> {post.experience_years} years exp.</span>}
                      </span>

                      {/* Skills Tags */}
                      {post.skills && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {post.skills.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 5).map((skill: string) => (
                            <span key={skill} className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                              isMe
                                ? "bg-indigo-50/50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900"
                                : post.type === "giver"
                                  ? "bg-teal-50/50 text-teal-700 border-teal-100 dark:bg-teal-950/20 dark:text-teal-300 dark:border-teal-900"
                                  : "bg-blue-50/50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900"
                            }`}>
                              #{skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Match Score Badge */}
                      {typeof post.score === "number" && post.score > 0 && !isMe && (
                        <div className="mt-2">
                          <span className="badge border border-[var(--color-primary)] text-[var(--color-primary)] text-[10px]">
                            {Math.round(post.score)}% Match
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-3 flex gap-2 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleShare(post)}
                          className="btn btn-ghost btn-sm text-[var(--color-text-tertiary)] h-8 min-h-0 px-3"
                          title="Share"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        </button>
                        {isMe ? (
                          <>
                            <button
                              onClick={() => {
                                const evt = new CustomEvent("editJobPost", { detail: post });
                                window.dispatchEvent(evt);
                              }}
                              className="btn btn-ghost btn-sm text-primary h-8 min-h-0 px-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="btn btn-ghost btn-sm text-[var(--color-error)] h-8 min-h-0 px-3"
                            >
                              Delete
                            </button>
                          </>
                        ) : post.is_on_behalf && post.contact_number ? (
                          <a
                            href={`https://wa.me/${post.contact_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I saw your post for ${post.role}${post.company ? ` at ${post.company}` : ""} on ProxNet.in (https://www.proxnet.in/jobs).`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm h-8 min-h-0 px-4 btn-accent flex items-center gap-1.5"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                            WhatsApp
                          </a>
                        ) : (
                          <button
                            className="btn btn-sm h-8 min-h-0 px-4 btn-primary"
                            onClick={() => handleStartChat(post.id)}
                            disabled={startingChat === post.id}
                          >
                            {startingChat === post.id ? "Opening..." : "Message"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 px-2">{formatTime(post.created_at)}</span>
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
          })
        )}
      </div>
    </div>
  );
}
