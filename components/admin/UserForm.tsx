"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import type { User } from "@/lib/types";

interface Props {
  user?: User;
}

const emptyUser = {
  full_name: "",
  email: "",
  company: "",
  job_title: "",
  profile_photo_url: "",
  linkedin_profile_url: "",
  home_lat: "",
  home_lng: "",
  office_lat: "",
  office_lng: "",
  active_location: "home" as const,
  is_active: true,
};

export function UserForm({ user }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(
    user
      ? {
          full_name: user.full_name,
          email: user.email ?? "",
          company: user.company ?? "",
          job_title: user.job_title ?? "",
          profile_photo_url: user.profile_photo_url ?? "",
          linkedin_profile_url: user.linkedin_profile_url ?? "",
          home_lat: user.home_lat?.toString() ?? "",
          home_lng: user.home_lng?.toString() ?? "",
          office_lat: user.office_lat?.toString() ?? "",
          office_lng: user.office_lng?.toString() ?? "",
          active_location: user.active_location,
          is_active: user.is_active,
        }
      : emptyUser
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      company: form.company || null,
      job_title: form.job_title || null,
      profile_photo_url: form.profile_photo_url || null,
      linkedin_profile_url: form.linkedin_profile_url || null,
      home_lat: form.home_lat ? Number(form.home_lat) : null,
      home_lng: form.home_lng ? Number(form.home_lng) : null,
      office_lat: form.office_lat ? Number(form.office_lat) : null,
      office_lng: form.office_lng ? Number(form.office_lng) : null,
      active_location: form.active_location,
      is_active: form.is_active,
    };

    const url = user ? `/api/admin/users/${user.id}` : "/api/admin/users";
    const method = user ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save user.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
      {[
        ["full_name", "Full name"],
        ["email", "Email"],
        ["company", "Company"],
        ["job_title", "Job title"],
        ["profile_photo_url", "Profile photo URL"],
        ["linkedin_profile_url", "LinkedIn profile URL"],
      ].map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="font-medium">{label}</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form[key as keyof typeof form] as string}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            required={key === "full_name"}
          />
        </label>
      ))}

      <LocationPicker
        legend="Home location"
        lat={form.home_lat}
        lng={form.home_lng}
        autoCapture={!user}
        onChange={(home_lat, home_lng) => setForm({ ...form, home_lat, home_lng })}
      />

      <LocationPicker
        legend="Office location"
        lat={form.office_lat}
        lng={form.office_lng}
        onChange={(office_lat, office_lng) => setForm({ ...form, office_lat, office_lng })}
      />

      <label className="block text-sm">
        <span className="font-medium">Default location</span>
        <select
          className="mt-1 block w-full rounded border px-3 py-2"
          value={form.active_location}
          onChange={(e) =>
            setForm({ ...form, active_location: e.target.value as typeof form.active_location })
          }
        >
          <option value="home">Home</option>
          <option value="office">Office</option>
          <option value="current">Current</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        Active
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : user ? "Update user" : "Create user"}
      </button>
    </form>
  );
}
