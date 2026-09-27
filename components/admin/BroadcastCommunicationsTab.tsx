"use client";

import { useState } from "react";

export function BroadcastCommunicationsTab() {
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [loadingNudges, setLoadingNudges] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [broadcastPreview, setBroadcastPreview] = useState<{
    broadcastType: string;
    targetCount: number;
    messages: { userId: string; message: string }[];
  } | null>(null);

  async function handlePreviewBroadcast() {
    setPreviewing(true);
    setBroadcastPreview(null);
    try {
      const res = await fetch("/api/admin/broadcast?preview=true", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBroadcastPreview(data);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to preview broadcast");
    }
    setPreviewing(false);
  }

  async function handleRunBroadcast() {
    if (!confirm("Run the broadcast logic now? This will send actual push notifications.")) return;

    setLoadingBroadcast(true);
    try {
      const res = await fetch("/api/admin/broadcast", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Broadcast triggered successfully. Sent ${data.notificationsSent} notifications (${data.broadcastType}).`);
        setBroadcastPreview(null);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to run broadcast");
    }
    setLoadingBroadcast(false);
  }

  async function handleSendReminders() {
    if (!confirm("Send profile completion reminders to all users with incomplete profiles?")) return;

    setLoadingReminders(true);
    try {
      const res = await fetch("/api/admin/remind-profiles", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(`Reminders sent successfully to ${data.sent} users via in-app notification.`);

        if (data.emails && data.emails.length > 0) {
          const bccList = data.emails.join(",");
          const subject = encodeURIComponent("Complete your ProxNet Profile!");
          const body = encodeURIComponent(
            "Hi there,\n\nYou are missing out on local professional networking opportunities because your ProxNet profile is incomplete. Please complete your profile by adding your name, email, designation, and company name to unlock full access!\n\nBest,\nThe ProxNet Team"
          );
          const mailtoUrl = `mailto:?bcc=${bccList}&subject=${subject}&body=${body}`;
          window.location.href = mailtoUrl;
        }
      } else {
        alert("Failed to send reminders");
      }
    } catch (err) {
      alert("Failed to send reminders");
    } finally {
      setLoadingReminders(false);
    }
  }

  async function handleCandidateNudges() {
    setLoadingNudges(true);
    try {
      const res = await fetch("/api/admin/nudges", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`Candidate Nudges Complete! Sent ${data.totalNudgesSent || 0} strong match notifications.`);
      } else {
        alert(`Nudge error: ${data.error}`);
      }
    } catch (e) {
      alert("Failed to dispatch nudges");
    } finally {
      setLoadingNudges(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Card */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] p-5 rounded-2xl shadow-[var(--shadow-sm)]">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Communications & Nudge Center</h2>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Engage candidates and local peers with context-aware notifications, reminders, and broadcast announcements.
        </p>
      </div>

      {/* Grid of Communication Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* System Broadcast Card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-xl">📢</span>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">System-Wide Broadcast</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">Targeted in-app & push alerts across active users</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] p-3 rounded-xl mb-4">
              Evaluates user context to send customized community announcements or event updates without spamming inactive devices.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-3 border-t border-[var(--color-border-light)]">
            <button
              onClick={handlePreviewBroadcast}
              disabled={previewing}
              className="btn btn-secondary btn-sm text-xs flex-1"
            >
              {previewing ? "Previewing..." : "Preview Broadcast"}
            </button>
            <button
              onClick={handleRunBroadcast}
              disabled={loadingBroadcast}
              className="btn btn-primary btn-sm text-xs flex-1"
            >
              {loadingBroadcast ? "Sending..." : "Send Broadcast Now"}
            </button>
          </div>
        </div>

        {/* Candidate Match Nudges */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-xl">🔥</span>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">High-Match Candidate Nudges</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">Proactive job match alerts (&gt;= 75% fit)</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] p-3 rounded-xl mb-4">
              Scans recent job postings and uses AI vector similarity + LLM reranking to alert qualified candidates with referral links.
            </p>
          </div>

          <div className="pt-3 border-t border-[var(--color-border-light)]">
            <button
              onClick={handleCandidateNudges}
              disabled={loadingNudges}
              className="btn btn-primary btn-sm text-xs w-full"
            >
              {loadingNudges ? "Evaluating & Sending..." : "⚡ Dispatch High-Match Nudges"}
            </button>
          </div>
        </div>

        {/* Profile Completion Reminders */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border-light)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-xl">✍️</span>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Profile Completion Nudge</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">In-App Notification + BCC Mailto Draft</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] p-3 rounded-xl mb-4">
              Prompts users who have incomplete name, company, role, or contact info to finish onboarding and unlock matching.
            </p>
          </div>

          <div className="pt-3 border-t border-[var(--color-border-light)]">
            <button
              onClick={handleSendReminders}
              disabled={loadingReminders}
              className="btn btn-secondary btn-sm text-xs w-full"
            >
              {loadingReminders ? "Sending..." : "⚡ Send In-App & Email Reminders"}
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast Preview Drawer */}
      {broadcastPreview && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-primary-subtle)] rounded-2xl p-5 shadow-sm animate-fadeIn">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Broadcast Preview ({broadcastPreview.broadcastType})
            </h3>
            <span className="badge badge-primary text-xs font-semibold">
              {broadcastPreview.targetCount} recipient(s) targeted
            </span>
          </div>

          <div className="bg-[var(--color-bg)] rounded-xl p-4 border border-[var(--color-border-light)] max-h-56 overflow-y-auto mb-4 font-mono text-xs">
            {broadcastPreview.messages.length > 0 ? (
              <ul className="space-y-2.5">
                {broadcastPreview.messages.slice(0, 5).map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[var(--color-text-tertiary)] shrink-0">User {m.userId.substring(0, 6)}:</span>
                    <span className="text-[var(--color-text-secondary)]">{m.message}</span>
                  </li>
                ))}
                {broadcastPreview.messages.length > 5 && (
                  <li className="text-[var(--color-text-tertiary)] italic pt-1">
                    ...and {broadcastPreview.messages.length - 5} more users.
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-[var(--color-text-tertiary)]">No users matched the criteria for this broadcast.</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setBroadcastPreview(null)}
              className="btn btn-ghost btn-sm text-xs"
            >
              Dismiss
            </button>
            <button
              onClick={handleRunBroadcast}
              disabled={loadingBroadcast}
              className="btn btn-primary btn-sm text-xs"
            >
              {loadingBroadcast ? "Sending..." : "Confirm & Send to All Targets"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
