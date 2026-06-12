"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  body: string;
  created_at: string;
  alias: string;
  isOwn: boolean;
}

const MAX_CHARS = 500;

const ICEBREAKERS = [
  "Hi! I saw your question on ProxNet 👋",
  "Happy to connect and chat!",
  "Can you tell me more about what you're looking for?",
];

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatRoom({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [myAlias, setMyAlias] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<any>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/chat/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
      setMyAlias(data.myAlias ?? "");
    }
  }, [sessionId]);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/chat/${sessionId}/suggestions`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSuggestions(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadMessages();
    fetchSuggestions();

    const interval = setInterval(loadMessages, 3000);
    const supabase = createBrowserClient();

    // Main messages channel
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          loadMessages();
          // Refresh suggestions after a new message (debounced 2s)
          if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
          suggestionDebounceRef.current = setTimeout(fetchSuggestions, 2000);
        }
      )
      .subscribe();

    // Presence channel for typing indicator
    const presenceChannel = supabase.channel(`typing:${sessionId}`, {
      config: { presence: { key: "user" } },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.values(state).flat().filter((s: any) => s.typing && s.alias !== myAlias);
        setOtherIsTyping(others.length > 0);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [sessionId, loadMessages, fetchSuggestions, myAlias]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherIsTyping]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScroll(scrollHeight - scrollTop - clientHeight > 100);
  };

  const handleTextChange = (val: string) => {
    if (val.length > MAX_CHARS) return;
    setText(val);

    // Broadcast typing presence
    if (presenceChannelRef.current && myAlias) {
      presenceChannelRef.current.track({ typing: true, alias: myAlias });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        presenceChannelRef.current?.untrack();
      }, 2000);
    }
  };

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/chat/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setText("");
      presenceChannelRef.current?.untrack();
    }
  }

  function handleLongPress(msgId: string, body: string) {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const otherAlias = messages.find((m) => !m.isOwn)?.alias || "Anonymous";
  const charsLeft = MAX_CHARS - text.length;
  const charsNearLimit = charsLeft < 50;

  return (
    <div className="card flex flex-col overflow-hidden" style={{ height: "calc(100vh - var(--nav-height) - 32px)", marginTop: "16px" }}>

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-light)] bg-[var(--color-surface)] px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-md bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
            {otherAlias.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-h3 leading-tight">{otherAlias}</h3>
            <p className="text-caption">Anonymous Chat · You are {myAlias || "..."}</p>
          </div>
        </div>
        <div className="badge badge-accent">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
          </svg>
          Anonymous
        </div>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 bg-[var(--color-bg)]"
      >
        {messages.length === 0 ? (
          /* Icebreaker empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeIn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-[var(--color-text-tertiary)] opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            <p className="text-body-sm text-[var(--color-text-secondary)]">Break the ice — say hello!</p>
            <div className="flex flex-wrap justify-center gap-2">
              {ICEBREAKERS.map((ib) => (
                <button
                  key={ib}
                  type="button"
                  onClick={() => setText(ib)}
                  className="px-3 py-1.5 rounded-full text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {ib}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const isFirstFromSender = i === 0 || messages[i - 1].isOwn !== m.isOwn;
            const longPressTimer = { current: null as ReturnType<typeof setTimeout> | null };

            return (
              <div
                key={m.id}
                className={`flex flex-col w-full max-w-[85%] animate-fadeInUp ${
                  m.isOwn ? "ml-auto items-end" : "mr-auto items-start"
                } ${isFirstFromSender ? "mt-2" : ""}`}
              >
                {!m.isOwn && isFirstFromSender && (
                  <span className="text-[11px] font-semibold text-[var(--color-primary)] ml-2 mb-0.5">
                    {m.alias}
                  </span>
                )}

                <div
                  className={`px-3 py-2 text-[15px] relative group select-none ${
                    m.isOwn
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  }`}
                  style={{
                    borderRadius: m.isOwn ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onContextMenu={(e) => { e.preventDefault(); handleLongPress(m.id, m.body); }}
                  onTouchStart={() => {
                    longPressTimer.current = setTimeout(() => handleLongPress(m.id, m.body), 600);
                  }}
                  onTouchEnd={() => {
                    if (longPressTimer.current) clearTimeout(longPressTimer.current);
                  }}
                >
                  <p className="pr-10">{m.body}</p>
                  <span
                    className={`text-[10px] absolute bottom-1 right-2 ${
                      m.isOwn ? "text-white/70" : "text-[var(--color-text-tertiary)]"
                    }`}
                    title={new Date(m.created_at).toLocaleString()}
                  >
                    {formatRelative(m.created_at)}
                  </span>

                  {/* Copied tooltip */}
                  {copiedId === m.id && (
                    <span
                      className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--color-text)] text-[var(--color-text-inverse)] text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap"
                    >
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {otherIsTyping && (
          <div className="flex items-center gap-2 mt-2 animate-fadeIn mr-auto">
            <div className="flex items-center gap-1 px-3 py-2 rounded-[12px_12px_12px_2px] bg-[var(--color-surface)] shadow-sm">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-text-tertiary)",
                    display: "inline-block",
                    animation: `typingBounce 1.2s ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">{otherAlias} is typing…</span>
          </div>
        )}

        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {/* Scroll to bottom button */}
      {showScroll && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-20 right-4 btn-icon bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-md border border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}

      {/* AI suggestion chips — only show when not typing */}
      {!text && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2 pb-0 bg-[var(--color-surface)] border-t border-[var(--color-border-light)] shrink-0">
          {loadingSuggestions ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton rounded-full" style={{ width: "120px", height: "28px" }} />
              ))}
            </div>
          ) : (
            suggestions.map((s, i) => {
              const isResident = myAlias.toLowerCase().startsWith("resident");
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(s)}
                  className="px-3 py-1 rounded-full text-xs border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors cursor-pointer whitespace-nowrap"
                  style={{ fontWeight: 500, lineHeight: 1.4 }}
                >
                  {isResident ? "🔍" : "✨"} {s}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[var(--color-border-light)] bg-[var(--color-surface)] p-3 shrink-0">
        <div className="flex-1 relative">
          <textarea
            className="input w-full min-h-[44px] max-h-[120px] rounded-2xl py-2.5 px-4 resize-none leading-tight"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e as any);
              }
            }}
            rows={1}
            maxLength={MAX_CHARS}
          />
          {/* Character counter */}
          {text.length > 0 && (
            <span
              className="absolute bottom-2 right-3 text-[10px] pointer-events-none"
              style={{ color: charsNearLimit ? "var(--color-error)" : "var(--color-text-tertiary)" }}
            >
              {charsLeft}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="btn-icon btn-primary shrink-0 w-11 h-11 flex items-center justify-center disabled:opacity-50 disabled:bg-[var(--color-border)] disabled:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </form>

      {/* Typing bounce animation */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
