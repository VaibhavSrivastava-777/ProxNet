"use client";

import { useState, useEffect, useCallback } from "react";

/* ----------------------------------------------------------------
   Push Notification Modal — Contextual Soft-Ask
   Triggers: "post-login" | "chat" | "first-post"
   ---------------------------------------------------------------- */

type PushTrigger = "post-login" | "chat" | "first-post";

interface PushNotificationModalProps {
  trigger: PushTrigger;
  onSubscribe: () => Promise<void>;
  onDismiss: () => void;
}

const TRIGGER_CONTENT: Record<
  PushTrigger,
  { emoji: string; title: string; subtitle: string; cta: string }
> = {
  "post-login": {
    emoji: "🔔",
    title: "Stay in the loop",
    subtitle:
      "Get notified instantly when nearby professionals answer your questions, reply in chat, or share job referrals.",
    cta: "Enable Notifications",
  },
  chat: {
    emoji: "💬",
    title: "Don't miss replies",
    subtitle:
      "Enable notifications so you're alerted the moment they respond — even when the app is in the background.",
    cta: "Enable for Chats",
  },
  "first-post": {
    emoji: "🎉",
    title: "Great post! Want to know when neighbors respond?",
    subtitle:
      "Turn on notifications to get pinged when someone replies to your post, asks you a question, or shares a referral.",
    cta: "Enable Notifications",
  },
};

/* Cooldown helpers per trigger type */
function shouldShowForTrigger(trigger: PushTrigger): boolean {
  if (typeof window === "undefined") return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;

  switch (trigger) {
    case "post-login": {
      // Once per session
      return sessionStorage.getItem("push_modal_dismissed_post_login") !== "true";
    }
    case "chat": {
      // 24h cooldown
      const dismissedAt = localStorage.getItem("push_modal_dismissed_chat");
      if (!dismissedAt) return true;
      const ts = parseInt(dismissedAt, 10);
      return isNaN(ts) || Date.now() - ts > 24 * 60 * 60 * 1000;
    }
    case "first-post": {
      // One-time only
      return localStorage.getItem("push_modal_dismissed_first_post") !== "true";
    }
  }
}

function markDismissed(trigger: PushTrigger) {
  switch (trigger) {
    case "post-login":
      sessionStorage.setItem("push_modal_dismissed_post_login", "true");
      break;
    case "chat":
      localStorage.setItem("push_modal_dismissed_chat", String(Date.now()));
      break;
    case "first-post":
      localStorage.setItem("push_modal_dismissed_first_post", "true");
      break;
  }
}

export function PushNotificationModal({
  trigger,
  onSubscribe,
  onDismiss,
}: PushNotificationModalProps) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Small delay for a natural entrance after the triggering action
    const timer = setTimeout(() => {
      if (shouldShowForTrigger(trigger)) {
        setVisible(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trigger]);

  const handleDismiss = useCallback(() => {
    markDismissed(trigger);
    setVisible(false);
    onDismiss();
  }, [trigger, onDismiss]);

  const handleSubscribe = useCallback(async () => {
    setSubscribing(true);
    try {
      await onSubscribe();
      markDismissed(trigger);
      setVisible(false);
    } catch {
      // Permission denied or failed — dismiss anyway
      markDismissed(trigger);
      setVisible(false);
    } finally {
      setSubscribing(false);
    }
  }, [trigger, onSubscribe]);

  if (!visible) return null;

  const content = TRIGGER_CONTENT[trigger];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fadeIn"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="animate-scaleIn"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-xl, 20px)",
          maxWidth: 400,
          width: "100%",
          padding: "32px 28px 24px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            borderRadius: "20px 20px 0 0",
          }}
        />

        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-secondary)",
            padding: 4,
          }}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 28,
            boxShadow: "0 8px 24px rgba(10, 102, 194, 0.25)",
          }}
        >
          {content.emoji}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--color-text)",
            textAlign: "center",
            margin: "0 0 8px",
            lineHeight: 1.3,
          }}
        >
          {content.title}
        </h3>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            textAlign: "center",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
          {content.subtitle}
        </p>

        {/* Feature chips */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {["💬 Chat replies", "🤝 Job referrals", "📍 Local updates"].map((chip) => (
            <span
              key={chip}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 999,
                background: "var(--color-surface-secondary)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border-light)",
              }}
            >
              {chip}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={subscribing}
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {subscribing ? (
              <>
                <span
                  className="spinner spinner-sm"
                  style={{ borderTopColor: "var(--color-text-inverse)" }}
                />
                Enabling…
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405C18.21 14.79 18 13.42 18 12V8a6 6 0 10-12 0v4c0 1.42-.21 2.79-.595 3.595L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </svg>
                {content.cta}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="btn btn-ghost"
            style={{
              width: "100%",
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              color: "var(--color-text-secondary)",
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
