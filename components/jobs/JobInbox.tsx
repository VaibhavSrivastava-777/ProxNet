"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CompanyLogo } from "@/components/qa/QuestionList";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function JobInbox() {
  const { data, isLoading } = useSWR<{ threads: any[] }>("/api/jobs/inbox", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });
  const [isExpanded, setIsExpanded] = useState(true);

  const threads = data?.threads || [];

  if (isLoading && !data) {
    return null;
  }

  if (threads.length === 0) {
    return null;
  }

  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden transition-all animate-fadeIn">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-[var(--color-surface-secondary)]/50 hover:bg-[var(--color-surface-hover)] border-none text-left cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">🤝</span>
          <span className="text-xs sm:text-sm font-bold text-[var(--color-text)]">
            My Referral Conversations
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            {threads.length}
          </span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              {unreadCount} unread
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--color-text-tertiary)] font-medium">
          {isExpanded ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      {/* Threads List */}
      {isExpanded && (
        <div className="divide-y divide-[var(--color-border-light)] max-h-[320px] overflow-y-auto">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/jobs/chat/${t.id}`}
              className="block p-3.5 hover:bg-[var(--color-surface-hover)] transition-colors text-inherit no-underline"
            >
              <div className="flex items-start gap-3">
                <CompanyLogo company={t.postCompany || null} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-xs font-bold text-[var(--color-text)] m-0 truncate">
                        {t.otherAlias}
                      </h4>
                      {t.unread && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" title="Unread message" />
                      )}
                    </div>
                    {t.status === "revealed" && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        Revealed
                      </span>
                    )}
                  </div>
                  
                  {/* Role and Company */}
                  <div className="text-[11px] font-semibold text-[var(--color-primary)] truncate mb-1 flex items-center gap-1">
                    <span>🎯</span>
                    <span className="truncate">{t.jobTitle || t.postRole}{t.postCompany ? ` @ ${t.postCompany}` : ""}</span>
                  </div>

                  <p className="text-xs text-[var(--color-text-secondary)] truncate m-0">
                    {t.latestMessage}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

