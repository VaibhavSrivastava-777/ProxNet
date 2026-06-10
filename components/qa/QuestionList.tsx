"use client";

import { useCallback, useEffect, useState } from "react";

interface IncomingQuestion {
  id: string;
  body: string;
  status: string;
  company_filter: string | null;
  title_filter: string | null;
  created_at: string;
  asker_alias: string;
  target_id: string;
}

interface AskedQuestion {
  id: string;
  body: string;
  status: string;
  created_at: string;
}

export function QuestionList() {
  const [asked, setAsked] = useState<AskedQuestion[]>([]);
  const [incoming, setIncoming] = useState<IncomingQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/questions");
    if (res.ok) {
      const data = await res.json();
      setAsked(data.asked ?? []);
      setIncoming(data.incoming ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(questionId: string, targetId: string) {
    const res = await fetch("/api/questions/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, targetId }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/chat/${data.sessionId}`;
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading questions...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-medium">Your questions</h2>
        {asked.length === 0 && <p className="text-sm text-zinc-500">No questions yet.</p>}
        {asked.map((q) => (
          <div key={q.id} className="rounded border p-3 text-sm">
            <p>{q.body}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {new Date(q.created_at).toLocaleString()} · {q.status}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Incoming (for you)</h2>
        {incoming.length === 0 && (
          <p className="text-sm text-zinc-500">No incoming questions.</p>
        )}
        {incoming.map((q) => (
          <div key={q.target_id} className="rounded border p-3 text-sm">
            <p className="text-xs text-zinc-500">From {q.asker_alias}</p>
            <p className="mt-1">{q.body}</p>
            {q.status !== "responded" ? (
              <button
                type="button"
                onClick={() => respond(q.id, q.target_id)}
                className="mt-2 rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
              >
                Respond anonymously
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(`/api/chat/by-question/${q.id}`);
                  if (res.ok) {
                    const data = await res.json();
                    window.location.href = `/chat/${data.sessionId}`;
                  }
                }}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Open chat
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
