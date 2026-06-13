"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export function JobInbox() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs/inbox")
      .then((res) => res.json())
      .then((data) => {
        setThreads(data.threads || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="card p-4 skeleton h-24" />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="card p-8 text-center animate-fadeIn border border-dashed border-border-light">
        <p className="text-body font-medium text-text-secondary">No active job chats yet.</p>
        <p className="text-caption mt-1">Start a conversation from the Job Feed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger-children">
      {threads.map((t) => (
        <Link key={t.id} href={`/jobs/chat/${t.id}`} className="block">
          <div className="card p-4 hover:border-primary transition-colors cursor-pointer flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="avatar avatar-sm bg-primary-subtle text-primary font-bold">
                  {t.otherAlias.charAt(0)}
                </div>
                <div>
                  <h4 className="text-body font-semibold text-text">{t.otherAlias}</h4>
                  <p className="text-caption text-text-secondary">
                    Regarding: {t.postRole}
                  </p>
                </div>
              </div>
              <span className="text-xs text-text-tertiary">
                {formatDistanceToNow(new Date(t.latestMessageAt), { addSuffix: true })}
              </span>
            </div>
            
            <p className="text-sm text-text-secondary line-clamp-1 mt-1 pl-10">
              {t.latestMessage}
            </p>

            {t.status === "revealed" && (
              <div className="pl-10 mt-1">
                <span className="badge badge-success text-[10px]">Identities Revealed</span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
