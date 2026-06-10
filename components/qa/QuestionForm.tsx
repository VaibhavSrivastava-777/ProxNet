"use client";

import { useState } from "react";

interface Props {
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  onPosted?: () => void;
}

export function QuestionForm({
  defaultLat = 28.6139,
  defaultLng = 77.209,
  defaultRadius = 100,
  onPosted,
}: Props) {
  const [body, setBody] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [radius, setRadius] = useState(defaultRadius);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    let centerLat = defaultLat;
    let centerLng = defaultLng;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        centerLat = pos.coords.latitude;
        centerLng = pos.coords.longitude;
      } catch {
        // use defaults
      }
    }

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
      setMessage(`Question sent to ${data.targetCount} professional(s).`);
      onPosted?.();
    } else {
      setMessage("Failed to post question.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">Ask a question</h2>
      <textarea
        className="w-full rounded border px-3 py-2 text-sm"
        rows={4}
        placeholder="What would you like to ask nearby professionals?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Filter by company (optional)"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Filter by job title (optional)"
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
        />
      </div>
      <label className="block text-sm">
        Radius: {radius}m
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Posting..." : "Post question"}
      </button>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </form>
  );
}
