"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { companyLogoUrl } from "@/lib/anonymize";

interface IncomingQuestion {
  id: string;
  body: string;
  status: string;
  company_filter: string | null;
  title_filter: string | null;
  created_at: string;
  asker_alias: string;
  target_id: string;
  latest_activity_at: string;
  latest_message_body: string | null;
  latest_message_sender: string | null;
  session_id?: string | null;
}

interface ForumQuestion {
  id: string;
  body: string;
  asker_alias: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

interface AskedQuestion {
  id: string;
  body: string;
  status: string;
  created_at: string;
  company_filter: string | null;
  question_targets?: { status: string }[];
  latest_activity_at: string;
  latest_message_body: string | null;
  latest_message_sender: string | null;
  target_alias?: string | null;
  session_id?: string | null;
}

interface Props {
  refreshKey?: number;
  onOpenDirectQuestion?: (target: { id: string; job_title: string; company: string }) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatWhatsAppTime(ts: string): string {
  const date = new Date(ts);
  const now = new Date();

  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();

  if (isToday) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) {
      return "Yesterday";
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  }
}

export function parseAlias(alias: string) {
  if (!alias) return { jobTitle: "Professional", company: "" };
  if (alias.includes(" @ ")) {
    const parts = alias.split(" @ ");
    return { jobTitle: parts[0], company: parts[1] || "" };
  }
  return { jobTitle: alias, company: "" };
}

export function CompanyLogo({ company, size = 48 }: { company?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (!company || company.trim() === "" || company.toLowerCase().includes("neighbor") || company.toLowerCase().includes("resident") || company.toLowerCase().includes("professional")) {
    return (
      <div 
        className="flex-shrink-0 rounded-full flex items-center justify-center bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] border border-[var(--color-border-light)] shadow-inner"
        style={{ width: size, height: size }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  if (company === "ProxNet AI") {
    return (
      <div className="flex-shrink-0 rounded-full overflow-hidden border border-[var(--color-primary)]/20 shadow-sm" style={{ width: size, height: size }}>
        <img src="/logo.png" alt="ProxNet AI" className="w-full h-full object-cover" />
      </div>
    );
  }

  const logoUrl = companyLogoUrl(company);

  if (imgError) {
    const firstLetter = company.charAt(0).toUpperCase();
    const bgGradients = [
      "from-blue-500 to-indigo-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600"
    ];
    const hash = company.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradient = bgGradients[hash % bgGradients.length];

    return (
      <div 
        className={`flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br ${gradient}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {firstLetter}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={company}
      onError={() => setImgError(true)}
      className="flex-shrink-0 rounded-full object-contain bg-white p-1 border border-[var(--color-border-light)] shadow-sm"
      style={{ width: size, height: size }}
    />
  );
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
});

export function QuestionList({ refreshKey = 0, onOpenDirectQuestion }: Props) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
    return () => {
      setIsNavigating(false);
    };
  }, []);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "suggestions">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSearchSuggestions, setAiSearchSuggestions] = useState<any[]>([]);
  const [searchingAI, setSearchingAI] = useState(false);

  useEffect(() => {
    if (!searchQuery?.trim()) {
      setAiSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingAI(true);
      try {
        const res = await fetch(`/api/ai/search-suggestion?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setAiSearchSuggestions(data.suggestions || []);
        }
      } catch (e) {
        console.error("Failed to fetch AI search suggestions:", e);
      } finally {
        setSearchingAI(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = useSWR<{ asked: AskedQuestion[], incoming: IncomingQuestion[], forum: ForumQuestion[], suggestions?: any[], aiSession?: any }>(`/api/questions?_refresh=${refreshKey}`, fetcher, { refreshInterval: 10000 });
  const { data: notificationsData, mutate: mutateNotifications } = useSWR<{ notifications: any[] }>("/api/notifications", fetcher, { refreshInterval: 5000 });

  const asked = data?.asked || [];
  const incoming = data?.incoming || [];
  const aiSession = data?.aiSession;
  const suggestions = data?.suggestions || [];
  const notifications = notificationsData?.notifications || [];

  async function respond(questionId: string, targetId: string) {
    setIsNavigating(true);
    const res = await fetch("/api/questions/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, targetId }),
    });
    if (res.ok) {
      const data = await res.json();
      // Mark as read immediately
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `/chat/${data.sessionId}` })
      }).then(() => mutateNotifications());

      router.push(`/chat/${data.sessionId}`);
    } else {
      setIsNavigating(false);
      alert("Failed to respond");
    }
  }

  async function openChat(questionId: string) {
    setIsNavigating(true);
    const res = await fetch(`/api/chat/by-question/${questionId}`);
    if (res.ok) {
      const data = await res.json();
      // Mark as read immediately
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `/chat/${data.sessionId}` })
      }).then(() => mutateNotifications());

      router.push(`/chat/${data.sessionId}`);
    } else {
      setIsNavigating(false);
    }
  }

  async function initiateDirectChat(target: { id: string; job_title: string; company: string }) {
    setIsNavigating(true);
    try {
      const extAsked = asked.find((q: any) => 
        q.question_targets?.some((t: any) => t.professional_id === target.id)
      );
      if (extAsked) {
        openChat(extAsked.id);
        return;
      }

      const extIncoming = incoming.find((q: any) => q.asker_id === target.id);
      if (extIncoming) {
        openChat(extIncoming.id);
        return;
      }

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionBody: `Hi, I'd like to start a chat with you!`,
          targetUserId: target.id,
          centerLat: null,
          centerLng: null,
          radiusMeters: 5000,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) {
          router.push(`/chat/${data.sessionId}`);
          return;
        }
        const questionId = data.question?.id;
        if (questionId) {
          const sessionRes = await fetch(`/api/chat/by-question/${questionId}`);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            router.push(`/chat/${sessionData.sessionId}`);
            return;
          }
        }
      }
      alert("Failed to start chat session.");
      setIsNavigating(false);
    } catch (e) {
      alert("Error starting chat session.");
      setIsNavigating(false);
    }
  }

  if (isLoading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-lg)" }} />
        <div className="skeleton" style={{ height: "5rem", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }


  // Unify and sort
  const unified = [
    ...asked.map(q => ({ type: "asked" as const, data: q, ts: new Date(q.latest_activity_at).getTime() })),
    ...incoming.map(q => ({ type: "incoming" as const, data: q, ts: new Date(q.latest_activity_at).getTime() }))
  ].sort((a, b) => b.ts - a.ts);

  // Client-side search filters
  const filteredUnified = unified.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (item.type === "asked") {
      const q = item.data;
      const hasResponse = q.question_targets?.some((t: any) => t.status === "responded");
      const rawTitle = q.target_alias || (hasResponse ? "Responder" : "Nearby Professional");
      const { jobTitle, company } = parseAlias(rawTitle);
      const previewText = (q.latest_message_body || q.body || "").toLowerCase();
      return (
        jobTitle.toLowerCase().includes(query) ||
        company.toLowerCase().includes(query) ||
        previewText.includes(query)
      );
    } else {
      const q = item.data;
      const rawTitle = q.asker_alias;
      const { jobTitle, company } = parseAlias(rawTitle);
      const previewText = (q.latest_message_body || q.body || "").toLowerCase();
      return (
        jobTitle.toLowerCase().includes(query) ||
        company.toLowerCase().includes(query) ||
        previewText.includes(query)
      );
    }
  });

  const unreadCount = unified.filter(item => {
    if (item.type === "asked") {
      const q = item.data;
      return q.latest_message_body && q.latest_message_sender !== "asker";
    } else {
      const q = item.data;
      const hasResponse = q.status === "responded";
      return (!hasResponse) || (q.latest_message_body && q.latest_message_sender !== "responder");
    }
  }).length;

  const displayedUnified = filteredUnified.filter(item => {
    if (activeTab === "unread") {
      if (item.type === "asked") {
        return item.data.latest_message_body && item.data.latest_message_sender !== "asker";
      } else {
        const hasResponse = item.data.status === "responded";
        return (!hasResponse) || (item.data.latest_message_body && item.data.latest_message_sender !== "responder");
      }
    }
    return true;
  });

  const filteredSuggestions = suggestions.filter((s: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const jobTitle = (s.user.job_title || "").toLowerCase();
    const company = (s.user.company || "").toLowerCase();
    const reason = (s.reason || "").toLowerCase();
    return jobTitle.includes(query) || company.includes(query) || reason.includes(query);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", position: "relative" }}>
      {isNavigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-background)]/60 backdrop-blur-sm animate-fadeIn">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <img src="/logo.png" alt="ProxNet Loading" className="w-16 h-16 rounded-xl shadow-lg" />
            <p className="text-body font-semibold text-[var(--color-primary)]">Opening secure chat...</p>
          </div>
        </div>
      )}

      {/* Page Title & FAB */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h1 className="text-h1 m-0 text-[var(--color-text)]">Chats</h1>
        <button
          onClick={() => onOpenDirectQuestion?.({ id: "", job_title: "", company: "" })}
          className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white shadow-md hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center shrink-0"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      {/* WhatsApp Style Search Bar */}
      <div className="relative mb-2 shrink-0">
        <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[var(--color-text-secondary)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ask ProxNetAI or Search"
          className="w-full pl-11 pr-4 py-3 rounded-full bg-[var(--color-surface-secondary)] border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder-[var(--color-text-tertiary)] text-[var(--color-text)] shadow-inner transition-all"
        />
      </div>

      {/* WhatsApp Capsule Pills Tabs */}
      <div className="flex items-center gap-2 mb-2 flex-wrap px-1">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("unread")}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
            activeTab === "unread"
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          Unread {unreadCount > 0 && <span className="ml-1 opacity-80">{unreadCount}</span>}
        </button>
        <button
          onClick={() => setActiveTab("suggestions")}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
            activeTab === "suggestions"
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          AI Suggestions
        </button>
      </div>

      <div className="animate-fadeInUp">
        {activeTab === "suggestions" ? (
          <div className="flex flex-col gap-4">
            <div className="mb-2">
              <h2 className="text-h3 text-primary flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary animate-pulse">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                AI Suggested Connections
              </h2>
              <p className="text-caption text-text-secondary mt-1">
                Top local professionals matching your background within 5km.
              </p>
            </div>

            {filteredSuggestions.length === 0 ? (
              <div className="card p-8 text-center border border-dashed border-border flex flex-col items-center justify-center min-h-[200px]">
                <p className="text-body text-text-secondary font-medium">No matches found.</p>
                <p className="text-caption mt-1">Try searching for other terms or checking your profile.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredSuggestions.map((s: any) => (
                  <div key={s.user.id} className="card p-5 border border-[var(--color-border-light)] hover:border-[var(--color-primary)] transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-surface shadow-sm rounded-xl">
                    <div className="flex gap-4">
                      <div className="avatar avatar-md shrink-0 bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                        {s.user.full_name ? getInitials(s.user.full_name) : "PR"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-body font-semibold text-text m-0">{s.user.job_title || "Professional"}</h4>
                          <span className="badge bg-primary/10 text-primary border border-primary/20 font-bold text-[10px] px-2 py-0.5 rounded-full">
                            {Math.round(s.score)}% Match
                          </span>
                        </div>
                        <p className="text-body-sm text-text-secondary font-medium mt-0.5">{s.user.company || "Local Network"}</p>
                        
                        {s.reason && (
                          <div className="mt-3 p-3 bg-primary-light/5 border border-primary/10 rounded-xl text-xs text-[var(--color-text)] flex items-start gap-2">
                            <span className="text-base leading-none select-none">✨</span>
                            <div>
                              <strong className="text-[var(--color-primary)] font-semibold">Reason to Connect:</strong> <span className="leading-relaxed">{s.reason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="shrink-0 flex items-center justify-end">
                      <button 
                        onClick={() => {
                          if (onOpenDirectQuestion) {
                            onOpenDirectQuestion(s.user);
                          }
                        }}
                        className="btn btn-primary btn-sm px-4"
                      >
                        Ask Question
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border-light)] shadow-sm">
            {/* Pinned ProxNet AI Chat */}
            <div 
              key="ai-session"
              className="flex items-center gap-3.5 py-3.5 px-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors border-b border-[var(--color-border-light)]"
              onClick={() => router.push("/proxnet-ai")}
            >
              <CompanyLogo company="ProxNet AI" size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h4 className="text-body font-semibold truncate text-[var(--color-text)] flex items-center gap-1.5">
                    ProxNet AI
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--color-text-tertiary)] flex-shrink-0">
                      <title>Pinned</title>
                      <path d="M16 12V4C16 2.9 15.1 2 14 2H10C8.9 2 8 2.9 8 4V12C5.79 12 4 13.79 4 16V18H11V22H13V18H20V16C20 13.79 18.21 12 16 12Z" />
                    </svg>
                  </h4>
                  {aiSession && (
                    <span className="text-[11px] text-[var(--color-text-tertiary)] font-normal whitespace-nowrap ml-2">
                      {formatWhatsAppTime(aiSession.latest_activity_at)}
                    </span>
                  )}
                </div>
                <div className="text-body-sm text-[var(--color-text-secondary)] truncate">
                  {aiSession?.latest_message_body || "Chat with your networking assistant..."}
                </div>
              </div>
            </div>

            {/* Other Direct Message Conversations */}
            {displayedUnified.length === 0 ? (
              searchQuery ? (
                <div className="flex flex-col">
                  {searchingAI && (
                    <div className="p-6 bg-[var(--color-surface-secondary)] border-t border-[var(--color-border-light)] flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <div className="spinner spinner-sm animate-spin" />
                      <span>Generating suggestions using AI...</span>
                    </div>
                  )}

                  {!searchingAI && aiSearchSuggestions.length > 0 && (
                    <div className="p-4 bg-[var(--color-surface-secondary)] border-t border-[var(--color-border-light)] flex flex-col gap-3 animate-fadeIn">
                      <p className="text-xs text-[var(--color-text-secondary)] font-medium m-0">No active chats found. Would you like to connect?</p>
                      {aiSearchSuggestions.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => initiateDirectChat({ id: s.id, job_title: s.job_title, company: s.company })}
                          className="w-full text-left px-4 py-3.5 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-all flex items-center justify-between gap-3 text-sm font-semibold text-[var(--color-text)] shadow-sm"
                        >
                          <span className="truncate">
                            Initiate chat with <span className="text-[var(--color-primary)]">{s.job_title}</span> @ <span className="text-[var(--color-primary)]">{s.company}</span>
                          </span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)] shrink-0">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searchingAI && aiSearchSuggestions.length === 0 && (
                    <div className="text-center py-8 text-[var(--color-text-secondary)] text-sm border-t border-[var(--color-border-light)]">
                      No matching chats found.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-[var(--color-text-secondary)] text-sm">
                  No direct messages yet.
                </div>
              )
            ) : (
              displayedUnified.map((item, idx) => {
                const isLast = idx === displayedUnified.length - 1;
                if (item.type === "asked") {
                  const q = item.data;
                  const hasResponse = q.question_targets?.some((t: any) => t.status === "responded");
                  const rawTitle = q.target_alias || (hasResponse ? "Responder" : "Nearby Professional");
                  const { jobTitle, company } = parseAlias(rawTitle);
                  const previewText = q.latest_message_body ? (q.latest_message_sender === "asker" ? "You: " + q.latest_message_body : q.latest_message_body) : "You: " + q.body;
                  const isUnread = q.session_id ? notifications.some((n: any) => !n.is_read && n.url === `/chat/${q.session_id}`) : false;

                  return (
                    <div 
                      key={q.id} 
                      className={`flex items-center gap-3.5 py-3.5 px-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors ${!isLast ? "border-b border-[var(--color-border-light)]" : ""}`}
                      onClick={() => openChat(q.id)}
                    >
                      <CompanyLogo company={company || null} size={48} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-body font-semibold truncate text-[var(--color-text)]">{jobTitle}</h4>
                          <span className="text-[11px] font-normal whitespace-nowrap ml-2" style={{ color: isUnread ? "var(--color-primary)" : "var(--color-text-tertiary)", fontWeight: isUnread ? 600 : 400 }}>
                            {formatWhatsAppTime(q.latest_activity_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className={`text-body-sm truncate flex-1 ${isUnread ? "text-[var(--color-text)] font-semibold" : "text-[var(--color-text-secondary)] font-normal"}`}>
                            {previewText}
                          </div>
                          {isUnread && (
                            <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                          )}
                          {!hasResponse && !q.latest_message_body && (
                            <span className="badge badge-neutral flex-shrink-0 text-[10px] scale-90">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  const q = item.data;
                  const hasResponse = q.status === "responded";
                  const rawTitle = q.asker_alias;
                  const { jobTitle, company } = parseAlias(rawTitle);
                  const previewText = q.latest_message_body ? (q.latest_message_sender === "responder" ? "You: " + q.latest_message_body : q.latest_message_body) : q.body;
                  const isUnread = (!hasResponse) || (q.session_id ? notifications.some((n: any) => !n.is_read && n.url === `/chat/${q.session_id}`) : false);

                  return (
                    <div 
                      key={q.target_id} 
                      className={`flex items-center gap-3.5 py-3.5 px-4 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors ${!isLast ? "border-b border-[var(--color-border-light)]" : ""}`}
                      onClick={() => hasResponse ? openChat(q.id) : respond(q.id, q.target_id)}
                    >
                      <CompanyLogo company={company || null} size={48} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-body font-semibold truncate text-[var(--color-text)]">{jobTitle}</h4>
                          <span className="text-[11px] font-normal whitespace-nowrap ml-2" style={{ color: isUnread && !hasResponse ? "var(--color-error)" : "var(--color-text-tertiary)", fontWeight: isUnread ? 600 : 400 }}>
                            {formatWhatsAppTime(q.latest_activity_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className={`text-body-sm truncate flex-1 ${isUnread && !hasResponse ? "text-[var(--color-text)] font-semibold" : "text-[var(--color-text-secondary)] font-normal"}`}>
                            {previewText}
                          </div>
                          {isUnread && !hasResponse && (
                            <span className="w-5 h-5 rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                          )}
                          {isUnread && hasResponse && (
                            <span className="w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
