"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { playNotificationSound } from "@/lib/sound";
import { CompanyLogo } from "@/components/qa/QuestionList";

function formatAbsoluteTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface Props {
  threadId: string;
  userId: string;
}

export function JobChatRoom({ threadId, userId }: Props) {
  const [thread, setThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`job_chat_cache_${threadId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.messages)) return parsed.messages;
        }
      } catch (e) {}
    }
    return [];
  });
  const [initialLoading, setInitialLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`job_chat_cache_${threadId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) return false;
        }
      } catch (e) {}
    }
    return true;
  });
  const [myAlias, setMyAlias] = useState("");
  const [otherAlias, setOtherAlias] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [myRevealAgreed, setMyRevealAgreed] = useState(false);
  const [otherRevealAgreed, setOtherRevealAgreed] = useState(false);
  const [otherContact, setOtherContact] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [viewportTop, setViewportTop] = useState("0px");
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  // Manage visual viewport for native mobile keyboard handling
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setViewportHeight(`${vv.height}px`);
      setViewportTop(`${vv.offsetTop}px`);
      window.scrollTo(0, 0);
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport!.removeEventListener("resize", handleViewportChange);
      window.visualViewport!.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  // Lock body scroll while in chat room
  useEffect(() => {
    const originalPadding = document.body.style.paddingBottom;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyHeight = document.body.style.height;
    
    document.body.style.paddingBottom = "0px";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    const handleScroll = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      document.body.style.paddingBottom = originalPadding;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.height = originalBodyHeight;
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`job-chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload?.new && payload.new.sender_id !== userId) {
            try {
              playNotificationSound("message");
            } catch (e) {}
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "job_threads", filter: `id=eq.${threadId}` },
        () => {
          fetchData();
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
        setMessages(data.messages || []);
        setMyAlias(data.myAlias || "");
        setOtherAlias(data.otherAlias || "");
        setMyRevealAgreed(data.myRevealAgreed || false);
        setOtherRevealAgreed(data.otherRevealAgreed || false);
        if (data.otherContact) {
          setOtherContact(data.otherContact);
        }

        const postObj = Array.isArray(data.thread?.post) ? data.thread.post[0] : data.thread?.post;
        if (postObj) {
          setCompanyName(postObj.company || "");
          setRoleTitle(postObj.role || "");
        }

        try {
          sessionStorage.setItem(`job_chat_cache_${threadId}`, JSON.stringify({
            messages: data.messages || [],
            myAlias: data.myAlias || "",
            otherAlias: data.otherAlias || "",
          }));
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    
    const textToSend = input.trim();
    setInput("");

    // Optimistic message append
    const tempMsg = {
      id: `temp-${Date.now()}`,
      thread_id: threadId,
      sender_id: userId,
      body: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch("/api/jobs/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, body: textToSend }),
      });
      if (!res.ok) {
        // Revert on error
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        setInput(textToSend);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setInput(textToSend);
    } finally {
      setSending(false);
    }
  }

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          setInput((prev) => (prev ? `${prev} ${clipText}` : clipText));
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              const len = textareaRef.current.value.length;
              textareaRef.current.setSelectionRange(len, len);
            }
          }, 50);
        }
      } else {
        alert("Clipboard reading is not supported or permitted in this browser.");
      }
    } catch (err: any) {
      console.warn("[clipboard paste]", err);
      alert("Unable to paste from clipboard. Please allow clipboard permissions in your browser or use Ctrl+V / Cmd+V.");
    }
  };

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
          fetchData();
        }
      }
    } finally {
      setRevealing(false);
    }
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/jobs");
    }
  };

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-4xl bg-[var(--color-surface)] md:border-x border-[var(--color-border-light)] shadow-md flex flex-col overflow-hidden"
      style={{ height: viewportHeight, top: viewportTop }}
    >
      {/* Native App Header Bar */}
      <div 
        className="flex items-center gap-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface)] px-4 py-3 shrink-0 z-20"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <button
          onClick={handleBack}
          className="btn-icon text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-full p-1 cursor-pointer"
          style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        {companyName ? (
          <CompanyLogo company={companyName} size={40} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
            {otherAlias ? otherAlias.charAt(0).toUpperCase() : "🤝"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold truncate text-[var(--color-text)] m-0 leading-tight">
              {otherAlias || "Referral Partner"}
            </h3>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
              Referral
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate m-0 mt-0.5">
            {roleTitle ? `Role: ${roleTitle}` : "Job Referral Conversation"}
          </p>
        </div>
      </div>

      {/* Compact Reveal Identity Banner */}
      {thread && thread.status === "active" && !myRevealAgreed && (
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🤝</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-purple-900 dark:text-purple-200 m-0 truncate">Ready to reveal identities?</p>
              <p className="text-[11px] text-purple-700 dark:text-purple-300 m-0 truncate">Share LinkedIn / contact details when both agree</p>
            </div>
          </div>
          <button 
            onClick={handleReveal} 
            disabled={revealing} 
            className="btn btn-xs btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
          >
            {revealing ? "Sharing..." : "Reveal Identity"}
          </button>
        </div>
      )}

      {thread && thread.status === "reveal_pending" && myRevealAgreed && (
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] flex items-center gap-2 text-xs text-[var(--color-text-secondary)] shrink-0 animate-fadeIn">
          <span className="spinner-sm text-primary shrink-0" />
          <span>You agreed to reveal. Waiting for the other party to accept...</span>
        </div>
      )}

      {thread && thread.status === "revealed" && (
        <div className="mx-3 mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✅ Identities Revealed:</span>
            {otherContact && (
              <span className="truncate text-emerald-800 dark:text-emerald-200 font-medium">
                {otherContact.includes("linkedin.com") ? (
                  <a href={otherContact} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-primary">
                    View LinkedIn Profile ↗
                  </a>
                ) : (
                  otherContact
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Message Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-chat-bg gap-2"
      >
        {initialLoading && messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-end gap-3 p-4 animate-pulse">
            <div className="flex items-start gap-2 max-w-[70%]">
              <div className="w-8 h-8 rounded-full bg-[var(--color-border-light)] shrink-0" />
              <div className="p-3 rounded-2xl rounded-bl-xs bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] space-y-2 w-48">
                <div className="h-3 bg-[var(--color-border-light)] rounded w-full" />
                <div className="h-3 bg-[var(--color-border-light)] rounded w-3/4" />
              </div>
            </div>
            <div className="flex items-end justify-end gap-2 max-w-[70%] ml-auto">
              <div className="p-3 rounded-2xl rounded-br-xs bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/20 space-y-2 w-56">
                <div className="h-3 bg-[var(--color-primary)]/30 rounded w-full" />
                <div className="h-3 bg-[var(--color-primary)]/30 rounded w-2/3 ml-auto" />
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
            <span className="text-3xl">🤝</span>
            <p className="text-sm font-semibold text-[var(--color-text)] m-0">No messages yet</p>
            <p className="text-xs text-[var(--color-text-secondary)] m-0">Send a warm pitch to get this referral conversation going!</p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.sender_id === userId;
            const isSystem = m.sender_id === "00000000-0000-0000-0000-000000000000";

            if (isSystem) {
              return (
                <div key={m.id || idx} className="flex justify-center my-2">
                  <div className="bg-[var(--color-surface-secondary)] px-3 py-1 rounded-full border border-[var(--color-border-light)] text-center shadow-2xs">
                    <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium m-0">{m.body}</p>
                  </div>
                </div>
              );
            }

            const borderRadius = isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px";
            const isPending = String(m.id).startsWith("temp-");

            return (
              <div key={m.id || idx} className={`flex flex-col ${isMe ? "items-end ml-auto" : "items-start mr-auto"} max-w-[85%]`}>
                <div
                  className={`px-3.5 py-2 text-sm relative select-none shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                    isMe
                      ? "bg-[var(--whatsapp-bubble-sent)] text-[var(--whatsapp-text)]"
                      : "bg-[var(--whatsapp-bubble-received)] text-[var(--whatsapp-text)]"
                  }`}
                  style={{
                    borderRadius,
                    paddingRight: isMe ? "56px" : "46px",
                    paddingBottom: "8px",
                  }}
                >
                  <p className="whitespace-pre-wrap break-words m-0 leading-relaxed text-[13.5px]">{m.body}</p>
                  
                  {/* Timestamp & checkmarks */}
                  <div className="absolute bottom-[3px] right-[8px] flex items-center gap-1 text-[9.5px] text-gray-500/80 dark:text-gray-400/60 select-none">
                    <span>{m.created_at ? formatAbsoluteTime(m.created_at) : ""}</span>
                    {isMe && (
                      <span className="flex items-center ml-0.5">
                        {isPending ? (
                          <span className="opacity-50">🕒</span>
                        ) : (
                          <div className="relative w-3.5 h-3 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-0 top-0.5 w-3 h-3 text-[#53bdeb]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="absolute left-[3px] top-0.5 w-3 h-3 text-[#53bdeb]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </div>
                        )}
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

      {/* WhatsApp-Style Input bar */}
      <form 
        onSubmit={handleSend} 
        className="flex items-end gap-2 border-t border-[var(--color-border-light)] px-3 py-2 bg-[var(--whatsapp-bg)]/95 backdrop-blur-sm shrink-0 z-20"
        style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Paste from Clipboard Button */}
        <button
          type="button"
          onClick={handlePasteClipboard}
          title="Paste from clipboard"
          aria-label="Paste from clipboard"
          className="shrink-0 w-10 h-10 mb-0 flex items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-primary transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
        </button>

        <div className="flex-1 relative flex items-center">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="chat-textarea w-full h-10 min-h-[40px] max-h-[120px] rounded-[20px] py-[9px] px-4 resize-none text-sm leading-[22px] bg-[var(--color-surface)] border border-[var(--color-border-light)] shadow-[0_1px_1px_rgba(0,0,0,0.06)] focus:border-[var(--color-primary)] focus:ring-0 focus:outline-none text-[var(--color-text)] transition-colors box-border block"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="shrink-0 w-10 h-10 mb-0 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
          style={{
            backgroundColor: input.trim() ? "#00a884" : "var(--color-border)",
            color: input.trim() ? "white" : "var(--color-text-tertiary)",
          }}
        >
          {sending ? (
            <span className="spinner-sm" style={{ borderTopColor: "white" }} />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
