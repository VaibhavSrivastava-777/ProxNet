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
  const { data, isLoading } = useSWR<{ asked: AskedQuestion[], incoming: IncomingQuestion[] }>(`/api/questions?_refresh=${refreshKey}`, fetcher, { refreshInterval: 10000 });

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
      <div style={{ textAlign: "center", padding: "3rem 1rem" }} className="animate-fadeIn card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-tertiary)", margin: "0 auto 1rem" }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p className="text-body" style={{ color: "var(--color-text-secondary)" }}>No messages yet.</p>
        <p className="text-caption" style={{ marginTop: "0.25rem" }}>Your questions and incoming requests will appear here.</p>
      </div>
    );
  }

  return (
    <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {unified.map((item) => {
        if (item.type === "asked") {
          const q = item.data;
          const hasResponse = q.question_targets?.some((t: any) => t.status === "responded");
          const avatarText = q.company_filter ? q.company_filter.slice(0, 2).toUpperCase() : "PR";
          const title = q.company_filter ? `Professional @ ${q.company_filter}` : "Nearby Professional";
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
                <div className="flex justify-between items-center gap-2">
                  <p className="text-body-sm truncate text-[var(--color-text-secondary)]">
                    {previewText}
                  </p>
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
                <div className="flex justify-between items-center gap-2">
                  <p className="text-body-sm truncate" style={{ color: isUnread && !hasResponse ? "var(--color-text)" : "var(--color-text-secondary)", fontWeight: isUnread && !hasResponse ? 600 : 400 }}>
                    {previewText}
                  </p>
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
  );
}
