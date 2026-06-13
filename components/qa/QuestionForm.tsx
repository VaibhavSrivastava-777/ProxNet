"use client";

import { useState, useEffect } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";

interface Props {
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  fixedCompany?: string;
  onPosted?: () => void;
}

export function QuestionForm({
  defaultLat = 28.6139,
  defaultLng = 77.209,
  defaultRadius = 5000,
  fixedCompany,
  onPosted,
}: Props) {
  const [body, setBody] = useState("");
  const [companyFilter, setCompanyFilter] = useState(fixedCompany || "");
  const [titleFilter, setTitleFilter] = useState("");
  const [radius, setRadius] = useState(defaultRadius);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);
  const [availableTitles, setAvailableTitles] = useState<string[]>([]);
  const [fetchingTitles, setFetchingTitles] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [clusters, setClusters] = useState<any[]>([]);

  useEffect(() => {
    if (!fixedCompany) {
      setFetchingCompanies(true);
      if (lat && lng) {
        fetch(`/api/proximity/aggregate?lat=${lat}&lng=${lng}&radius=${radius}`)
          .then((res) => res.json())
          .then((data) => {
            const list = data.clusters?.map((c: any) => c.company).sort() || [];
            setAvailableCompanies(list);
            setClusters(data.clusters || []);
            setCompanyFilter((prev) => (prev && !list.includes(prev) ? "" : prev));
            setFetchingCompanies(false);
          })
          .catch(() => setFetchingCompanies(false));
      } else {
        fetch("/api/companies")
          .then((res) => res.json())
          .then((data) => {
            setAvailableCompanies(data.companies || []);
            setClusters([]);
            setFetchingCompanies(false);
          })
          .catch(() => setFetchingCompanies(false));
      }
    }
  }, [fixedCompany, lat, lng, radius]);

  useEffect(() => {
    if (companyFilter) {
      setFetchingTitles(true);
      fetch(`/api/companies/titles?company=${encodeURIComponent(companyFilter)}`)
        .then((res) => res.json())
        .then((data) => {
          setAvailableTitles(data.titles || []);
          setFetchingTitles(false);
        })
        .catch(() => setFetchingTitles(false));
    } else {
      setAvailableTitles([]);
      setTitleFilter("");
    }
  }, [companyFilter]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const centerLat = lat ? parseFloat(lat) : defaultLat;
    const centerLng = lng ? parseFloat(lng) : defaultLng;

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionBody: body,
        companyFilter: companyFilter || null,
        titleFilter: titleFilter || null,
        centerLat,
        centerLng,
        radiusMeters: radius,
      }),
    });

    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setBody("");
      setIsSuccess(true);
      setMessage(`Question sent to ${data.targetCount} professional(s).`);
      onPosted?.();
    } else {
      setIsSuccess(false);
      setMessage("Failed to post question.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card animate-fadeInUp" style={{ padding: "1.5rem" }}>
      <h3 className="text-h3" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-accent)" }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Ask a Question
      </h3>

      <textarea
        className="input"
        rows={4}
        placeholder="What would you like to ask nearby professionals?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        style={{ width: "100%", marginBottom: "1rem", resize: "vertical" }}
      />

      <div style={{ marginBottom: "1rem" }}>
        <LocationPicker
          legend="Question Center Location"
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
          autoCapture={true}
          radius={radius}
          clusters={clusters}
          onCompanyClick={(company) => setCompanyFilter(company)}
        />
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <label className="label">
          Radius: {radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}
        </label>
        <input
          type="range"
          min={100}
          max={100000}
          step={100}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          style={{
            width: "100%",
            marginTop: "0.375rem",
            accentColor: "var(--color-accent)",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="text-caption">100m</span>
          <span className="text-caption">100km</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1rem" }} className="sm:grid-cols-2">
        <div>
          <label className="label">Company Filter</label>
          {fixedCompany ? (
            <input
              className="input"
              value={fixedCompany}
              readOnly
              style={{ width: "100%", backgroundColor: "var(--color-surface-secondary)", cursor: "not-allowed" }}
            />
          ) : (
            <select
              className="input"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              disabled={fetchingCompanies}
              style={{ width: "100%", color: companyFilter ? "var(--color-text)" : "var(--color-text-tertiary)" }}
            >
              <option value="">Any Company (Optional)</option>
              {availableCompanies.map((c) => (
                <option key={c} value={c} style={{ color: "var(--color-text)" }}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label">Job Title Filter</label>
          {companyFilter ? (
            <select
              className="input"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              disabled={fetchingTitles}
              style={{ width: "100%", color: titleFilter ? "var(--color-text)" : "var(--color-text-tertiary)" }}
            >
              <option value="">Any Designation (Optional)</option>
              {availableTitles.map((t) => (
                <option key={t} value={t} style={{ color: "var(--color-text)" }}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder="Select a company first"
              value={titleFilter}
              disabled
              style={{ width: "100%", backgroundColor: "var(--color-surface-secondary)", cursor: "not-allowed" }}
            />
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? (
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="spinner-sm" />
            Posting...
          </span>
        ) : (
          "Post Question"
        )}
      </button>

      {message && (
        <div
          className={`alert ${isSuccess ? "alert-success" : "alert-error"} animate-fadeIn`}
          style={{ marginTop: "1rem" }}
        >
          {message}
        </div>
      )}
    </form>
  );
}
