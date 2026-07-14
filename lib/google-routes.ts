import { env } from "process";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

/**
 * Decodes a Google encoded polyline string into an array of [lat, lng] coordinates.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Computes the route polyline using Google Routes API.
 */
export async function computeGoogleRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_MAPS_API_KEY is not defined. Skipping Google Routes API call.");
    return null;
  }

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.polyline,routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Google Routes API returned error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const encodedPolyline = data.routes?.[0]?.polyline?.encodedPolyline;
    return encodedPolyline || null;
  } catch (error) {
    console.error("Failed to compute Google Route:", error);
    return null;
  }
}

/**
 * Calculates the percentage of route1 (e.g. seeker's route) that overlaps with route2 (e.g. giver's route).
 * A point in route1 is considered overlapping if it is within thresholdMeters of any point in route2.
 * Returns a value between 0 and 1.
 */
export function computeRouteOverlap(
  route1: [number, number][],
  route2: [number, number][],
  thresholdMeters: number = 500
): number {
  if (route1.length === 0 || route2.length === 0) return 0;

  let overlappingPoints = 0;

  for (const [lat1, lng1] of route1) {
    let isNear = false;
    for (const [lat2, lng2] of route2) {
      if (haversineDistance(lat1, lng1, lat2, lng2) <= thresholdMeters) {
        isNear = true;
        break;
      }
    }
    if (isNear) {
      overlappingPoints++;
    }
  }

  return overlappingPoints / route1.length;
}
