"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import { LocationAutocomplete } from "@/components/map/LocationAutocomplete";

interface Props {
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  fixedCompany?: string;
  targetUser?: {
    id: string;
    job_title: string;
    company: string;
  };
  onPosted?: () => void;
}

export function QuestionForm({
  defaultLat = 28.6139,
  defaultLng = 77.209,
  defaultRadius = 5000,
  fixedCompany,
  targetUser,
  onPosted,
}: Props) {
  const router = useRouter();
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

  const [locationType, setLocationType] = useState<"Home" | "Office" | "Others">("Home");
  const [locationName, setLocationName] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    if (locationType === "Home") {
      if (!user.home_lat || !user.home_lng) {
        alert("Please update your Home location in your profile first.");
        router.push("/profile");
        return;
      }
      setLat(user.home_lat.toString());
      setLng(user.home_lng.toString());
    } else if (locationType === "Office") {
      if (!user.office_lat || !user.office_lng) {
        alert("Please update your Office location in your profile first.");
        router.push("/profile");
        return;
      }
      setLat(user.office_lat.toString());
      setLng(user.office_lng.toString());
    }
  }, [locationType, user, router]);

  const fetchGeocode = async () => {
    if (!locationName) return;
    setFetchingLocation(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(data[0].lat);
        setLng(data[0].lon);
      } else {
        alert("Could not find coordinates for this location.");
      }
    } catch (e) {
      alert("Error fetching location data.");
    } finally {
      setFetchingLocation(false);
    }
  };

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
        companyFilter: targetUser ? null : (companyFilter || null),
        titleFilter: targetUser ? null : (titleFilter || null),
        targetUserId: targetUser?.id || null,
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
      if (targetUser && data.sessionId) {
        router.push(`/chat/${data.sessionId}`);
        onPosted?.();
        return;
      }
      if (data.targetCount > 0) {
        setMessage(`Question sent to ${data.targetCount} targeted professional(s).`);
      } else {
        setMessage(`Question posted to the public Local Forum!`);
      }
      onPosted?.();
    } else {
      setIsSuccess(false);
      setMessage("Failed to post question.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-full bg-[var(--color-surface)] p-6">

      <div className="flex flex-col gap-4 mb-4 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {targetUser ? (
            <div className="col-span-3 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              <strong className="block text-sm uppercase tracking-wide opacity-80 mb-1">Direct Question</strong>
              You are asking a direct, private question to a nearby <strong>{targetUser.job_title}</strong> at <strong>{targetUser.company}</strong>.
            </div>
          ) : (
            <>
              <div>
                <label className="label">Location</label>
                <select
                  className="input w-full"
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value as any)}
                >
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Others">Custom</option>
                </select>
              </div>
              <div>
                <label className="label">Company Filter</label>
                {fixedCompany ? (
                  <input
                    className="input w-full bg-[var(--color-surface-secondary)] cursor-not-allowed"
                    value={fixedCompany}
                    readOnly
                  />
                ) : (
                  <select
                    className="input w-full"
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    disabled={fetchingCompanies}
                    style={{ color: companyFilter ? "var(--color-text)" : "var(--color-text-tertiary)" }}
                  >
                    <option value="">Any Company</option>
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
                    className="input w-full"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    disabled={fetchingTitles}
                    style={{ color: titleFilter ? "var(--color-text)" : "var(--color-text-tertiary)" }}
                  >
                    <option value="">Any Designation</option>
                    {availableTitles.map((t) => (
                      <option key={t} value={t} style={{ color: "var(--color-text)" }}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input w-full bg-[var(--color-surface-secondary)] cursor-not-allowed"
                    placeholder="Select a company first"
                    value={titleFilter}
                    disabled
                  />
                )}
              </div>
            </>
          )}
        </div>

        {locationType === "Others" && (
          <div className="flex flex-col gap-2 p-3 bg-[var(--color-surface-secondary)] rounded-lg border border-[var(--color-border-light)]">
            <LocationAutocomplete
              value={locationName}
              placeholder="Enter location e.g. Indiranagar, Bangalore"
              onChange={(val) => setLocationName(val)}
              onSelect={({ name, lat, lng }) => {
                setLocationName(name);
                setLat(lat.toString());
                setLng(lng.toString());
              }}
            />
            {lat && lng && (
              <LocationPicker
                legend="Custom Location Pin"
                lat={lat}
                lng={lng}
                onChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
                radius={radius}
                clusters={clusters}
                onCompanyClick={(company) => setCompanyFilter(company)}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-[200px] mb-4">
        <textarea
          className="input flex-1 w-full resize-none p-4"
          placeholder="What would you like to ask nearby professionals?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
      </div>

      <div className="shrink-0 flex items-center justify-between">
        <div style={{ flex: 1, marginRight: "1rem" }}>
          <label className="label flex items-center gap-2">
            Radius: {radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}
          </label>
          <input
            type="range"
            min={100}
            max={100000}
            step={100}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full h-1.5 bg-[var(--color-surface-secondary)] rounded-lg appearance-none cursor-pointer"
            style={{ accentColor: "var(--color-accent)" }}
          />
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
      </div>

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
