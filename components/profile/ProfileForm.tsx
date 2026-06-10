"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import type { User, UserVisibility } from "@/lib/types";

interface Props {
  initialUser: User;
}

export function ProfileForm({ initialUser }: Props) {
  const [user, setUser] = useState(initialUser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const visibility = user.visibility as UserVisibility;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: user.full_name,
        company: user.company,
        job_title: user.job_title,
        profile_photo_url: user.profile_photo_url,
        linkedin_profile_url: user.linkedin_profile_url,
        home_lat: user.home_lat ? Number(user.home_lat) : null,
        home_lng: user.home_lng ? Number(user.home_lng) : null,
        office_lat: user.office_lat ? Number(user.office_lat) : null,
        office_lng: user.office_lng ? Number(user.office_lng) : null,
        active_location: user.active_location,
        visibility,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
      setMessage("Profile saved.");
    } else {
      setMessage("Failed to save profile.");
    }
  }

  function toggleVisibility(key: keyof UserVisibility) {
    setUser({
      ...user,
      visibility: { ...visibility, [key]: !visibility[key] },
    });
  }

  const needsCompletion = !user.company || !user.job_title;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {needsCompletion && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Complete your company and job title to appear in proximity searches.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Full name</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={user.full_name}
            onChange={(e) => setUser({ ...user, full_name: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            className="mt-1 w-full rounded border bg-zinc-50 px-3 py-2"
            value={user.email ?? ""}
            disabled
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Company</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={user.company ?? ""}
            onChange={(e) => setUser({ ...user, company: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Job title</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={user.job_title ?? ""}
            onChange={(e) => setUser({ ...user, job_title: e.target.value })}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Profile photo URL</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={user.profile_photo_url ?? ""}
            onChange={(e) => setUser({ ...user, profile_photo_url: e.target.value })}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">LinkedIn profile URL</span>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={user.linkedin_profile_url ?? ""}
            onChange={(e) => setUser({ ...user, linkedin_profile_url: e.target.value })}
          />
        </label>
      </div>

      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Default location mode</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {(["home", "office", "current"] as const).map((loc) => (
            <label key={loc} className="flex items-center gap-2">
              <input
                type="radio"
                name="active_location"
                checked={user.active_location === loc}
                onChange={() => setUser({ ...user, active_location: loc })}
              />
              {loc.charAt(0).toUpperCase() + loc.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

      <LocationPicker
        legend="Home location"
        lat={user.home_lat?.toString() ?? ""}
        lng={user.home_lng?.toString() ?? ""}
        onChange={(home_lat, home_lng) =>
          setUser({
            ...user,
            home_lat: home_lat ? Number(home_lat) : null,
            home_lng: home_lng ? Number(home_lng) : null,
          })
        }
      />

      <LocationPicker
        legend="Office location"
        lat={user.office_lat?.toString() ?? ""}
        lng={user.office_lng?.toString() ?? ""}
        onChange={(office_lat, office_lng) =>
          setUser({
            ...user,
            office_lat: office_lat ? Number(office_lat) : null,
            office_lng: office_lng ? Number(office_lng) : null,
          })
        }
      />

      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Visibility in anonymized views</legend>
        <div className="mt-2 space-y-2 text-sm">
          {(
            [
              ["showCompany", "Show company"],
              ["showTitle", "Show job title"],
              ["showPhoto", "Show photo"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={() => toggleVisibility(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
        {message && <p className="text-sm text-zinc-600">{message}</p>}
      </div>
    </form>
  );
}
