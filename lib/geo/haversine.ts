const EARTH_RADIUS_M = 6371000;

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function jitterCoordinate(
  lat: number,
  lng: number,
  seed: string,
  maxOffsetMeters = 40
): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  const distance = (Math.abs(hash) % maxOffsetMeters) + 10;
  const dLat = (distance * Math.cos(angle)) / EARTH_RADIUS_M;
  const dLng =
    (distance * Math.sin(angle)) /
    (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180));
  return {
    lat: lat + (dLat * 180) / Math.PI,
    lng: lng + (dLng * 180) / Math.PI,
  };
}
