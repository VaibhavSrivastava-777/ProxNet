"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { RechargeModal } from "@/components/RechargeModal";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

const AI_ICEBREAKERS = [
  "Find software engineers living nearby 📍",
  "Any tech meetups happening this week? 📅",
  "How can I request a job referral? 💼",
  "Suggest a friendly intro for a 15-min chai ☕",
];

function formatAbsoluteTime(ts: number | string): string {
  const date = typeof ts === "string" ? new Date(ts) : new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function AIChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [wallet, setWallet] = useState<number | null>(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showScroll, setShowScroll] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialized = useRef(false);

  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [viewportTop, setViewportTop] = useState("0px");

  // Lock body overflow & setup mobile visualViewport
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/ai/chat");
        if (res.ok) {
          const data = await res.json();
          const loaded: Message[] = (data.messages || []).map((m: any) => ({
            ...m,
            timestamp: m.timestamp || Date.now(),
          }));
          setMessages(loaded);
          if (data.wallet !== undefined) setWallet(data.wallet);
          if (data.initial_credits_granted && data.wallet <= 0) {
            setShowRechargeModal(true);
          }
        }
      } catch (err) {
        console.error("Failed to load AI chat history", err);
      } finally {
        setIsFetchingHistory(false);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    if (!isFetchingHistory && initialQuery && !hasInitialized.current) {
      hasInitialized.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, isFetchingHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isFetchingHistory]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScroll(scrollHeight - scrollTop - clientHeight > 120);
  };

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.text,
            timestamp: Date.now(),
          },
        ]);
        if (data.wallet !== undefined) setWallet(data.wallet);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 402 || errData.error === "RECHARGE_REQUIRED") {
          setShowRechargeModal(true);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content:
                "Your credit balance is exhausted. Please contact **ProxNet.Connect@Gmail.com** to recharge your credits.",
              timestamp: Date.now(),
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: "Sorry, I am having trouble connecting right now.",
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Network error occurred. Please check your connection.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/qa");
    }
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-4xl bg-[var(--color-surface)] md:border-x border-[var(--color-border-light)] shadow-md flex flex-col overflow-hidden"
      style={{ height: viewportHeight, top: viewportTop }}
    >
      {/* WhatsApp Header bar */}
      <div
        className="flex items-center gap-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface)] px-4 py-3 shrink-0"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))" }}
      >
        <button
          onClick={handleBack}
          onMouseEnter={() => router.prefetch("/qa")}
          onTouchStart={() => router.prefetch("/qa")}
          className="btn-icon text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-full p-1 cursor-pointer"
          style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Back to chats"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <div className="relative shrink-0">
          <img
            src="/logo.png"
            alt="ProxNet AI"
            className="w-10 h-10 rounded-full object-cover border border-[var(--color-border)] shadow-xs"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--color-surface)]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-body font-semibold truncate text-[var(--color-text)] m-0 leading-tight">
              ProxNet AI
            </h3>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--color-primary-subtle)] text-[var(--color-primary)] uppercase tracking-wider">
              AI
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate m-0 mt-0.5">
            Online • Your networking assistant
          </p>
        </div>

        {wallet !== null && (
          <button
            type="button"
            onClick={() => setShowRechargeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] cursor-pointer transition-colors shadow-2xs"
            title="View credits"
          >
            <span>⚡</span>
            <span>{wallet} credits</span>
          </button>
        )}
      </div>

      {/* Message Area with WhatsApp Chat Background */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 flex flex-col whatsapp-chat-bg"
      >
        {isFetchingHistory && messages.length === 0 ? (
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
          /* Icebreaker Empty State */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeIn">
            <div className="relative">
              <img
                src="/logo.png"
                alt="ProxNet AI"
                className="w-16 h-16 rounded-2xl shadow-lg border border-[var(--color-border)]"
              />
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary)] text-white shadow-xs">
                AI
              </span>
            </div>
            <div className="text-center max-w-sm px-4">
              <h3 className="text-body font-bold text-[var(--color-text)] mb-1">
                Meet your local networking assistant
              </h3>
              <p className="text-body-sm text-[var(--color-text-secondary)] m-0">
                Ask questions about professionals nearby, recent jobs, or questions on the network.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-[460px] px-2 mt-2">
              {AI_ICEBREAKERS.map((ib) => (
                <button
                  key={ib}
                  type="button"
                  onClick={() => sendMessage(ib)}
                  className="px-3.5 py-2 rounded-full text-xs border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors cursor-pointer shadow-2xs font-medium"
                >
                  {ib}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="w-full flex justify-center my-3">
              <span className="text-[11px] font-semibold px-3 py-1 bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] rounded-full shadow-2xs border border-[var(--color-border-light)]">
                Today
              </span>
            </div>

            {messages.map((m, i) => {
              const isOwn = m.role === "user";
              const borderRadius = isOwn ? "8px 8px 0px 8px" : "8px 8px 8px 0px";

              return (
                <div key={m.id || i} className="contents">
                  <div
                    className={`flex flex-col w-full max-w-[85%] ${
                      isOwn ? "ml-auto items-end" : "mr-auto items-start"
                    } mt-2 group animate-fadeInUp`}
                  >
                    {!isOwn && (
                      <span className="text-[11px] font-semibold text-[var(--color-primary)] ml-2 mb-0.5">
                        ProxNet AI
                      </span>
                    )}

                    <div className="flex items-center gap-2 w-full max-w-full">
                      <div
                        className={`px-3.5 py-2 text-[15px] relative select-none shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-w-full ${
                          isOwn
                            ? "bg-[var(--whatsapp-bubble-sent)] text-[var(--whatsapp-text)]"
                            : "bg-[var(--whatsapp-bubble-received)] text-[var(--whatsapp-text)]"
                        }`}
                        style={{
                          borderRadius,
                          paddingRight: isOwn ? "62px" : "48px",
                          paddingBottom: "8px",
                        }}
                      >
                        <div className="whitespace-pre-wrap break-words leading-relaxed select-text">
                          {isOwn ? (
                            <p className="m-0 select-text leading-normal">{m.content}</p>
                          ) : (
                            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 select-text font-normal text-[var(--whatsapp-text)]">
                              <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {/* WhatsApp-like Inline Timestamp & Ticks */}
                        <div className="absolute bottom-[3px] right-[7px] flex items-center gap-0.5 text-[9px] text-gray-500/80 dark:text-gray-400/60 select-none">
                          <span>{formatAbsoluteTime(m.timestamp || Date.now())}</span>
                          {isOwn && (
                            <span className="flex items-center ml-0.5">
                              <div className="relative w-4 h-3 flex items-center justify-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={3}
                                  stroke="currentColor"
                                  className="absolute left-0 top-0.5 w-3 h-3 text-[#53bdeb]"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={3}
                                  stroke="currentColor"
                                  className="absolute left-[3px] top-0.5 w-3 h-3 text-[#53bdeb]"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Typing indicator matching other chats */}
        {isLoading && (
          <div className="flex items-center gap-2 mt-2 animate-fadeIn mr-auto">
            <div className="flex items-center gap-1 px-3 py-2 rounded-[12px_12px_12px_2px] bg-[var(--whatsapp-bubble-received)] shadow-sm border border-[var(--color-border-light)]">
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
            <span className="text-[11px] text-[var(--color-text-tertiary)]">ProxNet AI is typing…</span>
          </div>
        )}

        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {/* Floating Scroll to bottom button */}
      {showScroll && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-20 right-4 btn-icon bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-md border border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] z-10 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
          aria-label="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}

      {/* WhatsApp-Style Input Bar */}
      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 border-t border-[var(--color-border-light)] px-3 py-2 bg-[var(--color-surface)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] sticky bottom-0 z-30 w-full animate-fadeIn shrink-0"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))" }}
      >
        <div className="flex-1 relative flex items-center">
          <textarea
            ref={textareaRef}
            className="chat-textarea w-full h-10 min-h-[40px] max-h-[120px] rounded-[20px] py-[9px] px-4 resize-none text-sm leading-[22px] bg-[var(--color-surface)] border border-[var(--color-border-light)] shadow-[0_1px_1px_rgba(0,0,0,0.06)] focus:border-[var(--color-primary)] focus:ring-0 focus:outline-none text-[var(--color-text)] transition-colors box-border block"
            placeholder="Ask ProxNet AI…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
            rows={1}
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
          className="shrink-0 w-10 h-10 mb-0 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs border-none"
          style={{
            backgroundColor: input.trim() ? "#00a884" : "var(--color-border)",
            color: input.trim() ? "white" : "var(--color-text-tertiary)",
          }}
        >
          {isLoading ? (
            <span className="spinner-sm" style={{ borderTopColor: "white" }} />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          )}
        </button>
      </form>

      {/* Typing bounce animation */}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      <RechargeModal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        walletBalance={wallet}
      />
    </div>
  );
}

export default function ProxNetAIPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading AI Chat...</div>}>
      <AIChatInner />
    </Suspense>
  );
}
