"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import { User } from "@/lib/types";
import { getCurrentPosition } from "@/lib/geo/get-current-position";

interface CarpoolFormProps {
  user: User;
  onPostCreated: () => void;
  onCancel: () => void;
  initialData?: any;
}

export function CarpoolForm({ user, onPostCreated, onCancel, initialData }: CarpoolFormProps) {
  const router = useRouter();
  const [type, setType] = useState<"giver" | "seeker">(initialData?.type || "seeker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [sourceType, setSourceType] = useState<"Home" | "Office" | "Others">("Home");
  const [destType, setDestType] = useState<"Home" | "Office" | "Others">("Office");

  const [startName, setStartName] = useState(initialData?.start_name || user.home_name || "");
  const [startLat, setStartLat] = useState(initialData?.start_lat?.toString() || user.home_lat?.toString() || "");
  const [startLng, setStartLng] = useState(initialData?.start_lng?.toString() || user.home_lng?.toString() || "");
  
  const [destName, setDestName] = useState(initialData?.dest_name || user.office_name || "");
  const [destLat, setDestLat] = useState(initialData?.dest_lat?.toString() || user.office_lat?.toString() || "");
  const [destLng, setDestLng] = useState(initialData?.dest_lng?.toString() || user.office_lng?.toString() || "");

  const [fetchingSource, setFetchingSource] = useState(false);
  const [fetchingDest, setFetchingDest] = useState(false);
  
  const dateStr = initialData?.date || new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(dateStr);
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [recurringDays, setRecurringDays] = useState<number[]>(initialData?.recurring_days || [1, 2, 3, 4, 5]);
  const [timeStart, setTimeStart] = useState(initialData?.time_start?.slice(0,5) || "08:00");
  const [timeEnd, setTimeEnd] = useState(initialData?.time_end?.slice(0,5) || "08:30");
  const [seatsStr, setSeatsStr] = useState(initialData?.seats?.toString() || "1");

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/carpool/history')
      .then(res => res.json())
      .then(data => {
        if (data.posts) setHistory(data.posts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (timeStart && !initialData) {
      const [h, m] = timeStart.split(':').map(Number);
      const dateObj = new Date();
      dateObj.setHours(h, m + 30, 0);
      const newH = dateObj.getHours().toString().padStart(2, '0');
      const newM = dateObj.getMinutes().toString().padStart(2, '0');
      setTimeEnd(`${newH}:${newM}`);
    }
  }, [timeStart]);

  useEffect(() => {
    if (sourceType === "Home") {
      if (!user.home_lat || !user.home_lng) {
        alert("Please update your Home location in your profile first.");
        router.push("/profile");
        return;
      }
      setStartName(user.home_name || "Home");
      setStartLat(user.home_lat.toString());
      setStartLng(user.home_lng.toString());
    } else if (sourceType === "Office") {
      if (!user.office_lat || !user.office_lng) {
        alert("Please update your Office location in your profile first.");
        router.push("/profile");
        return;
      }
      setStartName(user.office_name || "Office");
      setStartLat(user.office_lat.toString());
      setStartLng(user.office_lng.toString());
    }
  }, [sourceType, user, router]);

  useEffect(() => {
    if (destType === "Home") {
      if (!user.home_lat || !user.home_lng) {
        alert("Please update your Home location in your profile first.");
        router.push("/profile");
        return;
      }
      setDestName(user.home_name || "Home");
      setDestLat(user.home_lat.toString());
      setDestLng(user.home_lng.toString());
    } else if (destType === "Office") {
      if (!user.office_lat || !user.office_lng) {
        alert("Please update your Office location in your profile first.");
        router.push("/profile");
        return;
      }
      setDestName(user.office_name || "Office");
      setDestLat(user.office_lat.toString());
      setDestLng(user.office_lng.toString());
    }
  }, [destType, user, router]);

  const toggleDay = (dayIndex: number) => {
    if (recurringDays.includes(dayIndex)) {
      setRecurringDays(recurringDays.filter(d => d !== dayIndex));
    } else {
      setRecurringDays([...recurringDays, dayIndex].sort());
    }
  };

  const fillHistory = (post: any) => {
    setType(post.type);
    setStartName(post.start_name);
    setStartLat(post.start_lat.toString());
    setStartLng(post.start_lng.toString());
    setDestName(post.dest_name);
    setDestLat(post.dest_lat.toString());
    setDestLng(post.dest_lng.toString());
    setSourceType("Others");
    setDestType("Others");
    setIsRecurring(post.is_recurring);
    if (!post.is_recurring && post.date) {
      // Don't fill history date if it is in the past
      if (post.date >= new Date().toISOString().split('T')[0]) {
        setDate(post.date);
      }
    }
    else if (post.recurring_days) setRecurringDays(post.recurring_days);
    setTimeStart(post.time_start.slice(0,5));
    setTimeEnd(post.time_end.slice(0,5));
    setSeatsStr(post.seats.toString());
  };

  const fetchGeocode = async (query: string, isSource: boolean) => {
    if (!query) return;
    if (isSource) setFetchingSource(true);
    else setFetchingDest(true);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        if (isSource) {
          setStartLat(data[0].lat);
          setStartLng(data[0].lon);
        } else {
          setDestLat(data[0].lat);
          setDestLng(data[0].lon);
        }
      } else {
        alert("Could not find coordinates for this location.");
      }
    } catch (e) {
      alert("Error fetching location data.");
    } finally {
      if (isSource) setFetchingSource(false);
      else setFetchingDest(false);
    }
  };

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/carpool/post", {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel route");
      }
      onPostCreated(); 
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startLat || !startLng || !destLat || !destLng || !timeStart || !timeEnd) {
      setError("Please fill all location and time fields.");
      return;
    }
    if (!isRecurring && !date) {
      setError("Please select a date for your one-time trip.");
      return;
    }
    if (isRecurring && recurringDays.length === 0) {
      setError("Please select at least one day for your recurring commute.");
      return;
    }

    const { haversineDistanceMeters } = await import("@/lib/geo/haversine");
    const dist = haversineDistanceMeters(parseFloat(startLat), parseFloat(startLng), parseFloat(destLat), parseFloat(destLng));
    if (dist < 500) {
      const confirm = window.confirm("Your source and destination are very close to each other. Are you sure you want to proceed?");
      if (!confirm) return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/carpool/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          start_name: startName,
          start_lat: parseFloat(startLat),
          start_lng: parseFloat(startLng),
          dest_name: destName,
          dest_lat: parseFloat(destLat),
          dest_lng: parseFloat(destLng),
          date: isRecurring ? null : date,
          is_recurring: isRecurring,
          recurring_days: isRecurring ? recurringDays : null,
          time_start: timeStart,
          time_end: timeEnd,
          seats: parseInt(seatsStr, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create post");
      
      onPostCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card max-w-2xl mx-auto p-6 md:p-8 animate-scaleIn relative">
      <button 
        type="button"
        onClick={onCancel}
        className="btn btn-ghost btn-sm absolute top-4 right-4 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] z-10 sticky-back-btn"
        style={{ position: 'sticky', float: 'right', top: '1rem' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Feed
      </button>

      <h2 className="text-h2 mb-4">
        {initialData ? "Edit Carpool Route" : "Create a Carpool Route"}
      </h2>
      <p className="text-body-sm text-[var(--color-text-secondary)] mb-6">
        Set up your route to {type === "giver" ? "offer" : "request"} rides.
      </p>

      {history.length > 0 && !initialData && (
        <div className="mb-6">
          <span className="text-caption text-[var(--color-text-tertiary)] block mb-2">Quick Fill from Recent:</span>
          <div className="flex gap-2 flex-wrap">
            {history.map((post) => (
              <button 
                type="button"
                key={post.id} 
                onClick={() => fillHistory(post)}
                className="badge bg-[var(--color-surface-hover)] border border-[var(--color-border-light)] hover:border-[var(--color-primary)] transition-colors cursor-pointer text-xs py-1"
              >
                {post.start_name} → {post.dest_name}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setType("seeker")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
            type === "seeker" 
              ? "bg-[var(--color-primary)] text-white shadow-md" 
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
          }`}
        >
          Seeker (Need a ride)
        </button>
        <button
          type="button"
          onClick={() => setType("giver")}
          className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
            type === "giver" 
              ? "bg-[var(--color-accent)] text-white shadow-md" 
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]"
          }`}
        >
          Giver (Offering a ride)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-4 p-4 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border-light)]">
            <div className="flex flex-col gap-1">
              <span className="label">Source Location</span>
              <select className="input" value={sourceType} onChange={e => setSourceType(e.target.value as any)}>
                <option value="Home">Home</option>
                <option value="Office">Office</option>
                <option value="Others">Others</option>
              </select>
            </div>
            {sourceType === "Others" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="label">Source Name</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="input flex-1" 
                      value={startName} 
                      onChange={e => setStartName(e.target.value)} 
                      placeholder="e.g. L&T South City" 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => fetchGeocode(startName, true)}
                      disabled={fetchingSource || !startName}
                      className="btn btn-secondary whitespace-nowrap"
                    >
                      {fetchingSource ? "Fetching..." : "Fetch"}
                    </button>
                  </div>
                </label>
                <LocationPicker
                  legend="Source Map Pin"
                  lat={startLat}
                  lng={startLng}
                  onChange={(lat, lng) => {
                    setStartLat(lat);
                    setStartLng(lng);
                  }}
                />
              </>
            )}
          </div>

          <div className="flex justify-center -my-3 relative z-20">
            <button
              type="button"
              onClick={() => {
                const tempType = sourceType;
                const tempName = startName;
                const tempLat = startLat;
                const tempLng = startLng;
                setSourceType(destType);
                setStartName(destName);
                setStartLat(destLat);
                setStartLng(destLng);
                setDestType(tempType);
                setDestName(tempName);
                setDestLat(tempLat);
                setDestLng(tempLng);
              }}
              className="btn btn-secondary rounded-full w-10 h-10 p-0 flex items-center justify-center shadow-md bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:bg-[var(--color-surface-hover)] hover:text-primary transition-all group"
              title="Swap Locations"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:rotate-180 transition-transform duration-300">
                <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 p-4 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border-light)]">
             <div className="flex flex-col gap-1">
              <span className="label">Destination Location</span>
              <select className="input" value={destType} onChange={e => setDestType(e.target.value as any)}>
                <option value="Home">Home</option>
                <option value="Office">Office</option>
                <option value="Others">Others</option>
              </select>
            </div>
            {destType === "Others" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="label">Destination Name</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="input flex-1" 
                      value={destName} 
                      onChange={e => setDestName(e.target.value)} 
                      placeholder="e.g. Manyata Tech Park" 
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => fetchGeocode(destName, false)}
                      disabled={fetchingDest || !destName}
                      className="btn btn-secondary whitespace-nowrap"
                    >
                      {fetchingDest ? "Fetching..." : "Fetch"}
                    </button>
                  </div>
                </label>
                <LocationPicker
                  legend="Destination Map Pin"
                  lat={destLat}
                  lng={destLng}
                  onChange={(lat, lng) => {
                    setDestLat(lat);
                    setDestLng(lng);
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 md:col-span-2">
            <span className="label">Schedule Type</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="scheduleType" 
                  checked={!isRecurring} 
                  onChange={() => setIsRecurring(false)}
                  className="accent-[var(--color-primary)]"
                />
                <span className="text-body-sm">One-time Trip</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="scheduleType" 
                  checked={isRecurring} 
                  onChange={() => setIsRecurring(true)}
                  className="accent-[var(--color-primary)]"
                />
                <span className="text-body-sm">Recurring Commute</span>
              </label>
            </div>
          </div>

          {!isRecurring ? (
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="label">Date</span>
              <input 
                type="date" 
                className="input" 
                value={date}
                onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required={!isRecurring}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-1 md:col-span-2">
              <span className="label">Days of the Week</span>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((dayNum) => {
                  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  return (
                    <label key={dayNum} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${recurringDays.includes(dayNum) ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"}`}>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={recurringDays.includes(dayNum)}
                        onChange={() => toggleDay(dayNum)}
                      />
                      {days[dayNum]}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="label">{type === "giver" ? "Seats Available" : "Seats Needed"}</span>
            <input 
              type="number" 
              className="input" 
              min="1"
              max="10"
              value={seatsStr}
              onChange={e => setSeatsStr(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="label">Time Window (Start)</span>
            <input 
              type="time" 
              className="input" 
              value={timeStart}
              onChange={e => setTimeStart(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="label">Time Window (End)</span>
            <input 
              type="time" 
              className="input" 
              value={timeEnd}
              onChange={e => setTimeEnd(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="p-4 bg-[var(--color-primary-light)]/10 border border-[var(--color-primary-light)] rounded-lg text-sm text-[var(--color-text-secondary)]">
          <strong>Summary: </strong>
          {type === "giver" ? "Offering" : "Seeking"} {seatsStr} seat{parseInt(seatsStr)>1?'s':''} for travel from <em>{sourceType === "Others" ? startName : sourceType}</em> to <em>{destType === "Others" ? destName : destType}</em>, on {isRecurring ? "recurring days" : date}. Will wait between {timeStart} and {timeEnd}.
        </div>

        <div className="flex gap-4">
          {initialData && (
            <button 
              type="button" 
              onClick={() => onCancel()}
              disabled={loading}
              className="btn w-full btn-lg btn-ghost border border-[var(--color-border)] text-[var(--color-text-secondary)]"
            >
              Skip
            </button>
          )}
          <button 
            type="submit" 
            disabled={loading}
            className={`btn w-full btn-lg ${type === "giver" ? "btn-accent" : "btn-primary"} disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? "Updating..." : (initialData ? "Update Route" : `Post as ${type === "giver" ? "Giver" : "Seeker"}`)}
          </button>
        </div>
      </form>
    </div>
  );
}
