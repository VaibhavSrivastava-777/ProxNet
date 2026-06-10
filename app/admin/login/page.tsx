"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [suID, setSuID] = useState("");
  const [suPWD, setSuPWD] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suID, suPWD }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.message ?? data.error ?? "Invalid credentials.");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-xl border bg-white p-8 dark:bg-zinc-900">
      <h1 className="text-2xl font-bold">Admin login</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Local dev default: <code className="rounded bg-zinc-100 px-1">admin</code> /{" "}
        <code className="rounded bg-zinc-100 px-1">admin123</code> (from{" "}
        <code className="rounded bg-zinc-100 px-1">.env.local</code>)
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium">suID</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={suID}
            onChange={(e) => setSuID(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">suPWD</span>
          <input
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            value={suPWD}
            onChange={(e) => setSuPWD(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
