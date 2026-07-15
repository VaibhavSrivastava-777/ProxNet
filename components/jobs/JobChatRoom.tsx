"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { createBrowserClient } from "@/lib/supabase/client";

function formatAbsoluteTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface Props {
  threadId: string;
  userId: string;
}

export function JobChatRoom({ threadId, userId }: Props) {
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [myAlias, setMyAlias] = useState("");
  const [otherAlias, setOtherAlias] = useState("");
  const [myRevealAgreed, setMyRevealAgreed] = useState(false);
  const [otherRevealAgreed, setOtherRevealAgreed] = useState(false);
  const [otherContact, setOtherContact] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [revealing, setRevealing] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`job-chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "job_threads", filter: `id=eq.${threadId}` },
        () => {
          fetchData(); // refetch to get updated status and contact info
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/jobs/chat/${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setThread(data.thread);
        setMessages(data.messages);
        setMyAlias(data.myAlias);
        setOtherAlias(data.otherAlias);
        setMyRevealAgreed(data.myRevealAgreed);
        setOtherRevealAgreed(data.otherRevealAgreed);
        if (data.otherContact) {
          setOtherContact(data.otherContact);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    
    try {
      await fetch("/api/jobs/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: input }),
      });
      setInput("");
    } finally {
      setSending(false);
    }
  }

  async function handleReveal() {
    if (revealing) return;
    setRevealing(true);
    try {
      const res = await fetch("/api/jobs/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMyRevealAgreed(true);
        if (data.allAgreed) {
          fetchData(); // Get the new status
        }
      }
    } finally {
      setRevealing(false);
    }
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* Header */}
      <div className="border-b border-border-light p-4 flex items-center gap-3 bg-surface sticky top-0 z-10">
        <button onClick={() => router.push("/jobs")} className="btn-icon btn-ghost p-1 mr-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <div className="avatar avatar-sm bg-primary-subtle text-primary font-bold">
          {otherAlias.charAt(0)}
        </div>
        <div>
          <h3 className="text-body font-bold text-text">{otherAlias}</h3>
          <p className="text-caption text-text-secondary">Job Referral Chat</p>
        </div>
      </div>

      {/* Reveal Banner */}
      {thread.status === "active" && !myRevealAgreed && (
        <div className="bg-primary-subtle p-3 m-4 rounded-lg flex items-start gap-3 border border-primary/20">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1">
            <p className="text-sm text-text font-medium mb-1">Share Professional Identity?</p>
            <p className="text-xs text-text-secondary mb-2">If you both agree, your LinkedIn profile (or email) will be revealed to each other to take this conversation forward.</p>
            <button onClick={handleReveal} disabled={revealing} className="btn btn-primary btn-sm text-xs">
              {revealing ? <span className="spinner-sm" /> : "I'm interested, reveal identity"}
            </button>
          </div>
        </div>
      )}

      {thread.status === "reveal_pending" && myRevealAgreed && (
        <div className="bg-surface-secondary p-3 m-4 rounded-lg flex items-center gap-3 border border-border">
          <span className="spinner-sm text-primary shrink-0" />
          <p className="text-sm text-text-secondary">You agreed to reveal. Waiting for the other party...</p>
        </div>
      )}

      {thread.status === "revealed" && (
        <div className="bg-success/10 p-3 m-4 rounded-lg flex items-center gap-3 border border-success/30">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-success shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-success-content">Identities Revealed!</p>
            {otherContact && (
              <p className="text-xs text-text mt-1">
                Contact:{" "}
                {otherContact.includes("linkedin.com") ? (
                  <a href={otherContact} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {otherContact}
                  </a>
                ) : (
                  <strong>{otherContact}</strong>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 whatsapp-chat-bg">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-text-tertiary">No messages yet. Send a message to start!</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.sender_id === userId;
            const isSystem = m.sender_id === "00000000-0000-0000-0000-000000000000";

            if (isSystem) {
              return (
                <div key={idx} className="flex justify-center my-4">
                  <div className="bg-surface-secondary px-3 py-1.5 rounded-full border border-border-light text-center">
                    <p className="text-[10px] text-text-tertiary font-medium">{m.body}</p>
                  </div>
                </div>
              );
            }

            const borderRadius = isMe ? "8px 8px 0px 8px" : "8px 8px 8px 0px";

            return (
              <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-1.5 text-[15px] relative select-none shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-[80%] ${
                    isMe
                      ? "bg-[var(--whatsapp-bubble-sent)] text-[var(--whatsapp-text)]"
                      : "bg-[var(--whatsapp-bubble-received)] text-[var(--whatsapp-text)]"
                  }`}
                  style={{
                    borderRadius,
                    paddingRight: isMe ? "62px" : "48px",
                    paddingBottom: "8px",
                  }}
                >
                  <p className="whitespace-pre-wrap break-words m-0 leading-normal">{m.body}</p>
                  
                  {/* WhatsApp-like Inline Timestamp */}
                  <div className="absolute bottom-[3px] right-[7px] flex items-center gap-0.5 text-[9px] text-gray-500/80 dark:text-gray-400/60 select-none">
                    <span>{formatAbsoluteTime(m.created_at)}</span>
                    {isMe && (
                      <span className="flex items-center ml-0.5">
                        {/* Double Blue Ticks */}
                        <div className="relative w-4 h-3 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-0 top-0.5 w-3 h-3 text-[#53bdeb]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-[3px] top-0.5 w-3 h-3 text-[#53bdeb]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border-light bg-[var(--whatsapp-bg)]/90 backdrop-blur-sm flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="input flex-1 min-h-[44px] max-h-32 rounded-[24px] py-2.5 px-4 resize-none leading-tight bg-[var(--color-surface)] border-none shadow-[0_1px_1px_rgba(0,0,0,0.06)] focus:ring-0 focus:outline-none text-[var(--color-text)] transition-colors"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-icon shrink-0 w-11 h-11 mb-0 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500"
          style={{
            backgroundColor: input.trim() ? "#00a884" : "#cbd5e1",
            color: "white",
            height: "44px",
            width: "44px",
          }}
        >
          {sending ? (
            <span className="spinner-sm" style={{ borderTopColor: "white" }} />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
              <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
