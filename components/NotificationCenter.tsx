"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationMeta {
  category: "job" | "chat" | "event" | "forum" | "carpool" | "growth" | "system";
  label: string;
  badgeClass: string;
  iconBgClass: string;
  accentBorder: string;
  icon: string;
}

export function getNotificationMeta(title: string = "", body: string = "", url: string = ""): NotificationMeta {
  const t = (title + " " + body).toLowerCase();
  const u = (url || "").toLowerCase();

  // 1. Jobs & Referrals
  if (
    u.startsWith("/jobs") ||
    u.startsWith("/job-post") ||
    t.includes("job") ||
    t.includes("hiring") ||
    t.includes("job match") ||
    t.includes("strong match") ||
    t.includes("referral")
  ) {
    return {
      category: "job",
      label: (t.includes("job match") || t.includes("strong match")) ? "Job Match" : "Job & Referral",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
      iconBgClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      accentBorder: "border-l-emerald-500",
      icon: "💼",
    };
  }

  // 2. Real-time Chats & 1-on-1 Messages
  if (
    u.startsWith("/chat/") ||
    u.startsWith("/jobs/chat/") ||
    t.includes("new message") ||
    t.includes("identity revealed") ||
    t.includes("message from")
  ) {
    return {
      category: "chat",
      label: "Direct Chat",
      badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30",
      iconBgClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
      accentBorder: "border-l-sky-500",
      icon: "💬",
    };
  }

  // 3. Meetups & Events
  if (
    u.startsWith("/event/") ||
    u.startsWith("/events") ||
    t.includes("meetup") ||
    t.includes("event") ||
    t.includes("rsvp")
  ) {
    return {
      category: "event",
      label: "Meetup",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      iconBgClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      accentBorder: "border-l-amber-500",
      icon: "📅",
    };
  }

  // 4. Carpool
  if (
    u.startsWith("/carpool") ||
    t.includes("carpool") ||
    t.includes("ride")
  ) {
    return {
      category: "carpool",
      label: "Carpool",
      badgeClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30",
      iconBgClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
      accentBorder: "border-l-teal-500",
      icon: "🚗",
    };
  }

  // 5. Community & Forum Q&A
  if (
    u.startsWith("/qa") ||
    u.startsWith("/forum") ||
    t.includes("question") ||
    t.includes("forum") ||
    t.includes("neighborhood post") ||
    t.includes("post in") ||
    t.includes("replied") ||
    t.includes("commented")
  ) {
    return {
      category: "forum",
      label: "Community",
      badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30",
      iconBgClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
      accentBorder: "border-l-violet-500",
      icon: "❓",
    };
  }

  // 6. Network Growth, Followers & Points
  if (
    u.startsWith("/grow") ||
    u.startsWith("/profile") ||
    t.includes("follower") ||
    t.includes("points") ||
    t.includes("level up") ||
    t.includes("network")
  ) {
    return {
      category: "growth",
      label: "Growth",
      badgeClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30",
      iconBgClass: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
      accentBorder: "border-l-pink-500",
      icon: "🎉",
    };
  }

  // 7. System / AI Nudges / Defaults
  return {
    category: "system",
    label: "ProxNet",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30",
    iconBgClass: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    accentBorder: "border-l-slate-400",
    icon: "🔔",
  };
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

interface NotificationCenterProps {
  notifications: InAppNotification[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onNotificationClick: (id: string, url: string) => void;
  onMarkAllRead: () => void;
  session?: boolean;
}

export function NotificationCenter({
  notifications = [],
  isOpen,
  onToggle,
  onClose,
  onNotificationClick,
  onMarkAllRead,
  session = true,
}: NotificationCenterProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === "unread") return !n.is_read;
    return true;
  });

  // Handle click outside dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleItemClick = (n: InAppNotification) => {
    onNotificationClick(n.id, n.url);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        data-tour="notification-center-button"
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className={`relative btn-icon btn-ghost flex items-center justify-center transition-colors ${
          isOpen
            ? "text-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
        }`}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[var(--color-surface)] animate-pulse"
            style={{ lineHeight: 1 }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Popover / Dropdown */}
      {isOpen && (
        <div
          data-tour="notification-center-dropdown"
          className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 w-auto md:w-[410px] max-w-[calc(100vw-1.5rem)] bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] z-[1050] overflow-hidden animate-fadeInDown flex flex-col backdrop-blur-md"
          style={{ maxHeight: "min(560px, calc(100vh - 5rem))" }}
        >
          {!session ? (
            <div className="p-6 text-center flex flex-col items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-xl mb-3 text-[var(--color-primary)]">
                🔔
              </div>
              <h4 className="text-body font-bold text-[var(--color-text)] mb-1">
                Stay in the loop
              </h4>
              <p className="text-caption text-[var(--color-text-secondary)] max-w-[260px] mb-4">
                Sign in to view real-time alerts for local jobs, direct chats, and neighborhood meetups.
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem("auth_return_url", window.location.pathname + window.location.search);
                  } catch (e) {}
                  signIn("google");
                }}
                className="btn btn-primary text-xs py-2 px-5 rounded-lg shadow-sm font-semibold"
              >
                Sign In with Google
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between bg-[var(--color-surface)]">
            <div className="flex items-center gap-2">
              <h3 className="text-body font-bold text-[var(--color-text)] m-0 flex items-center gap-1.5">
                Notifications
                {unreadCount > 0 && (
                  <span className="text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-3 py-1.5 border-b border-[var(--color-border-light)] flex gap-1 bg-[var(--color-surface-hover)]/30">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border-none cursor-pointer ${
                filterTab === "all"
                  ? "bg-[var(--color-primary)] text-white shadow-xs"
                  : "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("unread")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border-none cursor-pointer ${
                filterTab === "unread"
                  ? "bg-[var(--color-primary)] text-white shadow-xs"
                  : "bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border-light)]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
                <div className="h-12 w-12 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-xl mb-3 text-[var(--color-primary)]">
                  ✓
                </div>
                <p className="text-body-sm font-semibold text-[var(--color-text)] mb-1">
                  {filterTab === "unread" ? "No unread notifications" : "All caught up!"}
                </p>
                <p className="text-xs max-w-[240px]">
                  {filterTab === "unread"
                    ? "You have reviewed all incoming alerts and messages."
                    : "When new opportunities, messages, or meetups occur, you'll see them here."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const meta = getNotificationMeta(notif.title, notif.body, notif.url);
                const relTime = formatRelativeTime(notif.created_at);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors relative hover:bg-[var(--color-surface-hover)] ${
                      !notif.is_read
                        ? "bg-[var(--color-primary-subtle)]/40 border-l-[3px] " + meta.accentBorder
                        : "border-l-[3px] border-l-transparent"
                    }`}
                  >
                    {/* Leading Icon */}
                    <div
                      className={`h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center text-base shadow-xs ${meta.iconBgClass}`}
                    >
                      <span>{meta.icon}</span>
                    </div>

                    {/* Content Block */}
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-tertiary)] whitespace-nowrap">
                          {relTime}
                        </span>
                      </div>

                      <h4
                        className={`text-xs md:text-[13px] leading-snug mb-1 truncate ${
                          !notif.is_read
                            ? "font-bold text-[var(--color-text)]"
                            : "font-medium text-[var(--color-text)]"
                        }`}
                        title={notif.title}
                      >
                        {notif.title}
                      </h4>

                      {notif.body && (
                        <p
                          className="text-[11px] md:text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed m-0"
                          title={notif.body}
                        >
                          {notif.body}
                        </p>
                      )}
                    </div>

                    {/* Unread indicator dot */}
                    {!notif.is_read && (
                      <div className="flex-shrink-0 self-center">
                        <span className="block h-2 w-2 rounded-full bg-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--color-border-light)] bg-[var(--color-surface)] flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
            <span>FCM Mobile Alerts active</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/profile");
              }}
              className="text-[var(--color-primary)] hover:underline bg-transparent border-none p-0 cursor-pointer font-medium"
            >
              Settings
            </button>
          </div>
        </>
      )}
    </div>
  )}
</div>
  );
}
