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
  const [showMenu, setShowMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const mountTime = useRef(Date.now());

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

    loadMessages();
    
    // Force re-render for message ticks
    const tickInterval = setInterval(() => setCurrentTime(Date.now()), 2000);

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
      clearInterval(tickInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [sessionId, loadMessages, fetchSuggestions, myAlias]);

  useEffect(() => {
    scrollToBottom();
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
      setTimeout(() => {
        presenceChannelRef.current?.untrack();
      }, 2000);
    }
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const newMsg = {
      id: tempId,
      body: text.trim(),
      created_at: new Date().toISOString(),
      alias: myAlias,
      isOwn: true,
    };
    
    setMessages((prev) => [...prev, newMsg]);
    setText("");
    setOtherIsTyping(false);
    scrollToBottom();

    const res = await fetch(`/api/chat/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg.body }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => prev.map(m => m.id === tempId ? data.message : m));
    } else {
      setMessages((prev) => prev.filter(m => m.id !== tempId));
    }
  }

  function handleLongPress(msgId: string, body: string) {
    navigator.clipboard.writeText(body).then(() => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleReveal() {
    setShowMenu(false);
    try {
      const res = await fetch(`/api/chat/${sessionId}/reveal`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMyAlias(data.alias);
        setMessages((prev) => [...prev, data.message]);
      } else {
        const errData = await res.json();
        console.error("Reveal failed:", errData);
      }
    } catch (err) {
      console.error("Reveal request error:", err);
    }
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
        <div className="flex items-center gap-2 relative">
          <div className="badge badge-accent hidden sm:flex">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            Anonymous
          </div>
          <button 
            className="btn-icon text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]" 
            title="More options"
            onClick={() => setShowMenu(!showMenu)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
            </svg>
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[var(--color-surface)] shadow-lg border border-[var(--color-border-light)] overflow-hidden z-50 animate-fadeIn">
                <button 
                  onClick={handleReveal}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Reveal Identity
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 flex flex-col bg-[var(--color-bg)]"
        style={{ backgroundImage: "radial-gradient(var(--color-border-light) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        {messages.length === 0 ? (
          /* Icebreaker empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeIn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-[var(--color-text-tertiary)] opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            <p className="text-body-sm text-[var(--color-text-secondary)]">Break the ice — say hello!</p>
            {loadingSuggestions ? (
              <div className="flex flex-wrap justify-center gap-2">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton rounded-full" style={{ width: "180px", height: "32px" }} />)}
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2 max-w-[400px]">
                {(suggestions.length > 0 ? suggestions : ICEBREAKERS).map((ib) => (
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
            )}
          </div>
        ) : (
          messages.map((m, i) => {
            if (m.id.startsWith("q-")) {
              return (
                <div key={m.id} className="w-full flex justify-center my-6">
                  <div className="bg-[var(--color-primary-light)]/10 border border-[var(--color-primary)]/20 rounded-xl p-4 max-w-[85%] sm:max-w-[400px] text-center shadow-sm">
                    <p className="text-[11px] font-semibold text-[var(--color-primary)] mb-1 uppercase tracking-wider">Original Question</p>
                    <p className="text-[15px] text-[var(--color-text)] font-medium">"{m.body}"</p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">Asked by {m.alias}</p>
                  </div>
                </div>
              );
            }

            const prevMsg = i > 0 ? messages[i - 1] : null;
            const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;
            const isFirstFromSender = !prevMsg || prevMsg.isOwn !== m.isOwn || prevMsg.id.startsWith("q-");
            const isLastFromSender = !nextMsg || nextMsg.isOwn !== m.isOwn || nextMsg.id.startsWith("q-");
            const isNew = new Date(m.created_at).getTime() > mountTime.current && !m.id.startsWith("temp-");
            const longPressTimer = { current: null as ReturnType<typeof setTimeout> | null };

            // Dynamic border radii for message grouping
            let borderRadius = m.isOwn ? "18px 18px 2px 18px" : "18px 18px 18px 2px";
            if (!isFirstFromSender && !isLastFromSender) borderRadius = m.isOwn ? "18px 2px 2px 18px" : "2px 18px 18px 2px";
            else if (!isFirstFromSender && isLastFromSender) borderRadius = m.isOwn ? "18px 2px 18px 18px" : "2px 18px 18px 18px";
            else if (isFirstFromSender && !isLastFromSender) borderRadius = m.isOwn ? "18px 18px 2px 18px" : "18px 18px 18px 2px";
            else if (isFirstFromSender && isLastFromSender) borderRadius = "18px";

            const isPending = m.id.startsWith("temp-");
            const isRead = !isPending && (currentTime - new Date(m.created_at).getTime() > 2000);

            return (
              <div
                key={m.id}
                className={`flex flex-col w-full max-w-[85%] ${isNew ? "animate-fadeInUp" : ""} ${
                  m.isOwn ? "ml-auto items-end" : "mr-auto items-start"
                } ${isFirstFromSender ? "mt-3" : "mt-[2px]"}`}
              >
                {!m.isOwn && isFirstFromSender && (
                  <span className="text-[11px] font-semibold text-[var(--color-primary)] ml-2 mb-0.5">
                    {m.alias}
                  </span>
                )}

                <div
                  className={`px-3.5 py-2 text-[15px] relative group select-none shadow-sm ${
                    m.isOwn
                      ? "bg-gradient-to-br from-[var(--color-primary)] to-blue-600 text-white"
                      : "bg-[var(--color-surface)]/90 backdrop-blur-sm text-[var(--color-text)] border border-[var(--color-border-light)]"
                  }`}
                  style={{
                    borderRadius,
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
                  <p>{m.body}</p>

                  {/* Copied tooltip */}
                  {copiedId === m.id && (
                    <span
                      className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--color-text)] text-[var(--color-text-inverse)] text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap z-10 shadow-md"
                    >
                      Copied!
                    </span>
                  )}
                </div>

                {/* External Timestamp & Read Receipt */}
                {isLastFromSender && (
                  <div className={`flex items-center gap-1 mt-0.5 px-1 text-[10px] text-[var(--color-text-tertiary)] ${m.isOwn ? "justify-end" : "justify-start"}`}>
                    <span>{formatRelative(m.created_at)}</span>
                    {m.isOwn && (
                      <span className="flex items-center ml-0.5">
                        {isPending ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-gray-400 opacity-60">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : isRead ? (
                          <div className="relative w-4 h-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="absolute left-0 top-0 w-3 h-3 text-blue-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="absolute left-[4px] top-0 w-3 h-3 text-blue-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-blue-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                )}
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
      {!text && messages.length > 0 && suggestions.length > 0 && (
        <div className="flex overflow-x-auto snap-x hidden-scrollbar gap-2 px-3 pt-2 pb-1 bg-[var(--color-surface)] border-t border-[var(--color-border-light)] shrink-0">
          {loadingSuggestions ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton rounded-full shrink-0" style={{ width: "120px", height: "30px" }} />
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
                  className="snap-start shrink-0 px-3 py-1.5 rounded-full text-xs border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors cursor-pointer whitespace-nowrap"
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
      <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[var(--color-border-light)] bg-[var(--color-surface)] p-3 shrink-0 relative z-20">
        <button
          type="button"
          className="btn-icon shrink-0 w-10 h-10 mb-0.5 flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-full transition-colors"
          title="More actions"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <div className="flex-1 relative">
          <textarea
            className="input w-full min-h-[44px] max-h-[120px] rounded-[22px] py-2.5 px-4 resize-none leading-tight bg-[var(--color-bg)] border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)] transition-colors"
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
          className="btn-icon btn-primary shrink-0 w-11 h-11 mb-0 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:bg-[var(--color-border)] disabled:text-white disabled:active:scale-100"
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
