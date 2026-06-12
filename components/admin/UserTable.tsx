"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/types";

export function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load, query]);

  async function removeUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

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
        <Link
          href="/admin/users/new"
          className="btn btn-primary btn-sm shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add user
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-md w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border-light)]">
          <table className="min-w-full text-left text-sm" style={{ borderCollapse: "collapse" }}>
            <thead className="bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)]">
              <tr>
                <th className="px-4 py-3 text-overline font-semibold">User</th>
                <th className="px-4 py-3 text-overline font-semibold">Company</th>
                <th className="px-4 py-3 text-overline font-semibold">Source</th>
                <th className="px-4 py-3 text-overline font-semibold">Status</th>
                <th className="px-4 py-3 text-overline font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
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
                        <div className="font-medium text-[var(--color-text)]">{u.full_name || "Unknown"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {u.company || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.source === "oauth" ? "badge-primary" : "badge-accent"}`}>
                        {u.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${u.is_active ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"}`} />
                        <span className="text-[var(--color-text-secondary)]">{u.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${u.id}`} className="btn btn-ghost btn-sm px-2 text-[var(--color-primary)]">
                        Edit
                      </Link>
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
      )}
    </div>
  );
}
