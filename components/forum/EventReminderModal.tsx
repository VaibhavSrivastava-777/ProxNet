"use client";

import { useState, useEffect } from "react";

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
  const [targetMode, setTargetMode] = useState<"rsvp" | "radius_2km">("rsvp");
  const [counts, setCounts] = useState<{ rsvpCount: number; radius2kmCount: number } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && event?.id) {
      setLoadingCounts(true);
      fetch(`/api/events/${event.id}/remind`)
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.rsvpCount === "number") {
            setCounts({ rsvpCount: data.rsvpCount, radius2kmCount: data.radius2kmCount });
          }
        })
        .catch(console.error)
        .finally(() => setLoadingCounts(false));
    }
  }, [isOpen, event?.id]);

  if (!isOpen || !event) return null;

  const initialRsvpCount = (event.rsvps || []).filter((r: any) => ["yes", "maybe"].includes(r.status)).length;
  const rsvpCount = counts?.rsvpCount ?? initialRsvpCount;
  const radius2kmCount = counts?.radius2kmCount ?? 0;
  const eventTitle = event.title || "Meetup";

  const handleSendReminder = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reminders.");
      } else {
        setSuccessMessage(data.message || `Reminders sent to ${data.sentCount} professional(s)!`);
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
          <div className="flex flex-col gap-4">
            {/* Target Audience Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Target Audience
              </label>

              <div 
                onClick={() => setTargetMode("rsvp")}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  targetMode === "rsvp"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/30 shadow-sm"
                    : "border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <input 
                  type="radio" 
                  name="targetMode" 
                  checked={targetMode === "rsvp"} 
                  onChange={() => setTargetMode("rsvp")}
                  className="mt-0.5"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-[var(--color-text)]">RSVP Attendees ({rsvpCount})</span>
                  <span className="text-[var(--color-text-secondary)]">Remind {rsvpCount} professionals who RSVP'd (Yes / Maybe)</span>
                </div>
              </div>

              <div 
                onClick={() => setTargetMode("radius_2km")}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  targetMode === "radius_2km"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/30 shadow-sm"
                    : "border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <input 
                  type="radio" 
                  name="targetMode" 
                  checked={targetMode === "radius_2km"} 
                  onChange={() => setTargetMode("radius_2km")}
                  className="mt-0.5"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-[var(--color-text)]">2 km Radius Network ({loadingCounts ? "..." : radius2kmCount})</span>
                  <span className="text-[var(--color-text-secondary)]">
                    Remind all {loadingCounts ? "..." : radius2kmCount} professionals within 2 km radius
                  </span>
                </div>
              </div>
            </div>

            {/* Prompt Statement */}
            <div className="p-3.5 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
              <p className="text-sm font-medium text-[var(--color-text)] leading-relaxed m-0">
                {targetMode === "radius_2km" ? (
                  <>
                    Remind all <span className="font-bold text-[var(--color-primary)]">{loadingCounts ? "..." : radius2kmCount}</span> professionals within 2 km radius for the ProxNet Meetup event <span className="font-bold text-[var(--color-text)]">"{eventTitle}"</span>
                  </>
                ) : (
                  <>
                    Remind <span className="font-bold text-[var(--color-primary)]">{rsvpCount}</span> professionals for the ProxNet Meetup event <span className="font-bold text-[var(--color-text)]">"{eventTitle}"</span>
                  </>
                )}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        {!successMessage && (
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border-light)]">
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
