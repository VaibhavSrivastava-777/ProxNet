"use client";

import useSWR from "swr";
import { useState } from "react";

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function LocalForumFeed() {
  const { data, isLoading } = useSWR("/api/questions", fetcher, { refreshInterval: 10000 });
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShare = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/qa/forum/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Local Forum Post", url });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 mt-8">
        <h2 className="text-h2 px-4 md:px-0">Local Forum</h2>
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );
  }

  const forum = data?.forum || [];

  if (forum.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mt-8 animate-fadeInUp">
      <h2 className="text-h2 px-4 md:px-0">Local Forum</h2>
      <div className="flex flex-col gap-4">
        {forum.map((q: any) => (
          <div
            key={q.id}
            className="card p-4 sm:p-5 flex flex-col gap-3 bg-[var(--color-surface)] border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-sm">
                {q.asker_alias.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-body font-semibold text-[var(--color-text)]">{q.asker_alias}</span>
                <span className="text-caption text-[var(--color-text-secondary)]">{formatRelative ? formatRelative(q.created_at) : new Date(q.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            <p className="text-body text-[var(--color-text)] mt-1 whitespace-pre-wrap">
              {q.body.length > 150 && !expandedPosts[q.id] ? `${q.body.slice(0, 150)}...` : q.body}
              {q.body.length > 150 && (
                <button 
                  onClick={(e) => toggleExpand(e, q.id)} 
                  className="text-[var(--color-primary)] font-medium ml-1 hover:underline inline-block"
                >
                  {expandedPosts[q.id] ? "show less" : "show more"}
                </button>
              )}
            </p>
            
            <div className="flex items-center gap-6 mt-2 border-t border-[var(--color-border-light)] pt-3">
              <button className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                <span className="font-medium">{q.likes_count} Likes</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); window.location.href = `/qa/forum/${q.id}` }} 
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span className="font-medium">{q.comments_count} Comments</span>
              </button>
              <button 
                onClick={(e) => handleShare(e, q.id)} 
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ml-auto"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span className="font-medium">Share</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
