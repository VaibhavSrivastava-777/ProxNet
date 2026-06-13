"use client";

import { useState, useEffect } from "react";

export function AdminCarpoolForm() {
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"giver" | "seeker">("giver");
  const [seats, setSeats] = useState("1");
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
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/admin/carpool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        type,
        seats
      }),
    });

    setLoading(false);
    if (res.ok) {
      setMessage("Carpool post added successfully!");
      setSeats("1");
    } else {
      setMessage("Failed to add carpool post.");
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

        <div>
          <label className="label">Number of Seats</label>
          <input required type="number" min="1" max="10" className="input w-full" value={seats} onChange={e => setSeats(e.target.value)} />
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
