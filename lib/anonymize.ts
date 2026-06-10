import type { User } from "./types";

export function companyLogoUrl(company: string, storedUrl?: string | null): string {
  if (storedUrl) return storedUrl;
  const initials = company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const bg = encodeURIComponent(company.slice(0, 1).toUpperCase() || "C");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials || company)}&background=0D8ABC&color=fff&size=128`;
}

export function generateAlias(role: "resident" | "professional", index: number): string {
  const label = role === "resident" ? "Resident" : "Professional";
  return `${label}-${index}`;
}

export function resolveUserLocation(
  user: User,
  currentLat?: number | null,
  currentLng?: number | null
): { lat: number; lng: number } | null {
  if (user.active_location === "home" && user.home_lat != null && user.home_lng != null) {
    return { lat: Number(user.home_lat), lng: Number(user.home_lng) };
  }
  if (user.active_location === "office" && user.office_lat != null && user.office_lng != null) {
    return { lat: Number(user.office_lat), lng: Number(user.office_lng) };
  }
  if (currentLat != null && currentLng != null) {
    return { lat: currentLat, lng: currentLng };
  }
  if (user.home_lat != null && user.home_lng != null) {
    return { lat: Number(user.home_lat), lng: Number(user.home_lng) };
  }
  return null;
}
