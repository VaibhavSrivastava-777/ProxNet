"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ForumThreadPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, error, mutate } = useSWR(`/api/questions/forum/${id}`, fetcher, { refreshInterval: 5000 });
  
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (error) return <div className="p-4 text-[var(--color-error)]">Failed to load thread.</div>;
  if (!data) return <div className="p-4 flex justify-center"><div className="spinner" /></div>;

  const { question, comments } = data;

  const handleLike = async (commentId: string | null, isLiked: boolean) => {
    // Optimistic update
    mutate((current: any) => {
      if (!current) return current;
      if (!commentId) {
        return {
          ...current,
          question: {
            ...current.question,
            has_liked: !isLiked,
            likes_count: current.question.likes_count + (isLiked ? -1 : 1)
          }
        };
      }
      return {
        ...current,
        comments: current.comments.map((c: any) => c.id === commentId ? {
          ...c,
          has_liked: !isLiked,
          likes_count: c.likes_count + (isLiked ? -1 : 1)
        } : c)
      };
    }, false);

    await fetch(`/api/questions/forum/${id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, action: isLiked ? "unlike" : "like" })
    });
    mutate();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/questions/forum/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText, parentId: replyTo })
    });
    setSubmitting(false);
    if (res.ok) {
      setCommentText("");
      setReplyTo(null);
      mutate();
    }
  };

  const CommentList = ({ parentId = null, depth = 0 }: { parentId?: string | null, depth?: number }) => {
    const threadComments = comments.filter((c: any) => c.parent_id === parentId);
    if (threadComments.length === 0) return null;

    return (
      <div className={`flex flex-col gap-4 ${depth > 0 ? "ml-6 pl-4 border-l border-[var(--color-border-light)] mt-4" : ""}`}>
        {threadComments.map((c: any) => (
          <div key={c.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--color-primary)]">{c.alias}</span>
              <span className="text-xs text-[var(--color-text-tertiary)]">{formatDistanceToNow(new Date(c.created_at))} ago</span>
            </div>
            <p className="text-sm text-[var(--color-text)]">{c.body}</p>
            <div className="flex gap-4 mt-1">
              <button 
                onClick={() => handleLike(c.id, c.has_liked)}
                className={`text-xs flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors ${c.has_liked ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={c.has_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                {c.likes_count}
              </button>
              <button 
                onClick={() => setReplyTo(c.id)}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Reply
              </button>
            </div>
            {replyTo === c.id && (
              <form onSubmit={handleComment} className="mt-2 flex gap-2">
                <input 
                  autoFocus
                  type="text" 
                  value={commentText} 
                  onChange={e => setCommentText(e.target.value)} 
                  className="input flex-1 text-sm" 
                  placeholder="Write a reply..." 
                />
                <button disabled={submitting} className="btn btn-sm btn-primary">Post</button>
                <button type="button" onClick={() => setReplyTo(null)} className="btn btn-sm btn-ghost">Cancel</button>
              </form>
            )}
            <CommentList parentId={c.id} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 animate-fadeIn flex flex-col gap-6">
      <button onClick={() => router.push('/qa')} className="text-sm flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors w-fit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Back to Q&A
      </button>

      <div className="card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-md bg-primary/10 text-primary">{question.asker_alias.slice(9,11).toUpperCase()}</div>
          <div className="flex flex-col">
            <span className="font-semibold text-[var(--color-primary)]">{question.asker_alias}</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">{formatDistanceToNow(new Date(question.created_at))} ago</span>
          </div>
        </div>
        <p className="text-lg text-[var(--color-text)] whitespace-pre-wrap">{question.body}</p>
        
        <div className="flex gap-6 mt-2 pt-4 border-t border-[var(--color-border-light)]">
          <button 
            onClick={() => handleLike(null, question.has_liked)}
            className={`flex items-center gap-2 hover:text-[var(--color-primary)] transition-colors ${question.has_liked ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={question.has_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            <span className="font-medium">{question.likes_count}</span>
          </button>
          <button 
            onClick={() => { setReplyTo(null); document.getElementById('main-comment-input')?.focus(); }}
            className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="font-medium">{comments.length}</span>
          </button>
        </div>
      </div>

      <div className="card p-6 flex flex-col gap-6">
        <h3 className="text-h3 border-b border-[var(--color-border-light)] pb-2">Discussion</h3>
        
        {replyTo === null && (
          <form onSubmit={handleComment} className="flex gap-3">
            <div className="avatar avatar-md bg-primary/10 text-primary shrink-0">ME</div>
            <div className="flex-1 flex flex-col gap-2">
              <textarea 
                id="main-comment-input"
                value={commentText} 
                onChange={e => setCommentText(e.target.value)} 
                className="input text-sm resize-y" 
                placeholder="Add a comment..." 
                rows={2}
              />
              <div className="flex justify-end">
                <button disabled={submitting || !commentText.trim()} className="btn btn-primary">Post Comment</button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-4">
          <CommentList />
        </div>
      </div>
    </div>
  );
}
