"use client";

import { useState, useEffect } from "react";

export function AdminJobTable() {
  const [posts, setPosts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<"giver" | "seeker">("giver");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [status, setStatus] = useState("active");

  const fetchPosts = () => {
    setLoading(true);
    fetch("/api/admin/jobs")
      .then(res => res.json())
      .then(data => {
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then(res => res.json())
      .then(data => {
        setUsers(data.users || []);
        if (data.users?.length > 0 && !userId) {
          setUserId(data.users[0].id);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchPosts();
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setEditId(null);
    if (users.length > 0) setUserId(users[0].id);
    setType("giver");
    setRole("");
    setCompany("");
    setExperience("");
    setSkills("");
    setStatus("active");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = (post: any) => {
    setEditId(post.id);
    setUserId(post.user_id);
    setType(post.type);
    setRole(post.role || "");
    setCompany(post.company || "");
    setExperience(post.experience_years?.toString() || "0");
    setSkills(post.skills || "");
    setStatus(post.status || "active");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job post?")) return;
    try {
      const res = await fetch(`/api/admin/jobs?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPosts();
      } else {
        alert("Failed to delete post");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting post");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");

    try {
      const isEditing = !!editId;
      const method = isEditing ? "PATCH" : "POST";
      const body = {
        id: editId,
        user_id: userId,
        type,
        role,
        company,
        experience_years: experience,
        skills,
        status
      };

      const res = await fetch("/api/admin/jobs", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchPosts();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to save post");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Error saving post");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading job posts...</div>;

  return (
    <div className="card p-6 mt-8 overflow-x-auto relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-h2">Manage Job Posts</h2>
        <button onClick={openAddModal} className="btn btn-primary btn-sm">Add Job Post</button>
      </div>
      
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">User</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Role / Company</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Type / Exp</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Status</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)]">
              <td className="p-3">
                <div className="font-medium text-[var(--color-text-primary)]">{post.user?.full_name || 'Unknown'}</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">{post.user?.email}</div>
              </td>
              <td className="p-3">
                <div className="font-medium">{post.role}</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">{post.company || "N/A"}</div>
              </td>
              <td className="p-3">
                <span className={`badge ${post.type === 'giver' ? 'badge-accent' : 'badge-primary'} mr-2`}>
                  {post.type}
                </span>
                <span className="text-sm text-[var(--color-text-secondary)]">{post.experience_years} years</span>
              </td>
              <td className="p-3">
                <span className={`badge ${post.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                  {post.status}
                </span>
              </td>
              <td className="p-3">
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(post)} className="btn btn-secondary py-1 px-3 text-xs h-auto min-h-0">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(post.id)} className="btn btn-ghost text-[var(--color-error)] py-1 px-3 text-xs h-auto min-h-0">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-[var(--color-text-tertiary)]">
                No job posts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] shrink-0">
              <h3 className="text-h2 m-0">{editId ? "Edit Job Post" : "Add Job Post"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {errorMsg && <div className="alert alert-error mb-6">{errorMsg}</div>}
              
              <form id="jobForm" onSubmit={handleSave} className="space-y-4">
                {!editId && (
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
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Post Type</label>
                    <select className="input w-full" value={type} onChange={(e) => setType(e.target.value as "giver" | "seeker")}>
                      <option value="giver">Giver (Referrer)</option>
                      <option value="seeker">Seeker (Candidate)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="active">Active</option>
                      <option value="matched">Matched (Inactive)</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{type === "giver" ? "Hiring Role" : "Target Role"}</label>
                    <input required className="input w-full" placeholder="e.g. Frontend Engineer" value={role} onChange={e => setRole(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Experience Years</label>
                    <input required type="number" min="0" className="input w-full" placeholder="e.g. 3" value={experience} onChange={e => setExperience(e.target.value)} />
                  </div>
                </div>

                {type === "giver" && (
                  <div>
                    <label className="label">Company</label>
                    <input required className="input w-full" placeholder="e.g. Google" value={company} onChange={e => setCompany(e.target.value)} />
                  </div>
                )}

                <div>
                  <label className="label">Skills (Comma separated)</label>
                  <input required className="input w-full" placeholder="e.g. React, Node.js" value={skills} onChange={e => setSkills(e.target.value)} />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] shrink-0 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" form="jobForm" disabled={isSaving} className="btn btn-primary">
                {isSaving ? "Saving..." : "Save Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
