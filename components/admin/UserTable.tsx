"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/types";

import { UserForm } from "./UserForm";

type FilterType = "all" | "missing_embedding" | "incomplete_profile" | "missing_locality" | "blocked";

function isVectorReady(u: User): boolean {
  if (u.has_embedding !== undefined) return Boolean(u.has_embedding);
  if (!u.embedding) return false;
  if (Array.isArray(u.embedding)) return u.embedding.length > 0;
  if (typeof u.embedding === "string") {
    const trimmed = (u.embedding as string).trim();
    return trimmed.length > 2 && trimmed !== "[]" && trimmed !== "null";
  }
  return false;
}

export function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

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
      e.target.value = "";
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
    load();
  };

  // Client-side filtering on current page
  const filteredUsers = users.filter((u) => {
    if (activeFilter === "missing_embedding") {
      return !isVectorReady(u);
    }
    if (activeFilter === "incomplete_profile") {
      return !u.full_name?.trim() || !u.company?.trim() || !u.job_title?.trim() || !u.email?.trim();
    }
    if (activeFilter === "missing_locality") {
      const hasHomeCoords = u.home_lat && u.home_lng;
      const hasOfficeCoords = u.office_lat && u.office_lng;
      const homeNeeds = hasHomeCoords && (!u.home_name || u.home_name.toLowerCase() === "home");
      const officeNeeds = hasOfficeCoords && (!u.office_name || u.office_name.toLowerCase() === "office");
      return homeNeeds || officeNeeds;
    }
    if (activeFilter === "blocked") {
      return u.is_blocked;
    }
    return true;
  });

  return (
    <div className="card" style={{ padding: "20px" }}>
      {/* Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="relative w-full md:w-80">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            className="input w-full text-xs"
            style={{ paddingLeft: "36px" }}
            placeholder="Search by name, email, company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button onClick={openAddModal} className="btn btn-primary btn-sm shadow-sm text-xs">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add user
        </button>
      </div>

      {/* Leading Indicator Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-3 border-b border-[var(--color-border-light)] text-xs">
        <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mr-1 shrink-0">Filter:</span>
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
            activeFilter === "all"
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          All Users
        </button>
        <button
          onClick={() => setActiveFilter("missing_embedding")}
          className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
            activeFilter === "missing_embedding"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
          }`}
        >
          <span>🟡</span> Missing AI Vector
        </button>
        <button
          onClick={() => setActiveFilter("incomplete_profile")}
          className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
            activeFilter === "incomplete_profile"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20"
          }`}
        >
          <span>🔴</span> Incomplete Profile
        </button>
        <button
          onClick={() => setActiveFilter("missing_locality")}
          className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
            activeFilter === "missing_locality"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20"
          }`}
        >
          <span>📍</span> Ungeocoded Locality
        </button>
        <button
          onClick={() => setActiveFilter("blocked")}
          className={`px-3 py-1 rounded-full font-medium transition-all whitespace-nowrap ${
            activeFilter === "blocked"
              ? "bg-red-700 text-white shadow-sm"
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Blocked
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
            <table className="min-w-full text-left text-xs" style={{ borderCollapse: "collapse" }}>
              <thead className="bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)]">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">User</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Company &amp; Role</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Match Readiness</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Locality</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]">Contact</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                      No users match "{query}" or current filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const hasEmbedding = isVectorReady(u);
                    const isProfileComplete = !!(u.full_name?.trim() && u.company?.trim() && u.job_title?.trim() && u.email?.trim());
                    const locality = u.home_name || u.office_name || (u.home_lat ? "GPS Coordinate" : "None");

                    return (
                      <tr key={u.id} className="hover:bg-[var(--color-surface-hover)]/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="avatar avatar-sm bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-xs">
                              {u.full_name ? u.full_name.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div>
                              <div className="font-semibold text-[var(--color-text-primary)]">{u.full_name || "Unknown"}</div>
                              <div className="text-[10px] text-[var(--color-text-tertiary)]">{u.source || "oauth"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                          <div className="font-medium text-[var(--color-text-primary)]">{u.company || "—"}</div>
                          <div className="text-[11px] text-[var(--color-text-tertiary)]">{u.job_title || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 text-[10px]">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium w-fit ${
                                hasEmbedding
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-amber-500/10 text-amber-600 font-semibold"
                              }`}
                            >
                              <span>{hasEmbedding ? "🟢" : "🟡"}</span>
                              {hasEmbedding ? "Vector Ready" : "Missing Vector"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium w-fit ${
                                isProfileComplete
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-rose-500/10 text-rose-600 font-semibold"
                              }`}
                            >
                              <span>{isProfileComplete ? "🟢" : "🔴"}</span>
                              {isProfileComplete ? "100% Profile" : "Incomplete Info"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)] text-[11px]">
                          <div className="flex items-center gap-1">
                            <span>📍</span>
                            <span className="truncate max-w-[130px]" title={locality}>
                              {locality}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                          <div className="truncate max-w-[140px] text-[11px]" title={u.email || undefined}>
                            {u.email || "—"}
                          </div>
                          {u.linkedin_profile_url && (
                            <a
                              href={u.linkedin_profile_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-[var(--color-primary)] hover:underline block"
                            >
                              LinkedIn ↗
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <label className="btn btn-ghost btn-sm px-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] cursor-pointer">
                              {uploadingId === u.id ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                  Parsing...
                                </span>
                              ) : (
                                "Resume"
                              )}
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) => handleFileUpload(u.id, e)}
                                disabled={uploadingId !== null}
                              />
                            </label>
                            <button onClick={() => openEditModal(u)} className="btn btn-ghost btn-sm px-1.5 text-xs text-[var(--color-primary)]">
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const newStatus = !u.is_blocked;
                                if (!confirm(`Are you sure you want to ${newStatus ? "block" : "unblock"} this user?`)) return;
                                try {
                                  const res = await fetch(`/api/admin/users/${u.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ is_blocked: newStatus }),
                                  });
                                  if (res.ok) {
                                    load();
                                  } else {
                                    alert("Failed to update block status");
                                  }
                                } catch (e) {
                                  alert("Failed to update block status");
                                }
                              }}
                              className={`btn btn-ghost btn-sm px-1.5 text-xs ${u.is_blocked ? "text-emerald-600" : "text-amber-600"}`}
                            >
                              {u.is_blocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeUser(u.id)}
                              className="btn btn-ghost btn-sm px-1.5 text-xs text-[var(--color-error)]"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} entries
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-ghost btn-sm text-xs"
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] shrink-0">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] m-0">{editingUser ? "Edit User" : "Add User"}</h3>
              <button onClick={closeModal} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <UserForm user={editingUser} onSuccess={closeModal} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
