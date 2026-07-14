"use client";

import { useState, useEffect } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";

interface AdminCarpoolFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminCarpoolForm({ isOpen, onClose, onSuccess }: AdminCarpoolFormProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"giver" | "seeker">("giver");
  const [seats, setSeats] = useState("1");
  const [startLat, setStartLat] = useState("");
  const [startLng, setStartLng] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(res => res.json())
      .then(data => {
        setUsers(data.users || []);
        if (data.users?.length > 0) {
          setUserId(data.users[0].id);
        }
      })
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startLat || !startLng || !destLat || !destLng || !date || !timeStart || !timeEnd) {
      setMessage("Please fill all location and time fields.");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/carpool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          type,
          seats,
          start_lat: parseFloat(startLat),
          start_lng: parseFloat(startLng),
          dest_lat: parseFloat(destLat),
          dest_lng: parseFloat(destLng),
          date,
          time_start: timeStart,
          time_end: timeEnd,
        }),
      });

      setLoading(false);
      if (res.ok) {
        setMessage("Carpool post added successfully!");
        setSeats("1");
        setTimeout(() => {
          setMessage("");
          onSuccess();
          onClose();
        }, 1500);
      } else {
        const err = await res.json();
        setMessage(err.error || "Failed to add carpool post.");
      }
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Failed to submit post.");
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-surface border border-primary/20 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col animate-scaleUp">
        <div className="p-6 border-b border-border flex justify-between items-center bg-background/55 sticky top-0 z-10">
          <div>
            <h3 className="text-lg font-bold text-text-primary">🚗 Create Carpool Listing</h3>
            <p className="text-xs text-text-secondary mt-1">Publish a carpool offering or request on behalf of a user.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-lg"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">Attributed User</label>
              <select className="input w-full py-2 text-sm" value={userId} onChange={e => setUserId(e.target.value)} required>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || "Anonymous"} ({u.email || "No email"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">Post Type</label>
              <select className="input w-full py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as "giver" | "seeker")}>
                <option value="giver">Giver (Driver Offering Ride)</option>
                <option value="seeker">Seeker (Passenger Requesting Ride)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 bg-background p-4 rounded-xl border border-border">
            <LocationPicker
              legend="Source Location"
              lat={startLat}
              lng={startLng}
              onChange={(lat, lng) => {
                setStartLat(lat);
                setStartLng(lng);
              }}
            />

            <LocationPicker
              legend={type === "giver" ? "Destination Location (Driving To)" : "Destination Location (Going To)"}
              lat={destLat}
              lng={destLng}
              onChange={(lat, lng) => {
                setDestLat(lat);
                setDestLng(lng);
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">Travel Date</label>
              <input 
                type="date" 
                className="input py-2 text-sm" 
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">
                {type === "giver" ? "Seats Available" : "Seats Needed"}
              </label>
              <input 
                type="number" 
                className="input py-2 text-sm" 
                min="1"
                max="10"
                value={seats}
                onChange={e => setSeats(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">Time Window (Start)</label>
              <input 
                type="time" 
                className="input py-2 text-sm" 
                value={timeStart}
                onChange={e => setTimeStart(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1 block">Time Window (End)</label>
              <input 
                type="time" 
                className="input py-2 text-sm" 
                value={timeEnd}
                onChange={e => setTimeEnd(e.target.value)}
                required
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-semibold border ${
              message.includes("success") ? "bg-green-50 text-green-900 border-green-200" : "bg-red-50 text-red-900 border-red-200"
            }`}>
              {message}
            </div>
          )}

          <div className="pt-4 border-t border-border flex justify-end gap-3 z-10 relative">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary py-2 text-sm px-5"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="btn btn-primary py-2 text-sm px-5"
            >
              {loading ? "Posting..." : "Create Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
