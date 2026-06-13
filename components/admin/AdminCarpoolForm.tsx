"use client";

import { useState, useEffect } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";

export function AdminCarpoolForm() {
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
    } else {
      const err = await res.json();
      setMessage(err.error || "Failed to add carpool post.");
    }

    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="card p-6 mt-8">
      <h2 className="text-h2 mb-4">Add Carpool Post on Behalf of User</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="label">Select User to Attribute to</label>
          <select className="input w-full" value={userId} onChange={e => setUserId(e.target.value)} required>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name || "Anonymous"} ({u.email || "No email"})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Post Type</label>
          <select className="input w-full" value={type} onChange={(e) => setType(e.target.value as "giver" | "seeker")}>
            <option value="giver">Giver (Driver)</option>
            <option value="seeker">Seeker (Passenger)</option>
          </select>
        </div>

        <div className="space-y-4">
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
              value={seats}
              onChange={e => setSeats(e.target.value)}
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

        <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
          {loading ? "Posting..." : `Post Carpool as ${type === "giver" ? "Giver" : "Seeker"}`}
        </button>

        {message && (
          <div className="alert alert-info mt-4">
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
