"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/types";

import { UserForm } from "./UserForm";

export function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?page=${page}&q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [page, query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load, query]);

  async function removeUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

  async function handleFileUpload(userId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(userId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/admin/users/${userId}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert("Profile successfully updated from resume!");
        load();
      } else {
        const errorData = await res.json();
        alert(`Failed to parse resume: ${errorData.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred during upload.");
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  }

  const openAddModal = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    load(); // Refresh list after close
  };

  return (
    <div className="card" style={{ padding: "24px" }}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-80">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            className="input w-full"
            style={{ paddingLeft: "36px" }}
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={openAddModal}
          className="btn btn-primary btn-sm shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add user
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-md w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border-light)]">
            <table className="min-w-full text-left text-sm" style={{ borderCollapse: "collapse" }}>
              <thead className="bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)]">
                <tr>
                  <th className="px-4 py-3 text-overline font-semibold">User</th>
                  <th className="px-4 py-3 text-overline font-semibold">Company &amp; Role</th>
                  <th className="px-4 py-3 text-overline font-semibold">Contact</th>
                  <th className="px-4 py-3 text-overline font-semibold">Locations</th>
                  <th className="px-4 py-3 text-overline font-semibold">Status</th>
                  <th className="px-4 py-3 text-overline font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                      No users found matching "{query}"
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="avatar avatar-sm bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div className="font-medium text-[var(--color-text)]">{u.full_name || "Unknown"}</div>
                            <div className="text-caption text-[var(--color-text-tertiary)]">{u.source}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        <div className="font-medium text-[var(--color-text)]">{u.company || "—"}</div>
                        <div className="text-caption">{u.job_title || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        <div className="truncate max-w-[150px]" title={u.email || undefined}>{u.email || "—"}</div>
                        {u.linkedin_profile_url && (
                          <a href={u.linkedin_profile_url} target="_blank" rel="noreferrer" className="text-caption text-[var(--color-primary)] hover:underline">
                            LinkedIn ↗
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] text-caption">
                        <div>Home: {u.home_lat ? "✅" : "❌"}</div>
                        <div>Office: {u.office_lat ? "✅" : "❌"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${u.is_active ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"}`} />
                            <span className="text-[var(--color-text-secondary)]">{u.is_active ? "Active" : "Inactive"}</span>
                          </div>
                          {u.is_blocked && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="badge badge-error text-xs px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">Blocked</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <label className="btn btn-ghost btn-sm px-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] cursor-pointer">
                          {uploadingId === u.id ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                              Parsing...
                            </span>
                          ) : (
                            "Upload Resume"
                          )}
                          <input 
                            type="file" 
                            accept="application/pdf" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(u.id, e)} 
                            disabled={uploadingId !== null}
                          />
                        </label>
                        <button onClick={() => openEditModal(u)} className="btn btn-ghost btn-sm px-2 text-[var(--color-primary)]">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const newStatus = !u.is_blocked;
                            if (!confirm(`Are you sure you want to ${newStatus ? 'block' : 'unblock'} this user?`)) return;
                            try {
                              const res = await fetch(`/api/admin/users/${u.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ is_blocked: newStatus })
                              });
                              if (res.ok) {
                                load();
                              } else {
                                alert('Failed to update block status');
                              }
                            } catch (e) {
                              alert('Failed to update block status');
                            }
                          }}
                          className={`btn btn-ghost btn-sm px-2 ${u.is_blocked ? "text-green-600" : "text-orange-600"}`}
                        >
                          {u.is_blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUser(u.id)}
                          className="btn btn-ghost btn-sm px-2 text-[var(--color-error)]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} entries
            </span>
            <div className="flex gap-2">
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={page * 20 >= total} 
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] shrink-0">
              <h3 className="text-h2 m-0">{editingUser ? "Edit User" : "Add User"}</h3>
              <button onClick={closeModal} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <UserForm user={editingUser} onSuccess={closeModal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
