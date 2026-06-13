"use client";

import { useState, useEffect } from "react";

export function AdminJobForm() {
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"giver" | "seeker">("giver");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
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

    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        type,
        role,
        company,
        experience_years: experience,
        skills
      }),
    });

    setLoading(false);
    if (res.ok) {
      setMessage("Job posted successfully!");
      setRole("");
      setCompany("");
      setExperience("");
      setSkills("");
    } else {
      setMessage("Failed to post job.");
    }

    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="card p-6 mt-8">
      <h2 className="text-h2 mb-4">Add Job Post on Behalf of User</h2>
      
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
            <option value="giver">Giver (Referrer)</option>
            <option value="seeker">Seeker (Candidate)</option>
          </select>
        </div>

        <div>
          <label className="label">{type === "giver" ? "Hiring Role" : "Target Role"}</label>
          <input required className="input w-full" placeholder="e.g. Frontend Engineer" value={role} onChange={e => setRole(e.target.value)} />
        </div>

        {type === "giver" && (
          <div>
            <label className="label">Company</label>
            <input required className="input w-full" placeholder="e.g. Google" value={company} onChange={e => setCompany(e.target.value)} />
          </div>
        )}

        <div>
          <label className="label">Experience Years</label>
          <input required type="number" min="0" className="input w-full" placeholder="e.g. 3" value={experience} onChange={e => setExperience(e.target.value)} />
        </div>

        <div>
          <label className="label">Skills (Comma separated)</label>
          <input required className="input w-full" placeholder="e.g. React, Node.js" value={skills} onChange={e => setSkills(e.target.value)} />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
          {loading ? "Posting..." : `Post Job as ${type === "giver" ? "Giver" : "Seeker"}`}
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
