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

export function ChatRoom({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [myAlias, setMyAlias] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/chat/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
      setMyAlias(data.myAlias ?? "");
    }
  }, [sessionId]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const msg = payload.payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, { ...msg, isOwn: false }];
        });
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-lg border">
      <div className="border-b px-4 py-3 text-sm">
        Anonymous chat · You are <span className="font-medium">{myAlias || "..."}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.isOwn ? "ml-auto bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
            }`}
          >
            {!m.isOwn && <p className="mb-1 text-xs opacity-70">{m.alias}</p>}
            <p>{m.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
        <input
          className="flex-1 rounded border px-3 py-2 text-sm"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
