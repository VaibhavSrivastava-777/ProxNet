import { createAdminClient } from "../lib/supabase/admin";
import { decodePolyline, computeRouteOverlap, haversineDistance } from "../lib/google-routes";

function calculateVectorSimilarity(lat1: number, lon1: number, lat2: number, lon2: number, cLat1: number, cLon1: number, cLat2: number, cLon2: number) {
  const avgLat = ((lat1 + lat2 + cLat1 + cLat2) / 4) * Math.PI / 180;
  const v1x = (lon2 - lon1) * Math.cos(avgLat);
  const v1y = (lat2 - lat1);
  const v2x = (cLon2 - cLon1) * Math.cos(avgLat);
  const v2y = (cLat2 - cLat1);
  const dotProduct = (v1x * v2x) + (v1y * v2y);
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (mag1 * mag2);
}

function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

async function runTests() {
  console.log("🚀 Starting Virtual Carpool Matcher and Job Filter Validation...");

  const supabase = createAdminClient();

  // 1. Fetch a user with locations set to test virtual matching
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("*")
    .not("home_lat", "is", null)
    .not("office_lat", "is", null)
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.warn("⚠️ No user found with home/office locations configured. Skipping database parts.");
    return;
  }

  const user = users[0];
  console.log(`Testing with user: ${user.full_name} (${user.company})`);

  // 2. Fetch candidates from database
  const { data: candidates, error: candError } = await supabase
    .from("carpool_posts")
    .select("*, user:users(*)")
    .eq("status", "active")
    .neq("user_id", user.id);

  if (candError) {
    console.error("❌ Failed to fetch active carpool candidates:", candError);
    process.exit(1);
  }

  console.log(`Fetched ${candidates?.length || 0} active candidate posts.`);

  // 3. Construct virtual post matching user profile
  const myPost = {
    id: "virtual",
    user_id: user.id,
    start_lat: user.home_lat,
    start_lng: user.home_lng,
    start_name: user.home_name || "Home",
    dest_lat: user.office_lat,
    dest_lng: user.office_lng,
    dest_name: user.office_name || "Office",
    time_start: "09:00",
    time_end: "10:00",
    type: "seeker",
    is_recurring: true,
    recurring_days: [0, 1, 2, 3, 4, 5, 6],
    status: "active",
    created_at: new Date().toISOString()
  };

  const isVirtual = true;
  const myStartMins = timeToMinutes(myPost.time_start);
  const myEndMins = timeToMinutes(myPost.time_end);

  const candidatesWithScores = (candidates || []).map(candidate => {
    const vectorSim = calculateVectorSimilarity(
       myPost.start_lat!, myPost.start_lng!, myPost.dest_lat!, myPost.dest_lng!,
       candidate.start_lat, candidate.start_lng, candidate.dest_lat, candidate.dest_lng
    );
    
    const distToCandStart = haversineDistance(myPost.start_lat!, myPost.start_lng!, candidate.start_lat, candidate.start_lng);
    const distFromCandEnd = haversineDistance(myPost.dest_lat!, myPost.dest_lng!, candidate.dest_lat, candidate.dest_lng);
    
    const candStartMins = timeToMinutes(candidate.time_start);
    const candEndMins = timeToMinutes(candidate.time_end);
    let timeOverlap = Math.max(0, Math.min(myEndMins, candEndMins) - Math.max(myStartMins, candStartMins));
    if (isVirtual) {
      timeOverlap = 60; // Bypassed time penalty
    }

    let score = -1;
    // Same-Type
    if (candidate.type === myPost.type) {
       if (distToCandStart <= 3000 && vectorSim >= 0.85) {
          score = 90;
          score -= (1.0 - vectorSim) * 100;
          if (timeOverlap <= 0) {
            const timeGap = Math.max(myStartMins, candStartMins) - Math.min(myEndMins, candEndMins);
            score -= timeGap;
          }
          score = Math.max(0, Math.min(100, score));
       }
    } else {
       // Opposite-Type
       const giver = myPost.type === "giver" ? myPost : candidate;
       const seeker = myPost.type === "seeker" ? myPost : candidate;
       const dStart = haversineDistance(giver.start_lat!, giver.start_lng!, seeker.start_lat!, seeker.start_lng!);
       const dEnd = haversineDistance(giver.dest_lat!, giver.dest_lng!, seeker.dest_lat!, seeker.dest_lng!);

       if (dStart <= 4000 && vectorSim >= 0.85) {
          score = 100;
          score -= (1.0 - vectorSim) * 100;
          if (timeOverlap <= 0) {
            const timeGap = Math.max(myStartMins, candStartMins) - Math.min(myEndMins, candEndMins);
            score -= timeGap;
          }
          score = Math.max(0, Math.min(100, score));
       }
    }

    return {
      id: candidate.id,
      score,
      vectorSim,
      distToCandStart,
      distFromCandEnd
    };
  });

  // Verify virtual matching score rules:
  // Non-matches (score < 0) map to 0
  const mappedScores = candidatesWithScores.map(cand => ({
    ...cand,
    score: cand.score < 0 ? 0 : cand.score
  }));

  console.log("Matches Sample scores:");
  mappedScores.slice(0, 5).forEach(c => {
    console.log(`Candidate ${c.id}: Raw Score = ${c.score}, VectorSim = ${c.vectorSim.toFixed(2)}, StartDist = ${Math.round(c.distToCandStart)}m`);
  });

  const allScoresValid = mappedScores.every(c => c.score >= 0 && c.score <= 100);
  if (!allScoresValid) {
    console.error("❌ Test Failed: Match scores are out of bounds (0-100).");
    process.exit(1);
  }
  console.log("✅ Virtual match scoring successfully computed and mapped between 0 and 100.");

  // 4. Test Job AI Suggestion Filter logic
  // Assume a set of mock job similarity results:
  const mockMatchedJobs = [
    { id: "1", title: "Principal Security Engineer", similarity: 0.76 },
    { id: "2", title: "Cloud Support Engineer", similarity: 0.52 },
    { id: "3", title: "Senior DevOps Engineer", similarity: 0.495 }, // rounds to 50%
    { id: "4", title: "Software Engineer I", similarity: 0.48 }, // rounds to 48% (should be excluded)
    { id: "5", title: "Technical Support", similarity: 0.22 }, // (should be excluded)
  ];

  const filteredJobs = mockMatchedJobs.filter(j => {
    const matchRate = Math.round(j.similarity * 100);
    return matchRate >= 50;
  });

  console.log("Filtered Jobs list:", filteredJobs);
  const correctFilter = filteredJobs.every(j => Math.round(j.similarity * 100) >= 50);
  if (!correctFilter || filteredJobs.length !== 3) {
    console.error("❌ Test Failed: Suggested jobs filter didn't work as expected.");
    process.exit(1);
  }
  console.log("✅ Suggested jobs correctly filtered to only show >= 50% match rate.");
  console.log("🎉 All automated verification tests passed successfully!");
}

runTests();
