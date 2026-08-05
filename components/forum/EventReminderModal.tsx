"use client";

import { useState } from "react";

interface EventReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  onSuccess?: () => void;
}

export function EventReminderModal({
  isOpen,
  onClose,
  event,
  onSuccess,
}: EventReminderModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !event) return null;

  const rsvps = event.rsvps || [];
  const targetCount = rsvps.filter((r: any) => ["yes", "maybe"].includes(r.status)).length;
  const eventTitle = event.title || "Meetup";

  const handleSendReminder = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reminders.");
      } else {
        setSuccessMessage(data.message || `Reminder sent to ${data.sentCount} professional(s)!`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl max-w-md w-full p-6 flex flex-col gap-4 text-[var(--color-text)] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <h3 className="text-lg font-bold m-0">Send Real-time Reminder</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] font-bold text-lg p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        {successMessage ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold text-center py-6">
            ✓ {successMessage}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-[var(--color-text)] leading-relaxed m-0">
              Reminder <span className="font-bold text-[var(--color-primary)]">{targetCount}</span> professionals for the ProxNet Meetup event <span className="font-bold text-[var(--color-text)]">"{eventTitle}"</span>
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] m-0">
              This will send an instant push notification, in-app notification, and email to everyone who RSVP'd "Yes" or "Maybe".
            </p>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        {!successMessage && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendReminder}
              disabled={isSending}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <span>Yes</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
