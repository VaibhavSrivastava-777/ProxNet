"use client";

import { useState } from "react";

export function AdminActions() {
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  const [loadingReminders, setLoadingReminders] = useState(false);
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
        setBroadcastPreview(null); // Clear preview after sending
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
          const body = encodeURIComponent("Hi there,\n\nYou are missing out on local professional networking opportunities because your ProxNet profile is incomplete. Please complete your profile by adding your name, email, designation, and company name to unlock full access!\n\nBest,\nThe ProxNet Team");
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

  return (
    <div className="card mb-6" style={{ padding: "24px" }}>
      <h2 className="text-h3 mb-4">Quick Actions</h2>
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={handlePreviewBroadcast}
          disabled={previewing}
          className="btn btn-secondary"
        >
          {previewing ? "Previewing..." : "Preview Broadcast"}
        </button>
        <button
          onClick={handleSendReminders}
          disabled={loadingReminders}
          className="btn btn-secondary"
        >
          {loadingReminders ? "Sending..." : "Send Profile Completion Reminders"}
        </button>
      </div>

      {/* Broadcast Preview Section */}
      {broadcastPreview && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-primary-subtle)] rounded-xl p-5 shadow-sm mt-6 animate-fadeIn">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-[var(--color-text-primary)]">Broadcast Preview ({broadcastPreview.broadcastType})</h3>
            <span className="badge badge-primary">{broadcastPreview.targetCount} target(s)</span>
          </div>
          
          <div className="bg-[var(--color-background)] rounded-lg p-4 border border-[var(--color-border-light)] max-h-64 overflow-y-auto mb-4">
            {broadcastPreview.messages.length > 0 ? (
              <ul className="space-y-3">
                {broadcastPreview.messages.slice(0, 5).map((m, idx) => (
                  <li key={idx} className="text-sm">
                    <span className="font-mono text-xs text-[var(--color-text-tertiary)] mr-2">User {m.userId.substring(0,6)}:</span>
                    <span className="text-[var(--color-text-secondary)]">{m.message}</span>
                  </li>
                ))}
                {broadcastPreview.messages.length > 5 && (
                  <li className="text-xs text-[var(--color-text-tertiary)] italic pt-2">...and {broadcastPreview.messages.length - 5} more.</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">No users matched for broadcast.</p>
            )}
          </div>

          <div className="flex justify-end">
             <button
                onClick={handleRunBroadcast}
                disabled={loadingBroadcast}
                className="btn btn-primary"
              >
                {loadingBroadcast ? "Sending..." : "Send Broadcast Now"}
              </button>
          </div>
        </div>
      )}
    </div>
  );
}
