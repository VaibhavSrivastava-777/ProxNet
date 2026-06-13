"use client";

import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function CarpoolInbox() {
  const { data, error } = useSWR("/api/carpool/inbox", fetcher, { refreshInterval: 5000 });

  if (error) return <div className="alert alert-error">Failed to load chats.</div>;
  
  if (!data) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 skeleton h-24 w-full" />
      ))}
    </div>
  );

  const threads = data.threads || [];

  if (threads.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-secondary)] animate-fadeInUp">
        <div className="w-16 h-16 mx-auto bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center mb-4 text-[var(--color-text-tertiary)]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <h3 className="text-h3 mb-2">No Active Chats</h3>
        <p className="text-sm max-w-xs mx-auto">
          When you message someone from the carpool feed, or they message you, the chat will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 stagger-children">
      {threads.map((t: any) => (
        <Link href={`/carpool/chat/${t.id}`} key={t.id} className="block transition-transform hover:scale-[1.01] active:scale-100">
          <div className="card p-4 flex items-center gap-4 hover:bg-[var(--color-surface-hover)] transition-colors">
            <div className="avatar avatar-md bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shrink-0">
              {t.otherAlias.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h4 className="font-semibold text-[var(--color-text)] truncate pr-2">
                  {t.otherAlias}
                </h4>
                <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0">
                  {t.latestMessage ? formatRelative(t.latestMessage.created_at) : formatRelative(t.updated_at)}
                </span>
              </div>
              
              <div className="flex justify-between items-center gap-2">
                <p className={`text-sm truncate ${!t.latestMessage?.isOwn && t.latestMessage ? "text-[var(--color-text)] font-medium" : "text-[var(--color-text-secondary)]"}`}>
                  {t.latestMessage ? (
                    <>
                      {t.latestMessage.isOwn && <span className="text-[var(--color-text-tertiary)]">You: </span>}
                      {t.latestMessage.body}
                    </>
                  ) : (
                    <span className="italic text-[var(--color-text-tertiary)]">No messages yet</span>
                  )}
                </p>
                {t.status === "revealed" && (
                  <span className="badge badge-success shrink-0 text-[10px] py-0.5 px-1.5 h-auto">Revealed</span>
                )}
                {t.status === "reveal_pending" && (
                  <span className="badge badge-warning shrink-0 text-[10px] py-0.5 px-1.5 h-auto">Action Req.</span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
