"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        padding: "24px",
      }}
    >
      <div className="card animate-scaleIn" style={{ width: "100%", maxWidth: "400px", padding: "36px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--color-primary-subtle)",
              color: "var(--color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: "32px", height: "32px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-h1" style={{ margin: 0, textAlign: "center" }}>Admin Portal</h1>
          <p className="text-body-sm" style={{ color: "var(--color-text-secondary)", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
            <span style={{ fontWeight: "bold", display: "inline-flex", alignItems: "center" }}>
              <span style={{
                background: "linear-gradient(135deg, var(--color-primary) 30%, #0077ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 800,
              }}>Prox</span>
              <span style={{
                background: "linear-gradient(135deg, var(--color-accent) 30%, #a855f7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 500,
              }}>Net</span>
              <sup style={{
                fontSize: "0.55em",
                fontWeight: "bold",
                color: "var(--color-text-secondary)",
                marginLeft: "1px",
                verticalAlign: "super"
              }}>®</sup>
            </span>
            {" "}Administration
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label className="label">Admin ID</label>
            <input
              className="input"
              value={suID}
              onChange={(e) => setSuID(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={suPWD}
              onChange={(e) => setSuPWD(e.target.value)}
              required
            />
          </div>
          
          {error && (
            <div className="alert alert-error" style={{ padding: "10px 14px", fontSize: "13px" }}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "8px" }}
          >
            {loading ? <span className="spinner spinner-sm" style={{ borderTopColor: "white", marginRight: "8px" }} /> : null}
            {loading ? "Authenticating..." : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: "32px", textAlign: "center" }}>
          <Link href="/" className="btn btn-ghost btn-sm">
            ← Back to website
          </Link>
        </div>
      </div>
    </div>
  );
}
