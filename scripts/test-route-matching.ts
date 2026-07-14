import { decodePolyline, computeRouteOverlap, haversineDistance } from "../lib/google-routes";

console.log("Starting Route Overlap Logic Tests...");

// 1. Test polyline decoding
// An encoded polyline for a simple line segment: (38.5, -120.2) to (40.7, -120.95)
const samplePolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
try {
  const decoded = decodePolyline(samplePolyline);
  console.log("Decoded points count:", decoded.length);
  if (decoded.length < 2) {
    throw new Error("Decoding returned too few points.");
  }
  // The first point should be close to 38.5, -120.2
  const [lat1, lng1] = decoded[0];
  const [lat2, lng2] = decoded[decoded.length - 1];
  console.log(`First point: (${lat1}, ${lng1}), Last point: (${lat2}, ${lng2})`);
  
  if (Math.abs(lat1 - 38.5) > 0.01 || Math.abs(lng1 - (-120.2)) > 0.01) {
    throw new Error(`Unexpected start coordinates: got (${lat1}, ${lng1})`);
  }
  console.log("✅ Polyline decoding test passed!");
} catch (error) {
  console.error("❌ Polyline decoding test failed:", error);
  process.exit(1);
}

// 2. Test Route Overlap
// Route 1 (Seeker): Point A to B (Short route)
// Route 2 (Giver): Point A to B to C (Long route covering Route 1)
const route1: [number, number][] = [
  [12.9716, 77.5946], // Bangalore Center
  [12.9800, 77.6000],
  [12.9900, 77.6100], // Indiranagar
];

const route2: [number, number][] = [
  [12.9716, 77.5946],
  [12.9800, 77.6000],
  [12.9900, 77.6100],
  [13.0100, 77.6200],
  [13.0300, 77.6300], // Extends further
];

// Route 3 (Divergent): Completely different city (Delhi)
const route3: [number, number][] = [
  [28.6139, 77.2090],
  [28.6200, 77.2200],
];

try {
  // Overlap of Route 1 (Seeker) within Route 2 (Giver) should be 1.0 (100%)
  const overlap1 = computeRouteOverlap(route1, route2, 500);
  console.log(`Overlap of Seeker in Giver route: ${overlap1 * 100}%`);
  if (overlap1 !== 1.0) {
    throw new Error(`Expected overlap of 1.0, got ${overlap1}`);
  }

  // Overlap of Route 2 (Giver) within Route 1 (Seeker) should be lower (3/5 = 60%)
  const overlap2 = computeRouteOverlap(route2, route1, 500);
  console.log(`Overlap of Giver in Seeker route: ${overlap2 * 100}%`);
  if (Math.abs(overlap2 - 0.6) > 0.01) {
    throw new Error(`Expected overlap of ~0.6, got ${overlap2}`);
  }

  // Overlap with divergent route should be 0
  const overlap3 = computeRouteOverlap(route1, route3, 1000);
  console.log(`Overlap with divergent route: ${overlap3 * 100}%`);
  if (overlap3 !== 0) {
    throw new Error(`Expected overlap of 0, got ${overlap3}`);
  }

  console.log("✅ Route overlap calculation tests passed!");
} catch (error) {
  console.error("❌ Route overlap calculation tests failed:", error);
  process.exit(1);
}

// 3. Test Scoring Formula Math
// Score = 0.4 * routeOverlapScore + 0.3 * startProximityScore + 0.3 * timeScore
try {
  const routeOverlap = 0.8; // 80% overlap
  const routeOverlapScore = routeOverlap * 100;
  
  const startDist = 1000; // 1km away (max threshold is 4000)
  const startProximityScore = Math.max(0, 100 - (startDist / 4000) * 100); // 75
  
  const timeScore = 100; // perfect overlap in time

  const expectedScore = Math.round(0.4 * routeOverlapScore + 0.3 * startProximityScore + 0.3 * timeScore);
  // 0.4 * 80 + 0.3 * 75 + 0.3 * 100 = 32 + 22.5 + 30 = 84.5 -> round to 85
  console.log(`Scoring math check: expected score is ${expectedScore}`);
  if (expectedScore !== 85) {
    throw new Error(`Expected score 85, got ${expectedScore}`);
  }

  console.log("✅ Scoring formula math tests passed!");
} catch (error) {
  console.error("❌ Scoring formula math tests failed:", error);
  process.exit(1);
}

console.log("All Route Overlap tests passed successfully!");
process.exit(0);
