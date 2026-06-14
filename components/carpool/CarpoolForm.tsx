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
  const [startLat, setStartLat] = useState(initialData?.start_lat?.toString() || "");
  const [startLng, setStartLng] = useState(initialData?.start_lng?.toString() || "");
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

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/carpool/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          start_lat: parseFloat(startLat),
          start_lng: parseFloat(startLng),
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

        <div className="space-y-4">
          <LocationPicker
            legend="Source Location (Defaults to Home)"
            lat={startLat}
            lng={startLng}
            onChange={(lat, lng) => {
              setStartLat(lat);
              setStartLng(lng);
            }}
          />

          <LocationPicker
            legend={type === "giver" ? "Where are you driving to?" : "Where do you want to go?"}
            lat={destLat}
            lng={destLng}
            onChange={(lat, lng) => {
              setDestLat(lat);
              setDestLng(lng);
            }}
          />
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
