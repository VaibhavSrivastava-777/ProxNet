"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

import { useRouter } from "next/navigation";
import { CompanyLogo, parseAlias } from "../qa/QuestionList";

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

function formatAbsoluteTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ChatRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter();
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<any>(null);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const originalPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "0px";
    return () => {
      document.body.style.paddingBottom = originalPadding;
    };
  }, []);

  useEffect(() => {
    if (sessionId) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `/chat/${sessionId}` })
      }).catch(err => console.error("Failed to mark notifications read:", err));
    }
  }, [sessionId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

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

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

    if (editingMessageId) {
      const msgId = editingMessageId;
      const originalText = text.trim();
      
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, body: originalText } : m))
      );
      
      setEditingMessageId(null);
      setText("");

      const res = await fetch(`/api/chat/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msgId, body: originalText }),
      });

      if (!res.ok) {
        alert("Failed to edit message");
        loadMessages();
      }
      return;
    }

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

  function startEditing(msgId: string, currentBody: string) {
    setEditingMessageId(msgId);
    setText(currentBody);
  }

  async function handleDeleteMessage(msgId: string) {
    if (!confirm("Are you sure you want to delete this message?")) return;

    setMessages((prev) => prev.filter((m) => m.id !== msgId));

    const res = await fetch(`/api/chat/${sessionId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msgId }),
    });

    if (!res.ok) {
      alert("Failed to delete message");
      loadMessages();
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
        if (data.messages) {
          setMessages((prev) => [...prev, ...data.messages]);
        } else if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      } else {
        const errData = await res.json();
        console.error("Reveal failed:", errData);
      }
    } catch (err) {
      console.error("Reveal request error:", err);
    }
  }

  const otherAlias = messages.find((m) => !m.isOwn)?.alias || "Anonymous";
  const { jobTitle, company } = parseAlias(otherAlias);
  const charsLeft = MAX_CHARS - text.length;
  const charsNearLimit = charsLeft < 50;

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-4xl mx-auto bg-[var(--color-surface)] md:border-x border-[var(--color-border-light)] relative shadow-md">

      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface)] px-4 py-3 shrink-0">
        <button
          onClick={() => router.push("/qa")}
          className="btn-icon text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-full p-1"
          style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <CompanyLogo company={company} size={40} />
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-semibold truncate text-[var(--color-text)] m-0 leading-tight">{jobTitle}</h3>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate m-0 mt-0.5">You are chatting as {myAlias || "..."}</p>
        </div>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-chat-bg"
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
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;

            const currentDay = new Date(m.created_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
            const prevMsgDay = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : null;
            const showDaySeparator = currentDay !== prevMsgDay;
            const todayStr = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

            if (m.id.startsWith("q-")) {
              return (
                <div key={m.id} className="w-full flex justify-center my-6 animate-scaleIn">
                  <div className="bg-[var(--color-primary-light)]/10 border border-[var(--color-primary)]/20 rounded-xl p-4 max-w-[85%] sm:max-w-[400px] text-center shadow-sm">
                    <p className="text-[11px] font-semibold text-[var(--color-primary)] mb-1 uppercase tracking-wider">Original Question</p>
                    <p className="text-[15px] text-[var(--color-text)] font-medium">"{m.body}"</p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">Asked by {m.alias}</p>
                  </div>
                </div>
              );
            }

            const isFirstFromSender = !prevMsg || prevMsg.isOwn !== m.isOwn || prevMsg.id.startsWith("q-") || showDaySeparator;
            const isLastFromSender = !nextMsg || nextMsg.isOwn !== m.isOwn || nextMsg.id.startsWith("q-");
            const isNew = new Date(m.created_at).getTime() > mountTime.current && !m.id.startsWith("temp-");
            const longPressTimer = { current: null as ReturnType<typeof setTimeout> | null };

            // Dynamic border radii for message grouping
            let borderRadius = m.isOwn ? "8px 8px 0px 8px" : "8px 8px 8px 0px";
            if (!isFirstFromSender && !isLastFromSender) borderRadius = m.isOwn ? "8px 8px 8px 8px" : "8px 8px 8px 8px";
            else if (!isFirstFromSender && isLastFromSender) borderRadius = m.isOwn ? "8px 8px 0px 8px" : "8px 8px 8px 0px";
            else if (isFirstFromSender && !isLastFromSender) borderRadius = m.isOwn ? "8px 8px 8px 8px" : "8px 8px 8px 8px";
            else if (isFirstFromSender && isLastFromSender) borderRadius = m.isOwn ? "8px 8px 0px 8px" : "8px 8px 8px 0px";

            const isPending = m.id.startsWith("temp-");
            const isRead = !isPending && (currentTime - new Date(m.created_at).getTime() > 2000);

            return (
              <div key={m.id} className="contents">
                {showDaySeparator && (
                  <div className="w-full flex justify-center my-4">
                    <span className="text-[11px] font-semibold px-3 py-1 bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] rounded-full shadow-sm border border-[var(--color-border-light)]">
                      {currentDay === todayStr ? "Today" : currentDay}
                    </span>
                  </div>
                )}
                <div
                  className={`flex flex-col w-full max-w-[85%] ${isNew ? "animate-fadeInUp" : ""} ${
                    m.isOwn ? "ml-auto items-end" : "mr-auto items-start"
                  } ${isFirstFromSender ? "mt-3" : "mt-[2px]"} group`}
                >
                  {!m.isOwn && isFirstFromSender && (
                    <span className="text-[11px] font-semibold text-[var(--color-primary)] ml-2 mb-0.5">
                      {m.alias}
                    </span>
                  )}

                  <div className="flex items-center gap-2 w-full max-w-full">
                    {m.isOwn && !isPending && (
                      <div className="flex gap-1 shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEditing(m.id, m.body)}
                          className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded-md transition-colors"
                          title="Edit Message"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(m.id)}
                          className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-hover)] rounded-md transition-colors"
                          title="Delete Message"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div
                      className={`px-3 py-1.5 text-[15px] relative select-none shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-full ${
                        m.isOwn
                          ? "bg-[var(--whatsapp-bubble-sent)] text-[var(--whatsapp-text)]"
                          : "bg-[var(--whatsapp-bubble-received)] text-[var(--whatsapp-text)]"
                      }`}
                      style={{
                        borderRadius,
                        cursor: "pointer",
                        userSelect: "none",
                        paddingRight: m.isOwn ? "62px" : "48px",
                        paddingBottom: "8px",
                      }}
                      onContextMenu={(e) => { e.preventDefault(); handleLongPress(m.id, m.body); }}
                      onTouchStart={() => {
                        longPressTimer.current = setTimeout(() => handleLongPress(m.id, m.body), 600);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer.current) clearTimeout(longPressTimer.current);
                      }}
                    >
                      <p className="whitespace-pre-wrap break-words m-0 leading-normal">{m.body}</p>

                      {/* WhatsApp-like Inline Timestamp & Ticks */}
                      <div className="absolute bottom-[3px] right-[7px] flex items-center gap-0.5 text-[9px] text-gray-500/80 dark:text-gray-400/60 select-none">
                        <span>{formatAbsoluteTime(m.created_at)}</span>
                        {m.isOwn && (
                          <span className="flex items-center ml-0.5">
                            {isPending ? (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-gray-400 opacity-60">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                            ) : isRead ? (
                              /* Double Blue Ticks */
                              <div className="relative w-4 h-3 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-0 top-0.5 w-3 h-3 text-[#53bdeb]">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-[3px] top-0.5 w-3 h-3 text-[#53bdeb]">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            ) : (
                              /* Double Gray Ticks */
                              <div className="relative w-4 h-3 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-0 top-0.5 w-3 h-3 text-gray-400/80">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-[3px] top-0.5 w-3 h-3 text-gray-400/80">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Copied tooltip */}
                      {copiedId === m.id && (
                        <span
                          className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--color-text)] text-[var(--color-text-inverse)] text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap z-10 shadow-md animate-scaleIn"
                        >
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
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

      {/* Editing Message Banner */}
      {editingMessageId && (
        <div className="bg-[var(--color-primary-subtle)] px-4 py-2 flex items-center justify-between border-t border-[var(--color-border-light)] text-xs text-[var(--color-primary)] font-medium z-10 shrink-0">
          <span>Editing message...</span>
          <button
            type="button"
            onClick={() => {
              setEditingMessageId(null);
              setText("");
            }}
            className="hover:underline text-[var(--color-text-secondary)]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-[var(--color-border-light)] p-3 bg-[var(--whatsapp-bg)]/90 backdrop-blur-sm sticky bottom-0 z-10 w-full animate-fadeIn">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            className="input w-full min-h-[44px] max-h-[120px] rounded-[24px] py-2.5 px-4 resize-none leading-tight bg-[var(--color-surface)] border-none shadow-[0_1px_1px_rgba(0,0,0,0.06)] focus:ring-0 focus:outline-none text-[var(--color-text)] transition-colors"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            rows={1}
            maxLength={MAX_CHARS}
          />
          {/* Character counter */}
          {text.length > 0 && (
            <span
              className="absolute bottom-2.5 right-4 text-[10px] pointer-events-none"
              style={{ color: charsNearLimit ? "var(--color-error)" : "var(--color-text-tertiary)" }}
            >
              {charsLeft}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="btn-icon shrink-0 w-11 h-11 mb-0 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500"
          style={{
            backgroundColor: text.trim() ? "#00a884" : "#cbd5e1",
            color: "white",
          }}
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
