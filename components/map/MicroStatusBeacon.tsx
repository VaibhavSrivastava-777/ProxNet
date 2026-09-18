"use client";

import { useEffect, useState } from "react";
import type { MicroStatus } from "@/lib/types";

interface MicroStatusBeaconProps {
  currentUserId?: string;
  userLat?: number | null;
  userLng?: number | null;
  onJoinBeacon?: (beacon: MicroStatus) => void;
  onBeaconsChange?: (beacons: MicroStatus[]) => void;
}

export function MicroStatusBeacon({
  currentUserId,
  userLat,
  userLng,
  onJoinBeacon,
  onBeaconsChange,
}: MicroStatusBeaconProps) {
  const [beacons, setBeacons] = useState<MicroStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [myBeacon, setMyBeacon] = useState<MicroStatus | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<"chai" | "walk" | "sports" | "quick_chat">("chai");
  const [note, setNote] = useState("");
  const [durationMins, setDurationMins] = useState(45);
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchBeacons = async () => {
    if (userLat == null || userLng == null) return;
    try {
      const res = await fetch(`/api/micro-status?lat=${userLat}&lng=${userLng}&radius=3000`);
      if (res.ok) {
        const data = await res.json();
        const list: MicroStatus[] = data.beacons || [];
        setBeacons(list);
        onBeaconsChange?.(list);
        if (currentUserId) {
          const mine = list.find((b) => b.user_id === currentUserId);
          setMyBeacon(mine || null);
        }
      }
    } catch (e) {
      console.error("Failed to load micro status beacons:", e);
    }
  };

  useEffect(() => {
    fetchBeacons();
    const interval = setInterval(fetchBeacons, 20000); // refresh every 20s
    return () => clearInterval(interval);
  }, [userLat, userLng, currentUserId]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userLat == null || userLng == null) {
      alert("Location is required to broadcast a beacon. Please set your home location.");
      return;
    }
    setBroadcasting(true);
    try {
      const res = await fetch("/api/micro-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: selectedActivity,
          note: note.trim() || undefined,
          duration_mins: durationMins,
          lat: userLat,
          lng: userLng,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMyBeacon(data.beacon);
        setShowBroadcastModal(false);
        setNote("");
        fetchBeacons();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to broadcast beacon");
      }
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleCancelBeacon = async () => {
    try {
      await fetch("/api/micro-status", { method: "DELETE" });
      setMyBeacon(null);
      fetchBeacons();
    } catch (err) {
      console.error("Failed to cancel beacon:", err);
    }
  };

  const activityMeta: Record<string, { icon: string; label: string }> = {
    chai: { icon: "☕", label: "15-min Chai" },
    walk: { icon: "🚶", label: "Walk & Talk" },
    sports: { icon: "🏸", label: "Badminton / Sports" },
    quick_chat: { icon: "💬", label: "Quick Catch-up" },
  };

  const getRemainingMins = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(1, Math.round(diff / 60000));
  };

  return (
    <>
      {/* Floating Beacon Action Bar */}
      <div className="flex flex-col gap-2">
        {/* Active Personal Beacon Banner */}
        {myBeacon ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-[var(--color-text)] shadow-md backdrop-blur-md animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap">
                  <span>{activityMeta[myBeacon.activity]?.icon}</span>
                  <span>Your {activityMeta[myBeacon.activity]?.label} beacon is live</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse">
                    ⏳ {getRemainingMins(myBeacon.expires_at)}m left
                  </span>
                </div>
                {myBeacon.note && (
                  <div className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[240px] mt-0.5">
                    &quot;{myBeacon.note}&quot;
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelBeacon}
              className="text-[11px] font-semibold text-red-500 hover:text-red-600 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 cursor-pointer transition-colors"
            >
              Cancel ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-secondary)] border border-[var(--color-border)] shadow-sm text-xs font-semibold text-[var(--color-text)] cursor-pointer transition-all hover:border-amber-500/50"
          >
            <span>☕</span>
            <span>Down for Chai? (Set Beacon)</span>
          </button>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowBroadcastModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[var(--color-text)] m-0 flex items-center gap-2">
                <span>📡</span> Neighborhood Beacon
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex items-center justify-center border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] m-0 mb-4 leading-relaxed">
              Broadcast a 15-minute icebreaker beacon to neighbors within 1-2 km. Great for spontaneous coffee breaks, walks, or sports!
            </p>

            <form onSubmit={handleBroadcast} className="flex flex-col gap-4">
              {/* Activity Selection */}
              <div>
                <label className="label text-xs font-semibold mb-1.5 block">Activity</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "chai", label: "15-min Chai", icon: "☕" },
                    { id: "walk", label: "Walk & Talk", icon: "🚶" },
                    { id: "sports", label: "Badminton", icon: "🏸" },
                    { id: "quick_chat", label: "Quick Catch-up", icon: "💬" },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setSelectedActivity(act.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        selectedActivity === act.id
                          ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <span>{act.icon}</span>
                      <span>{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Note */}
              <div>
                <label className="label text-xs font-semibold mb-1 block">
                  Location Hint / Note (Optional)
                </label>
                <input
                  className="input w-full text-xs"
                  placeholder="e.g. Near Third Wave Coffee / Clubhouse"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={60}
                />
              </div>

              {/* Duration Selector */}
              <div>
                <label className="label text-xs font-semibold mb-1 block">Active Duration</label>
                <div className="flex gap-2">
                  {[30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMins(mins)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                        durationMins === mins
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                          : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={broadcasting}
                className="btn btn-primary w-full py-2.5 rounded-xl font-semibold text-xs mt-2 shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {broadcasting ? (
                  <>
                    <span className="spinner spinner-sm" /> Broadcasting...
                  </>
                ) : (
                  <>
                    <span>📡</span> Broadcast Local Beacon
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
