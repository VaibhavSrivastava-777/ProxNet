"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { User } from "@/lib/types";

interface CarpoolFormProps {
  user: User;
  onPostCreated: () => void;
}

export function CarpoolForm({ user, onPostCreated }: CarpoolFormProps) {
  const [type, setType] = useState<"giver" | "seeker">("seeker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Default source to Home location if it exists
  const [startLat, setStartLat] = useState(user.home_lat?.toString() || "");
  const [startLng, setStartLng] = useState(user.home_lng?.toString() || "");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [seatsStr, setSeatsStr] = useState("1");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startLat || !startLng || !destLat || !destLng || !date || !timeStart || !timeEnd) {
      setError("Please fill all location and time fields.");
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
          date,
          time_start: timeStart,
          time_end: timeEnd,
          seats: parseInt(seatsStr) || 1,
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
    <div className="card p-6 animate-fadeInUp">
      <h2 className="text-h2 mb-4">Create a Carpool Route</h2>
      
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
          <label className="flex flex-col gap-1">
            <span className="label">Date</span>
            <input 
              type="date" 
              className="input" 
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </label>

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

        <button 
          type="submit" 
          disabled={loading}
          className={`btn w-full btn-lg ${type === "giver" ? "btn-accent" : "btn-primary"}`}
        >
          {loading ? "Posting..." : `Post as ${type === "giver" ? "Giver" : "Seeker"}`}
        </button>
      </form>
    </div>
  );
}
