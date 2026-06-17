"use client";

import { useState, useEffect } from "react";
import { CarpoolForm } from "@/components/carpool/CarpoolForm";

export function AdminCarpoolTable() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPost, setEditPost] = useState<any>(null);

  const fetchPosts = () => {
    setLoading(true);
    fetch("/api/admin/carpool")
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

  const openEditModal = (post: any) => {
    setEditPost(post);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this carpool post?")) return;
    try {
      const res = await fetch(`/api/admin/carpool?id=${id}`, { method: "DELETE" });
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

  if (loading) return <div className="p-6">Loading carpool posts...</div>;

  return (
    <div className="card p-6 mt-8 overflow-x-auto relative">
      <h2 className="text-h2 mb-4">Manage Carpool Posts</h2>
      
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">User</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Route</th>
            <th className="p-3 text-sm font-semibold text-[var(--color-text-secondary)]">Type / Seats</th>
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
                <div className="text-sm font-medium">{post.start_name || "N/A"} → {post.dest_name || "N/A"}</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {post.is_recurring ? "Recurring" : new Date(post.date).toLocaleDateString()} @ {post.time_start.slice(0,5)}
                </div>
              </td>
              <td className="p-3">
                <span className={`badge ${post.type === 'giver' ? 'badge-accent' : 'badge-primary'} mr-2`}>
                  {post.type}
                </span>
                <span className="text-sm text-[var(--color-text-secondary)]">{post.seats} seats</span>
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
                No carpool posts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Edit Modal */}
      {isModalOpen && editPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-transparent my-8">
            <CarpoolForm
              user={editPost.user}
              initialData={editPost}
              isAdmin={true}
              onSubmitOverride={async (data) => {
                const res = await fetch("/api/admin/carpool", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: editPost.id, ...data }),
                });
                if (!res.ok) {
                  const errData = await res.json();
                  throw new Error(errData.error || "Failed to save post");
                }
                setIsModalOpen(false);
                fetchPosts();
              }}
              onCancel={() => setIsModalOpen(false)}
              onPostCreated={() => { setIsModalOpen(false); fetchPosts(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
