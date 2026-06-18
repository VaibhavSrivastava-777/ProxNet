import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const radius = parseFloat(searchParams.get("radius") || "1000");
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

  const supabase = createAdminClient();

  // 1. Get user's active posts
  const { data: activePosts, error: activeError } = await supabase
    .from("job_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });
  
  let myPosts = activePosts || [];

  const nowMs = Date.now();
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  // Auto-expire posts older than 1 month
  const expiredMyPostIds: string[] = [];
  myPosts = myPosts.filter((post: any) => {
    const createdTime = new Date(post.created_at).getTime();
    if (nowMs - createdTime > ONE_MONTH_MS) {
      expiredMyPostIds.push(post.id);
      return false;
    }
    return true;
  });

  if (expiredMyPostIds.length > 0) {
    await supabase.from("job_posts").update({ status: "expired" }).in("id", expiredMyPostIds);
  }

  if (myPosts.length > 0) {
    await supabase.from("job_posts").update({ last_checked_matches_at: new Date().toISOString() }).in("id", myPosts.map(p => p.id));
  }

  // 2. Fetch active candidates
  let query = supabase
    .from("job_posts")
    .select(`
      *,
      user:users (
        id,
        company,
        job_title
      )
    `)
    .eq("status", "active")
    .neq("user_id", user.id);

  if (myPosts.length > 0) {
    // Determine target types based on my posts
    // If I have a giver post, I want to see seekers. If I have a seeker post, I want to see givers.
    const myTypes = new Set(myPosts.map(p => p.type));
    const targetTypes = [];
    if (myTypes.has("giver")) targetTypes.push("seeker");
    if (myTypes.has("seeker")) targetTypes.push("giver");
    query = query.in("type", targetTypes);
  }

  const { data: rawCandidates, error: candError } = await query;
  if (candError) return NextResponse.json({ error: candError.message }, { status: 500 });

  let candidates = rawCandidates || [];
  const expiredCandidateIds: string[] = [];

  candidates = candidates.filter((cand: any) => {
    const createdTime = new Date(cand.created_at).getTime();
    if (nowMs - createdTime > ONE_MONTH_MS) {
      expiredCandidateIds.push(cand.id);
      return false;
    }
    return true;
  });

  if (expiredCandidateIds.length > 0) {
    await supabase.from("job_posts").update({ status: "expired" }).in("id", expiredCandidateIds);
  }

  // 3. Fetch current locations for these candidates to calculate distance
  const userIds = candidates ? Array.from(new Set(candidates.map((c: any) => c.user_id))) : [];
  let userLocations: Record<string, {lat: number, lng: number}> = {};
  
  if (userIds.length > 0) {
    const { data: locs } = await supabase
      .from("user_current_locations")
      .select("user_id, lat, lng")
      .in("user_id", userIds);
      
    if (locs) {
      for (const loc of locs) {
        userLocations[loc.user_id] = { lat: loc.lat, lng: loc.lng };
      }
    }
  }

  // Haversine formula
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // 4. Filter by radius and calculate Scores
  const scoredCandidates = (candidates || []).map((cand: any) => {
    const candLoc = userLocations[cand.user_id];
    let distance = -1;
    if (lat && lng && candLoc) {
      distance = haversineDistance(lat, lng, candLoc.lat, candLoc.lng);
    }

    let maxScore = 0;
    if (myPosts.length > 0) {
      // Find the best match score among all my valid opposite posts
      const candRoleWords = (cand.role || "").toLowerCase().split(/\W+/);
      const candSkillsWords = (cand.skills || "").toLowerCase().split(/\W+/);

      for (const myPost of myPosts) {
        // Only score against posts of the opposite type
        if ((myPost.type === "giver" && cand.type === "seeker") || (myPost.type === "seeker" && cand.type === "giver")) {
          let score = 0;
          const myRoleWords = (myPost.role || "").toLowerCase().split(/\W+/);
          // Intersection of role words
          const roleOverlap = myRoleWords.filter((w: string) => candRoleWords.includes(w)).length;
          if (roleOverlap > 0) score += 50;

          // Intersection of skills words
          const mySkillsWords = (myPost.skills || "").toLowerCase().split(/\W+/);
          const skillsOverlap = mySkillsWords.filter((w: string) => candSkillsWords.includes(w)).length;
          if (skillsOverlap > 0) score += (skillsOverlap * 10);
          
          score = Math.min(100, score);
          if (score > maxScore) maxScore = score;
        }
      }
    }

    return {
      ...cand,
      score: maxScore,
      distance
    };
  });

  // Filter by radius (exclude if distance > radius, unless distance is unknown or radius is -1)
  let filtered = scoredCandidates.filter((c: any) => radius === -1 || c.distance === -1 || c.distance <= radius);

  // Sort: if myPosts exist, sort by match % descending. Else sort by created_at descending.
  if (myPosts.length > 0) {
    filtered = filtered.sort((a, b) => b.score - a.score);
  } else {
    filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return NextResponse.json({ 
    posts: filtered, 
    myPosts: myPosts,
    othersCount: candidates.length, // Just return total candidate count since there could be multiple types
    requiresPost: false,
    currentUserId: user.id
  });
}
