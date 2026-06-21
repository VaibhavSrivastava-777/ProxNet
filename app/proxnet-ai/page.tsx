"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (initialQuery && !hasInitialized.current) {
      hasInitialized.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
    <div className="flex flex-col h-[calc(100vh-var(--nav-height))] max-w-3xl mx-auto w-full relative bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-sm shrink-0">
        <Link href="/" className="btn-icon text-[var(--color-text-secondary)]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <img src="/logo.png" alt="ProxNet AI" className="w-8 h-8 rounded-md shadow-sm" />
        <div>
          <h1 className="text-h3 leading-tight m-0">ProxNet AI</h1>
          <p className="text-caption text-[var(--color-text-tertiary)] m-0">Your network assistant</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
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
                ? "bg-[var(--color-primary)] text-white rounded-br-sm shadow-md" 
                : "bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-bl-sm shadow-sm text-[var(--color-text)]"
            }`}>
              <div className="text-body-sm whitespace-pre-wrap">{msg.content}</div>
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
      <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-border-light)] shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            className="w-full pl-4 pr-12 py-3 bg-[var(--color-bg)] border border-[var(--color-border-light)] rounded-full focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-shadow text-body-sm"
            placeholder="Ask ProxNet..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white disabled:opacity-50 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-[1px]">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>
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
