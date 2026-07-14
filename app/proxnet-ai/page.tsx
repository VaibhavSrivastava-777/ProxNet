"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function AIChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const hasInitialized = useRef(false);

  useEffect(() => {
    const originalPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "0px";
    return () => {
      document.body.style.paddingBottom = originalPadding;
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/ai/chat");
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
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

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    
    const userMsg: Message = { role: "user", content: text };
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
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I am having trouble connecting right now." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error occurred." }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-4xl mx-auto bg-[var(--color-surface)] md:border-x border-[var(--color-border-light)] relative shadow-md">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface)] shrink-0">
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
        <img src="/logo.png" alt="ProxNet AI" className="w-10 h-10 rounded-xl shadow-sm shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-body font-semibold truncate text-[var(--color-text)] m-0 leading-tight">ProxNet AI</h3>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate m-0 mt-0.5">Your networking assistant</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--color-bg)]" ref={scrollRef} style={{ backgroundImage: "radial-gradient(var(--color-border-light) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-secondary)]">
            <img src="/logo.png" alt="ProxNet" className="w-16 h-16 rounded-xl shadow-md mb-4 opacity-50 grayscale" />
            <h2 className="text-h3 mb-2">How can I help?</h2>
            <p className="text-body-sm max-w-xs">Ask me about professionals nearby, recent jobs, or questions on the network.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fadeInUp`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${
              msg.role === "user" 
                ? "bg-gradient-to-br from-[var(--color-primary)] to-blue-600 text-white rounded-br-sm shadow-md" 
                : "bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-bl-sm shadow-sm text-[var(--color-text)]"
            }`}>
              <div className="text-[15px] whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                {msg.role === "user" ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-[var(--color-border-light)] p-3 bg-[var(--color-surface)]/90 backdrop-blur-sm sticky bottom-0 z-10 w-full shrink-0">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            className="input w-full min-h-[44px] max-h-[120px] rounded-[22px] py-2.5 px-4 resize-none leading-tight bg-[var(--color-bg)] border-[var(--color-border)] focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)] transition-colors text-body-sm text-[var(--color-text)]"
            placeholder="Ask ProxNet..."
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
          className="btn-icon btn-primary shrink-0 w-11 h-11 mb-0 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:bg-[var(--color-border)] disabled:text-white disabled:active:scale-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </form>
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
