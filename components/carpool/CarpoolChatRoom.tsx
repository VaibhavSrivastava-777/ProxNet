"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

function formatAbsoluteTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  alias: string;
  isOwn: boolean;
}

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

export function CarpoolChatRoom({ threadId }: { threadId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [myAlias, setMyAlias] = useState("");
  const [threadStatus, setThreadStatus] = useState("active");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [revealPhone, setRevealPhone] = useState("");
  const [otherPhone, setOtherPhone] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    // To simplify, we can create a single GET /api/carpool/chat/[threadId] that returns msgs + status
    const res = await fetch(`/api/carpool/chat/${threadId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
      setMyAlias(data.myAlias ?? "");
      setThreadStatus(data.status ?? "active");
      if (!revealPhone && data.myPhone) setRevealPhone(data.myPhone);
      if (data.otherPhone) setOtherPhone(data.otherPhone);
    }
  }, [threadId, revealPhone]);

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 3000);
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`carpool-chat:${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carpool_messages", filter: `thread_id=eq.${threadId}` },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carpool_threads", filter: `id=eq.${threadId}` },
        loadData
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [threadId, loadData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, threadStatus]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/carpool/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, body: text }),
    });
    setSending(false);
    if (res.ok) {
      setText("");
      loadData(); // To show optimistic immediately, we rely on loadData + supabase realtime
    }
  }

  async function handleAction(action: "agree" | "decline") {
    setActionLoading(true);
    const res = await fetch(`/api/carpool/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, action, phoneNumber: revealPhone }),
    });
    if (res.ok) {
      loadData();
    } else {
      alert("Action failed.");
    }
    setActionLoading(false);
  }

  const otherAlias = messages.find((m) => !m.isOwn)?.alias || "Anonymous";

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
            <p className="text-caption">Carpool Match · You are {myAlias || "..."}</p>
          </div>
        </div>
        <div className={`badge ${threadStatus === 'revealed' ? 'badge-success' : 'badge-accent'}`}>
          {threadStatus === 'revealed' ? 'Revealed' : 'Anonymous'}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 whatsapp-chat-bg">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--color-text-secondary)]">
            <p>Say hello to arrange the carpool logistics!</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isFirstFromSender = i === 0 || messages[i - 1].isOwn !== m.isOwn;
            const borderRadius = m.isOwn ? "8px 8px 0px 8px" : "8px 8px 8px 0px";
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
                  className={`px-3 py-1.5 text-[15px] relative select-none shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ${
                    m.isOwn
                      ? "bg-[var(--whatsapp-bubble-sent)] text-[var(--whatsapp-text)]"
                      : "bg-[var(--whatsapp-bubble-received)] text-[var(--whatsapp-text)]"
                  }`}
                  style={{
                    borderRadius,
                    paddingRight: m.isOwn ? "62px" : "48px",
                    paddingBottom: "8px",
                  }}
                >
                  <p className="whitespace-pre-wrap break-words m-0 leading-normal">{m.body}</p>
                  
                  {/* WhatsApp-like Inline Timestamp */}
                  <div className="absolute bottom-[3px] right-[7px] flex items-center gap-0.5 text-[9px] text-gray-500/80 dark:text-gray-400/60 select-none">
                    <span>{formatAbsoluteTime(m.created_at)}</span>
                    {m.isOwn && (
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
        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>

      {/* Reveal overlay or action strip */}
      {threadStatus === "reveal_pending" && (
        <div className="border-t border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 shrink-0 animate-scaleIn">
          <p className="font-semibold text-[var(--color-warning)] mb-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
            </svg>
            Anthropic AI Handshake Suggestion
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            It looks like you've mutually agreed on logistics. Would you like to reveal your phone number and confirm the ride?
          </p>
          <input 
            type="tel" 
            placeholder="Your Phone Number" 
            className="input mb-3 w-full" 
            value={revealPhone} 
            onChange={e => setRevealPhone(e.target.value)} 
          />
          <div className="flex gap-2">
            <button onClick={() => handleAction("agree")} disabled={actionLoading || !revealPhone} className="btn btn-primary flex-1">
              {actionLoading ? "..." : "Confirm & Share"}
            </button>
            <button onClick={() => handleAction("decline")} disabled={actionLoading} className="btn btn-ghost flex-1 border border-[var(--color-border)]">
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      {threadStatus !== "revealed" ? (
        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[var(--color-border-light)] bg-[var(--whatsapp-bg)]/90 backdrop-blur-sm p-3 shrink-0">
          <textarea
            className="input flex-1 min-h-[44px] max-h-[120px] rounded-[24px] py-2.5 px-4 resize-none leading-tight bg-[var(--color-surface)] border-none shadow-[0_1px_1px_rgba(0,0,0,0.06)] focus:ring-0 focus:outline-none text-[var(--color-text)] transition-colors"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e as any); }
            }}
            rows={1}
          />
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
      ) : (
        <div className="border-t border-[var(--color-success)] bg-[var(--color-success-bg)] p-4 text-center text-[var(--color-success)] font-semibold shrink-0">
          Match confirmed! You can reach {otherAlias} at <strong>{otherPhone || "their registered phone number"}</strong>. Have a safe ride!
        </div>
      )}
    </div>
  );
}
