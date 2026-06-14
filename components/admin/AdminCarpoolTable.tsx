"use client";

import { useState, useEffect } from "react";

export function AdminCarpoolTable() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartName, setEditStartName] = useState("");
  const [editDestName, setEditDestName] = useState("");

  const fetchPosts = () => {
    setLoading(true);
    fetch("/api/admin/carpool/list")
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

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleEdit = (post: any) => {
    setEditingId(post.id);
    setEditStartName(post.start_name || "");
    setEditDestName(post.dest_name || "");
  };

  const handleSave = async (id: string) => {
    try {
      const res = await fetch("/api/admin/carpool/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          start_name: editStartName,
          dest_name: editDestName
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchPosts();
      } else {
        alert("Failed to update");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving");
    }
  };

  if (loading) return <div className="p-6">Loading carpool posts...</div>;

  return (
    <div className="card p-6 mt-8 overflow-x-auto">
      <h2 className="text-h2 mb-4">Manage Carpool Posts (Location Names)</h2>
      
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">User</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Type / Seats</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Source Name</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Destination Name</th>
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
                <span className={`badge ${post.type === 'giver' ? 'badge-accent' : 'badge-primary'} mr-2`}>
                  {post.type}
                </span>
                <span className="text-sm text-[var(--color-text-secondary)]">{post.seats} seats</span>
              </td>
              
              <td className="p-3">
                {editingId === post.id ? (
                  <input 
                    type="text" 
                    className="input py-1 px-2 text-sm w-full"
                    value={editStartName}
                    onChange={(e) => setEditStartName(e.target.value)}
                    placeholder="Enter Source Name"
                  />
                ) : (
                  <span className={post.start_name ? "text-text-primary" : "text-text-tertiary italic"}>
                    {post.start_name || "Missing"}
                  </span>
                )}
              </td>
              
              <td className="p-3">
                {editingId === post.id ? (
                  <input 
                    type="text" 
                    className="input py-1 px-2 text-sm w-full"
                    value={editDestName}
                    onChange={(e) => setEditDestName(e.target.value)}
                    placeholder="Enter Destination Name"
                  />
                ) : (
                  <span className={post.dest_name ? "text-text-primary" : "text-text-tertiary italic"}>
                    {post.dest_name || "Missing"}
                  </span>
                )}
              </td>
              
              <td className="p-3">
                {editingId === post.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(post.id)} className="btn btn-primary py-1 px-3 text-xs h-auto min-h-0">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn btn-ghost py-1 px-3 text-xs h-auto min-h-0">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleEdit(post)} className="btn btn-secondary py-1 px-3 text-xs h-auto min-h-0">
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-[var(--color-text-tertiary)]">
                No carpool posts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
