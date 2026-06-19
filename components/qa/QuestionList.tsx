"use client";

import { useState } from "react";
import useSWR from "swr";

interface IncomingQuestion {
  id: string;
  body: string;
  status: string;
  company_filter: string | null;
  title_filter: string | null;
  created_at: string;
  asker_alias: string;
  target_id: string;
  latest_activity_at: string;
  latest_message_body: string | null;
  latest_message_sender: string | null;
}

interface ForumQuestion {
  id: string;
  body: string;
  asker_alias: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

interface AskedQuestion {
  id: string;
  body: string;
  status: string;
  created_at: string;
  company_filter: string | null;
  question_targets?: { status: string }[];
  latest_activity_at: string;
  latest_message_body: string | null;
  latest_message_sender: string | null;
}

interface Props {
  refreshKey?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
});

export function QuestionList({ refreshKey }: Props) {
  const { data, isLoading } = useSWR<{ asked: AskedQuestion[], incoming: IncomingQuestion[], forum: ForumQuestion[], suggestions?: any[] }>(`/api/questions?_refresh=${refreshKey}`, fetcher, { refreshInterval: 10000 });

  async function respond(questionId: string, targetId: string) {
    const res = await fetch("/api/questions/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, targetId }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/chat/${data.sessionId}`;
    }
  }

  async function openChat(questionId: string) {
    const res = await fetch(`/api/chat/by-question/${questionId}`);
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/chat/${data.sessionId}`;
    }
  }

  if (isLoading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  const asked = data?.asked || [];
  const incoming = data?.incoming || [];

  // Unify and sort
  const unified = [
    ...asked.map(q => ({ type: "asked" as const, data: q, ts: new Date(q.latest_activity_at).getTime() })),
    ...incoming.map(q => ({ type: "incoming" as const, data: q, ts: new Date(q.latest_activity_at).getTime() }))
  ].sort((a, b) => b.ts - a.ts);

  if (unified.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }} className="animate-fadeIn card flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" />
          </svg>
        </div>
        <h3 className="text-h3 mb-2">No messages yet</h3>
        <p className="text-body-sm text-text-secondary mb-6 max-w-sm">
          Your questions and incoming requests will appear here once you start connecting.
        </p>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="btn btn-primary"
        >
          Ask your first question
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {data?.suggestions && data.suggestions.length > 0 && (
        <div className="card p-4 bg-[var(--color-primary-light)]/10 border border-[var(--color-primary)]/20 animate-fadeInDown">
          <h4 className="text-body-sm font-semibold mb-3 flex items-center gap-2 text-[var(--color-primary)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            Suggested Connections
          </h4>
          <div className="flex flex-col gap-3">
            {data.suggestions.map((s: any) => (
              <div key={s.user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="avatar avatar-sm bg-primary/20 text-primary">
                    {s.user.full_name ? getInitials(s.user.full_name) : "PR"}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.user.job_title}</div>
                    <div className="text-xs text-text-secondary">{s.user.company} &bull; {s.score}% Match</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const el = document.querySelector('.card > button');
                    if (el) (el as HTMLElement).click();
                    setTimeout(() => {
                      const sel = document.querySelector('select.input');
                      if (sel && s.user.company) {
                        (sel as HTMLSelectElement).value = s.user.company;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                    }, 500);
                  }}
                  className="btn btn-ghost btn-sm text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                >
                  Ask
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Only Suggested Connections and Direct Messages */}
      <div className="stagger-children flex flex-col gap-2">
        <h4 className="text-body-sm font-semibold mb-1 mt-2 text-[var(--color-text-secondary)]">Direct Messages</h4>
          {unified.length === 0 ? (
             <div className="text-center py-8 text-[var(--color-text-secondary)] text-sm">No direct messages yet.</div>
          ) : unified.map((item) => {
        if (item.type === "asked") {
          const q = item.data;
          const hasResponse = q.question_targets?.some((t: any) => t.status === "responded");
          const avatarText = "PR";
          const title = "Nearby Professional";
          const previewText = q.latest_message_body || "You: " + q.body;
          const isUnread = q.latest_message_body && q.latest_message_sender !== "asker"; // naive unread check

          return (
            <div 
              key={q.id} 
              className="card flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              onClick={() => hasResponse ? openChat(q.id) : null}
              style={{ padding: "12px 16px" }}
            >
              <div className="avatar avatar-md flex-shrink-0" style={{ backgroundColor: "var(--color-primary-subtle)", color: "var(--color-primary)" }}>
                {avatarText}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="text-body font-semibold truncate" style={{ color: "var(--color-text)" }}>{title}</h4>
                  <span className="text-caption" style={{ color: isUnread ? "var(--color-primary)" : "var(--color-text-tertiary)", fontWeight: isUnread ? 600 : 400 }}>
                    {formatRelative(q.latest_activity_at)}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-2 relative mt-1">
                  <div 
                    className="text-body-sm text-[var(--color-text-secondary)] line-clamp-2 pr-4 relative flex-1"
                    style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                  >
                    {previewText}
                  </div>
                  {isUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                  )}
                  {!hasResponse && !q.latest_message_body && (
                    <span className="badge badge-neutral flex-shrink-0 text-[10px]">Pending</span>
                  )}
                </div>
              </div>
            </div>
          );
        } else {
          const q = item.data;
          const hasResponse = q.status === "responded";
          const previewText = q.latest_message_body || q.body;
          const isUnread = (!hasResponse) || (q.latest_message_body && q.latest_message_sender !== "responder");

          return (
            <div 
              key={q.target_id} 
              className="card flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              onClick={() => hasResponse ? openChat(q.id) : respond(q.id, q.target_id)}
              style={{ padding: "12px 16px" }}
            >
              <div className="avatar avatar-md flex-shrink-0" style={{ backgroundColor: "var(--color-accent-subtle)", color: "var(--color-accent)" }}>
                {getInitials(q.asker_alias)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className="text-body font-semibold truncate" style={{ color: "var(--color-text)" }}>{q.asker_alias}</h4>
                  <span className="text-caption" style={{ color: isUnread && !hasResponse ? "var(--color-error)" : "var(--color-text-tertiary)", fontWeight: isUnread ? 600 : 400 }}>
                    {formatRelative(q.latest_activity_at)}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-2 mt-1">
                  <div 
                    className={`text-body-sm line-clamp-2 pr-4 relative flex-1 ${isUnread && !hasResponse ? "text-[var(--color-text)] font-semibold" : "text-[var(--color-text-secondary)] font-normal"}`}
                    style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                  >
                    {previewText}
                  </div>
                  {isUnread && !hasResponse && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-error)] flex-shrink-0" />
                  )}
                  {isUnread && hasResponse && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>
          );
        }
      })}
        </div>
    </div>
  );
}
