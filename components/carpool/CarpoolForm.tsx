"use client";

import { useState, useEffect } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { User } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geo/get-current-position";

interface CarpoolFormProps {
  user: User;
  onPostCreated: () => void;
  initialData?: any;
}

export function CarpoolForm({ user, onPostCreated, initialData }: CarpoolFormProps) {
  const [type, setType] = useState<"giver" | "seeker">(initialData?.type || "seeker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Default source to Home location if it exists, or initialData if provided
  const [startName, setStartName] = useState(initialData?.start_name || user.home_name || "");
  const [startLat, setStartLat] = useState(initialData?.start_lat?.toString() || user.home_lat?.toString() || "");
  const [startLng, setStartLng] = useState(initialData?.start_lng?.toString() || user.home_lng?.toString() || "");
  
  const [destName, setDestName] = useState(initialData?.dest_name || user.office_name || "");
  const [destLat, setDestLat] = useState(initialData?.dest_lat?.toString() || user.office_lat?.toString() || "");
  const [destLng, setDestLng] = useState(initialData?.dest_lng?.toString() || user.office_lng?.toString() || "");
  
  useEffect(() => {
    if (!initialData && !startLat) {
      getCurrentPosition()
        .then((pos) => {
          setStartLat(pos.lat.toString());
          setStartLng(pos.lng.toString());
          // If no office location is set, also set destination to current position
          if (!destLat) {
            setDestLat(pos.lat.toString());
            setDestLng(pos.lng.toString());
          }
        })
        .catch(() => {
          // ignore error, just don't set default
        });
    }
  }, [initialData, startLat, destLat]);

  const [date, setDate] = useState(initialData?.date || "");
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [recurringDays, setRecurringDays] = useState<number[]>(initialData?.recurring_days || [1, 2, 3, 4, 5]); // Default Mon-Fri
  const [timeStart, setTimeStart] = useState(initialData?.time_start?.slice(0,5) || "");
  const [timeEnd, setTimeEnd] = useState(initialData?.time_end?.slice(0,5) || "");
  const [seatsStr, setSeatsStr] = useState(initialData?.seats?.toString() || "1");

  const toggleDay = (dayIndex: number) => {
    if (recurringDays.includes(dayIndex)) {
      setRecurringDays(recurringDays.filter(d => d !== dayIndex));
    } else {
      setRecurringDays([...recurringDays, dayIndex].sort());
    }
  };

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/carpool/post", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel route");
      }
      onPostCreated(); // trigger a refresh and return to feed
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startLat || !startLng || !destLat || !destLng || !timeStart || !timeEnd) {
      setError("Please fill all location and time fields.");
      return;
    }
    if (!isRecurring && !date) {
      setError("Please select a date for your one-time trip.");
      return;
    }
    if (isRecurring && recurringDays.length === 0) {
      setError("Please select at least one day for your recurring commute.");
      return;
    }

    // Distance check
    const { haversineDistanceMeters } = await import("@/lib/geo/haversine");
    const dist = haversineDistanceMeters(parseFloat(startLat), parseFloat(startLng), parseFloat(destLat), parseFloat(destLng));
    if (dist < 500) {
      const confirm = window.confirm("Your source and destination are very close to each other. Are you sure you want to proceed?");
      if (!confirm) return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/carpool/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          start_name: startName,
          start_lat: parseFloat(startLat),
          start_lng: parseFloat(startLng),
          dest_name: destName,
          dest_lat: parseFloat(destLat),
          dest_lng: parseFloat(destLng),
          date: isRecurring ? null : date,
          is_recurring: isRecurring,
          recurring_days: isRecurring ? recurringDays : null,
          time_start: timeStart,
          time_end: timeEnd,
          seats: parseInt(seatsStr, 10),
        }),
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
    <div className="card max-w-2xl mx-auto p-6 md:p-8 animate-scaleIn">
      <h2 className="text-h2 mb-4">
        {initialData ? "Edit Carpool Route" : "Create a Carpool Route"}
      </h2>
      <p className="text-body-sm text-[var(--color-text-secondary)] mb-8">
        Set up your route to {type === "giver" ? "offer" : "request"} rides.
      </p>
      
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setType("seeker")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
            type === "seeker" 
              ? "bg-[var(--color-primary)] text-white shadow-md" 
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
          }`}
        >
          Seeker (Need a ride)
        </button>
        <button
          type="button"
          onClick={() => setType("giver")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
            type === "giver" 
              ? "bg-[var(--color-accent)] text-white shadow-md" 
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
          }`}
        >
          Giver (Offering a ride)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2 p-4 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border-light)]">
            <label className="flex flex-col gap-1">
              <span className="label">Source Name</span>
              <input 
                type="text" 
                className="input" 
                value={startName} 
                onChange={e => setStartName(e.target.value)} 
                placeholder="e.g. L&T South City" 
                required 
              />
            </label>
            <LocationPicker
              legend="Source Map Pin"
              lat={startLat}
              lng={startLng}
              onChange={(lat, lng) => {
                setStartLat(lat);
                setStartLng(lng);
              }}
            />
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <button
              type="button"
              onClick={() => {
                const tempName = startName;
                const tempLat = startLat;
                const tempLng = startLng;
                setStartName(destName);
                setStartLat(destLat);
                setStartLng(destLng);
                setDestName(tempName);
                setDestLat(tempLat);
                setDestLng(tempLng);
              }}
              className="btn btn-secondary rounded-full w-10 h-10 p-0 flex items-center justify-center shadow-md bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] hover:text-primary transition-all group"
              title="Swap Locations"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:rotate-180 transition-transform duration-300">
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <div className="space-y-2 p-4 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border-light)]">
            <label className="flex flex-col gap-1">
              <span className="label">Destination Name</span>
              <input 
                type="text" 
                className="input" 
                value={destName} 
                onChange={e => setDestName(e.target.value)} 
                placeholder="e.g. Manyata Tech Park" 
                required 
              />
            </label>
            <LocationPicker
              legend="Destination Map Pin"
              lat={destLat}
              lng={destLng}
              onChange={(lat, lng) => {
                setDestLat(lat);
                setDestLng(lng);
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 md:col-span-2">
            <span className="label">Schedule Type</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="scheduleType" 
                  checked={!isRecurring} 
                  onChange={() => setIsRecurring(false)}
                  className="accent-[var(--color-primary)]"
                />
                <span className="text-body-sm">One-time Trip</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="scheduleType" 
                  checked={isRecurring} 
                  onChange={() => setIsRecurring(true)}
                  className="accent-[var(--color-primary)]"
                />
                <span className="text-body-sm">Recurring Commute</span>
              </label>
            </div>
          </div>

          {!isRecurring ? (
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="label">Date</span>
              <input 
                type="date" 
                className="input" 
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required={!isRecurring}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-1 md:col-span-2">
              <span className="label">Days of the Week</span>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
                  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  return (
                    <label key={dayNum} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${recurringDays.includes(dayNum) ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"}`}>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={recurringDays.includes(dayNum)}
                        onChange={() => toggleDay(dayNum)}
                      />
                      {days[dayNum]}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="label">{type === "giver" ? "Seats Available" : "Seats Needed"}</span>
            <input 
              type="number" 
              className="input" 
              min="1"
              max="10"
              value={seatsStr}
              onChange={e => setSeatsStr(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="label">Time Window (Start)</span>
            <input 
              type="time" 
              className="input" 
              value={timeStart}
              onChange={e => setTimeStart(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Time Window (End)</span>
            <input 
              type="time" 
              className="input" 
              value={timeEnd}
              onChange={e => setTimeEnd(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="flex gap-4">
          {initialData && (
            <button 
              type="button" 
              onClick={handleCancel}
              disabled={loading}
              className="btn w-full btn-lg btn-ghost border border-[var(--color-border)] text-[var(--color-error)]"
            >
              {loading ? "Canceling..." : "Cancel Route"}
            </button>
          )}
          <button 
            type="submit" 
            disabled={loading}
            className={`btn w-full btn-lg ${type === "giver" ? "btn-accent" : "btn-primary"}`}
          >
            {loading ? "Posting..." : (initialData ? "Update Route" : `Post as ${type === "giver" ? "Giver" : "Seeker"}`)}
          </button>
        </div>
      </form>
    </div>
  );
}
