"use client";

import { useState, useEffect } from "react";
import { User } from "@/lib/types";

interface CarpoolFormProps {
  user: User;
  onPostCreated: () => void;
  onCancel: () => void;
  initialData?: any;
  isAdmin?: boolean;
  onSubmitOverride?: (data: any) => Promise<void>;
}

export function CarpoolForm({ user, onPostCreated, onCancel, initialData, isAdmin, onSubmitOverride }: CarpoolFormProps) {
  const [type, setType] = useState<"giver" | "seeker">(initialData?.type || "seeker");
  const [direction, setDirection] = useState<"home_to_office" | "office_to_home">("home_to_office");
  
  // Set default time to next hour
  const [time, setTime] = useState(() => {
    if (initialData?.time_start) return initialData.time_start.slice(0, 5);
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startName = direction === "home_to_office" ? (user.home_name || "Home") : (user.office_name || "Office");
  const destName = direction === "home_to_office" ? (user.office_name || "Office") : (user.home_name || "Home");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user.home_lat || !user.home_lng || !user.office_lat || !user.office_lng) {
      setError("Please update your Home and Office locations in your profile first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [h, m] = time.split(':').map(Number);
      const endD = new Date();
      endD.setHours(h, m + 30, 0);
      const timeEnd = `${endD.getHours().toString().padStart(2, '0')}:${endD.getMinutes().toString().padStart(2, '0')}`;

      const start_lat = direction === "home_to_office" ? user.home_lat : user.office_lat;
      const start_lng = direction === "home_to_office" ? user.home_lng : user.office_lng;
      const dest_lat = direction === "home_to_office" ? user.office_lat : user.home_lat;
      const dest_lng = direction === "home_to_office" ? user.office_lng : user.home_lng;

      const payload = {
        type,
        start_name: startName,
        start_lat,
        start_lng,
        dest_name: destName,
        dest_lat,
        dest_lng,
        date: new Date().toISOString().split('T')[0],
        is_recurring: false,
        recurring_days: null,
        time_start: time,
        time_end: timeEnd,
        seats: type === "giver" ? 3 : 1,
        status: "active",
      };

      if (onSubmitOverride) {
        await onSubmitOverride(payload);
        return;
      }

      const res = await fetch("/api/carpool/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create post");
      
      onPostCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-xl mx-auto p-0 animate-scaleIn overflow-hidden border border-[var(--color-border-light)] shadow-lg relative">
      {/* Header */}
      <div className="bg-[var(--color-surface-secondary)] p-4 flex justify-between items-center border-b border-[var(--color-border-light)]">
        <h2 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" />
          </svg>
          Quick Shout
        </h2>
        <button onClick={onCancel} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-5 md:p-6 bg-[var(--color-surface)] space-y-6">
        {error && (
          <div className="p-3 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Bubble Preview */}
        <div className="flex gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className={`p-4 rounded-2xl rounded-tl-sm text-sm border shadow-sm ${type === "giver" ? "bg-accent/5 border-accent/20" : "bg-primary/5 border-primary/20"}`}>
            <span className="font-semibold text-[var(--color-text)]">{user.full_name?.split(" ")[0]}</span> is <strong>{type === "giver" ? "driving" : "seeking a ride"}</strong> from <span className="font-medium text-[var(--color-text)]">{startName}</span> to <span className="font-medium text-[var(--color-text)]">{destName}</span> around <span className="font-medium text-[var(--color-text)]">{time}</span> today.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">I am</span>
              <div className="flex bg-[var(--color-surface-secondary)] p-1 rounded-lg">
                <button type="button" onClick={() => setType("seeker")} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${type === "seeker" ? "bg-[var(--color-surface)] shadow-sm text-primary" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>Need Ride</button>
                <button type="button" onClick={() => setType("giver")} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${type === "giver" ? "bg-[var(--color-surface)] shadow-sm text-accent" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>Driving</button>
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Route</span>
              <div className="flex bg-[var(--color-surface-secondary)] p-1 rounded-lg">
                <button type="button" onClick={() => setDirection("home_to_office")} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${direction === "home_to_office" ? "bg-[var(--color-surface)] shadow-sm text-[var(--color-text)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>To Office</button>
                <button type="button" onClick={() => setDirection("office_to_home")} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${direction === "office_to_home" ? "bg-[var(--color-surface)] shadow-sm text-[var(--color-text)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>To Home</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Time</span>
            <input 
              type="time" 
              className="input w-full md:w-auto" 
              value={time}
              onChange={e => setTime(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`btn w-full btn-lg ${type === "giver" ? "btn-accent" : "btn-primary"} disabled:opacity-50 mt-4`}
          >
            {loading ? "Posting..." : "Shout to Group"}
          </button>
        </form>
      </div>
    </div>
  );
}
