"use client";

import { useEffect, useState } from "react";
import type { MicroStatus } from "@/lib/types";

interface MicroStatusBeaconProps {
  currentUserId?: string;
  userProfile?: any;
  userLat?: number | null;
  userLng?: number | null;
  onJoinBeacon?: (beacon: MicroStatus) => void;
  onBeaconsChange?: (beacons: MicroStatus[]) => void;
}

export function MicroStatusBeacon({
  currentUserId,
  userProfile,
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
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchBeacons = async () => {
    try {
      // Broadcast beacons are strictly visible to the 2km neighborhood radius only
      const url = (userLat != null && userLng != null)
        ? `/api/micro-status?lat=${userLat}&lng=${userLng}&radius=2000`
        : `/api/micro-status?radius=2000`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list: MicroStatus[] = data.beacons || [];
        setBeacons(list);
        onBeaconsChange?.(list);
        if (data.my_beacon) {
          setMyBeacon(data.my_beacon);
        } else if (currentUserId) {
          const mine = list.find((b) => b.user_id === currentUserId);
          setMyBeacon(mine || null);
        } else {
          setMyBeacon(null);
        }
      }
    } catch (e) {
      console.error("Failed to load micro status beacons:", e);
    }
  };

  useEffect(() => {
    fetchBeacons();
    const interval = setInterval(fetchBeacons, 20000); // refresh every 20s
    const handleUpdate = () => fetchBeacons();
    window.addEventListener("proxnet_beacon_updated", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("proxnet_beacon_updated", handleUpdate);
    };
  }, [userLat, userLng, currentUserId]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (myBeacon) {
      alert("You already have an active broadcast in motion. Please stop your current broadcast before starting a new one.");
      return;
    }
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
        window.dispatchEvent(new CustomEvent("proxnet_beacon_updated"));
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

  const handleCloseBeacon = async () => {
    setClosing(true);
    try {
      const res = await fetch("/api/micro-status", { method: "DELETE" });
      if (res.ok) {
        setMyBeacon(null);
        setShowBroadcastModal(false);
        fetchBeacons();
        window.dispatchEvent(new CustomEvent("proxnet_beacon_updated"));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to stop broadcast");
      }
    } catch (err) {
      console.error("Failed to stop beacon:", err);
    } finally {
      setClosing(false);
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

  const getTimeTheme = (expiresAt: string, totalMins: number = 45) => {
    const rem = getRemainingMins(expiresAt);
    const pct = Math.max(0, Math.min(1, rem / Math.max(5, totalMins)));
    if (pct > 0.6) {
      return {
        border: "border-emerald-500/80 shadow-emerald-500/20",
        bg: "bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-[var(--color-surface)]",
        badge: "bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border-emerald-500/40",
        dot: "bg-emerald-500",
        ping: "bg-emerald-400",
        bar: "bg-emerald-500",
        pct,
      };
    }
    if (pct > 0.3) {
      return {
        border: "border-amber-500/80 shadow-amber-500/20",
        bg: "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-[var(--color-surface)]",
        badge: "bg-amber-500/25 text-amber-800 dark:text-amber-200 border-amber-500/40",
        dot: "bg-amber-500",
        ping: "bg-amber-400",
        bar: "bg-amber-500",
        pct,
      };
    }
    if (pct > 0.15) {
      return {
        border: "border-orange-500/85 shadow-orange-500/25",
        bg: "bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-[var(--color-surface)]",
        badge: "bg-orange-500/25 text-orange-800 dark:text-orange-200 border-orange-500/40",
        dot: "bg-orange-500",
        ping: "bg-orange-400",
        bar: "bg-orange-500",
        pct,
      };
    }
    return {
      border: "border-rose-500/90 shadow-rose-500/35 animate-pulse",
      bg: "bg-gradient-to-r from-rose-500/25 via-red-500/15 to-[var(--color-surface)]",
      badge: "bg-rose-500/30 text-rose-800 dark:text-rose-200 border-rose-500/50 animate-pulse",
      dot: "bg-rose-500",
      ping: "bg-rose-400",
      bar: "bg-rose-500",
      pct,
    };
  };

  const myTitle = myBeacon?.user?.job_title || userProfile?.job_title || "Professional";
  const myCompany = myBeacon?.user?.company || userProfile?.company || "Nearby Company";
  const myTheme = myBeacon ? getTimeTheme(myBeacon.expires_at, myBeacon.duration_mins || 45) : null;

  return (
    <>
      {/* Floating Beacon Action Bar */}
      <div className="flex flex-col gap-2">
        {/* Active Personal Beacon Banner with dynamic boundary color indicating reducing time */}
        {myBeacon && myTheme ? (
          <div className={`relative overflow-hidden flex flex-col gap-2 p-3.5 sm:p-4 rounded-2xl ${myTheme.bg} border-2 ${myTheme.border} text-[var(--color-text)] shadow-lg backdrop-blur-md transition-all duration-700 animate-fadeIn`}>
            {/* Top time-reduction depletion bar */}
            <div className="w-full h-1 bg-[var(--color-border)]/30 rounded-full overflow-hidden -mt-1 mb-1">
              <div
                className={`h-full ${myTheme.bar} transition-all duration-1000 ease-linear`}
                style={{ width: `${Math.round(myTheme.pct * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="relative flex h-3.5 w-3.5 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${myTheme.ping} opacity-80`} />
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${myTheme.dot} shadow-sm`} />
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="text-xs font-extrabold flex items-center gap-1.5 flex-wrap">
                    <span className="text-base">{activityMeta[myBeacon.activity]?.icon}</span>
                    <span>
                      Your {activityMeta[myBeacon.activity]?.label} broadcast is live
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${myTheme.badge} shrink-0`}>
                      ⏳ {getRemainingMins(myBeacon.expires_at)}m remaining
                    </span>
                  </div>
                  
                  {/* Designation @ Company Display */}
                  <div className="text-xs font-semibold text-[var(--color-text)] mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Broadcasting as
                    </span>
                    <span className="font-extrabold text-[var(--color-text)]">
                      {myTitle} @ {myCompany}
                    </span>
                  </div>

                  {myBeacon.note && (
                    <div className="text-[11px] text-[var(--color-text-secondary)] italic truncate max-w-[320px] mt-0.5 flex items-center gap-1 font-medium">
                      <span>📍</span> &quot;{myBeacon.note}&quot;
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseBeacon}
                  disabled={closing}
                  className="btn btn-sm bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/30 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shrink-0 shadow-xs hover:scale-105"
                  title="Stop and end this broadcast anytime"
                >
                  {closing ? (
                    <>
                      <span className="spinner-sm" /> Stopping...
                    </>
                  ) : (
                    <>
                      <span>🛑</span>
                      <span>Stop Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-[var(--color-surface)] to-amber-500/10 hover:from-amber-500/20 hover:to-amber-500/20 border border-amber-500/30 shadow-sm text-xs font-bold text-[var(--color-text)] cursor-pointer transition-all hover:scale-[1.01]"
          >
            <span className="text-base">☕</span>
            <span>Down for Chai / Walk? (Set Broadcast Beacon)</span>
          </button>
        )}

        {/* Live Neighbor Broadcast Alert when viewer does not have active broadcast */}
        {!myBeacon && beacons.length > 0 && (
          <div className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-transparent border border-amber-500/30 text-xs shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="font-bold text-[var(--color-text)] truncate">
                ⚡ {beacons.length} neighbor{beacons.length > 1 ? "s" : ""} broadcasting live nearby
              </span>
            </div>
            <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 shrink-0">
              Pinned on Network list &darr;
            </span>
          </div>
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
                <span>📡</span> Neighborhood Broadcast Beacon
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex items-center justify-center border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {myBeacon ? (
              /* Already active broadcast block */
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-[var(--color-text)] flex flex-col gap-3 my-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 text-sm">
                  <span>⚠️</span> Broadcast Already in Motion
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] m-0 leading-relaxed">
                  You already have an active <strong>{activityMeta[myBeacon.activity]?.label}</strong> broadcast running.
                  Opening another broadcast when one is still in motion is not allowed.
                </p>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  Broadcasting as: {myTitle} @ {myCompany}
                </div>
                <button
                  type="button"
                  onClick={handleCloseBeacon}
                  disabled={closing}
                  className="btn btn-sm bg-red-500 hover:bg-red-600 text-white font-bold text-xs py-2 rounded-xl border-0 shadow-sm cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {closing ? <span className="spinner-sm" /> : <span>🛑</span>}
                  <span>Stop Current Broadcast First</span>
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-[var(--color-text-secondary)] m-0 mb-3 leading-relaxed">
                  Broadcast your presence to neighbors within 1-2 km. Your card will appear at the top of their network tab with your <strong>designation @ company</strong>!
                </p>

                {/* Profile Preview */}
                <div className="p-3 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] mb-3 flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <span className="text-[var(--color-text-secondary)]">Visible to neighbors as:</span>
                    <strong className="text-[var(--color-text)] truncate">{myTitle} @ {myCompany}</strong>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-tertiary)] italic pl-6">
                    (Your real name is completely anonymous and will never be shown on broadcasts)
                  </span>
                </div>

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
                    <div className="flex gap-2 mb-2">
                      {[30, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setDurationMins(mins);
                            setIsCustomDuration(false);
                          }}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                            !isCustomDuration && durationMins === mins
                              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] font-bold shadow-xs"
                              : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsCustomDuration(true)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all flex items-center justify-center gap-1 ${
                          isCustomDuration
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] font-bold shadow-xs"
                            : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                        }`}
                      >
                        <span>⏱️</span>
                        <span>Custom</span>
                      </button>
                    </div>

                    {isCustomDuration && (
                      <div className="p-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-primary)]/40 flex flex-col gap-2 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={180}
                            value={durationMins}
                            onChange={(e) => setDurationMins(Math.min(180, Math.max(5, Number(e.target.value) || 5)))}
                            className="input text-xs font-bold w-24 py-1 px-2.5"
                          />
                          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">minutes (5 - 180 mins)</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">Quick picks:</span>
                          {[15, 20, 90, 120].map((quickMins) => (
                            <button
                              key={quickMins}
                              type="button"
                              onClick={() => setDurationMins(quickMins)}
                              className={`text-[11px] px-2 py-0.5 rounded-md border cursor-pointer font-medium ${
                                durationMins === quickMins
                                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                                  : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                              }`}
                            >
                              {quickMins}m
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={broadcasting || !!myBeacon}
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
