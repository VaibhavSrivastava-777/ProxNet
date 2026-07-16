"use client";

import { useState } from "react";

interface InviteShareSheetProps {
  inviteCode: string;
  onClose: () => void;
}

export function InviteShareSheet({ inviteCode, onClose }: InviteShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

  const trackShare = async (channel: string) => {
    try {
      await fetch("/api/invite/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
    } catch (e) {
      console.error("Failed to track invite share event", e);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    trackShare("copy");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareData = {
    title: "ProxNet Local Network",
    text: "I connect with professionals in our apartment complex on ProxNet. We share carpools, job referrals, and local tips anonymously. Join our local network!",
    url: inviteUrl,
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        trackShare("native");
      } catch (err) {
        console.log("Error sharing", err);
      }
    } else {
      handleCopyLink();
    }
  };

  const getWhatsAppLink = () => {
    const text = `Hey! I use ProxNet to connect with professionals in our apartment complex — carpools, job referrals, and local recommendations. It's anonymous and free. Join here: ${inviteUrl}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const getLinkedInLink = () => {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`;
  };

  const getSMSLink = () => {
    const text = `I connect with professionals in our apartment complex on ProxNet — carpools, referrals, and local tips. It's anonymous and free. Join: ${inviteUrl}`;
    return `sms:?body=${encodeURIComponent(text)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl border border-[var(--color-border)] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "var(--color-text)" }}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-h3 m-0">Share Invite Link</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] bg-transparent border-0 cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleNativeShare}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            System Share Sheet
          </button>

          <hr style={{ border: 0, borderTop: "1px solid var(--color-border-light)", margin: "8px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <a
              href={getWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackShare("whatsapp")}
              className="card flex flex-col items-center justify-center p-3 text-decoration-none hover:bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: "var(--radius-md)", color: "var(--color-text)", textAlign: "center", textDecoration: "none" }}
            >
              <span style={{ fontSize: 24, marginBottom: 4 }}>💬</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>WhatsApp</span>
            </a>

            <a
              href={getLinkedInLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackShare("linkedin")}
              className="card flex flex-col items-center justify-center p-3 text-decoration-none hover:bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: "var(--radius-md)", color: "var(--color-text)", textAlign: "center", textDecoration: "none" }}
            >
              <span style={{ fontSize: 24, marginBottom: 4 }}>💼</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>LinkedIn</span>
            </a>

            <a
              href={getSMSLink()}
              onClick={() => trackShare("sms")}
              className="card flex flex-col items-center justify-center p-3 text-decoration-none hover:bg-[var(--color-surface-secondary)]"
              style={{ borderRadius: "var(--radius-md)", color: "var(--color-text)", textAlign: "center", textDecoration: "none" }}
            >
              <span style={{ fontSize: 24, marginBottom: 4 }}>📱</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>SMS</span>
            </a>
          </div>

          <div
            className="flex items-center gap-2 p-2 mt-2"
            style={{
              background: "var(--color-surface-secondary)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-light)",
            }}
          >
            <input
              type="text"
              readOnly
              value={inviteUrl}
              style={{
                background: "transparent",
                border: "none",
                flex: 1,
                fontSize: 13,
                outline: "none",
                color: "var(--color-text-secondary)",
                paddingLeft: 8,
              }}
            />
            <button
              onClick={handleCopyLink}
              className="btn btn-sm btn-primary"
              style={{ fontSize: 12, whiteSpace: "nowrap" }}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
