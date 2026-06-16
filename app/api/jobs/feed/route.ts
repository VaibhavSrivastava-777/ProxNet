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

  // 1. Get user's active post
  const { data: activePosts, error: activeError } = await supabase
    .from("job_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });
  
  let myPost = activePosts && activePosts.length > 0 ? activePosts[0] : null;

  const nowMs = Date.now();
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  // Auto-expire myPost if it's older than 1 month
  if (myPost) {
    const createdTime = new Date(myPost.created_at).getTime();
    if (nowMs - createdTime > ONE_MONTH_MS) {
      await supabase.from("job_posts").update({ status: "expired" }).eq("id", myPost.id);
      myPost = null;
    }
  }

  if (myPost) {
    await supabase.from("job_posts").update({ last_checked_matches_at: new Date().toISOString() }).eq("id", myPost.id);
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

  if (myPost) {
    const targetType = myPost.type === "giver" ? "seeker" : "giver";
    query = query.eq("type", targetType);
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

    let score = 0;
    if (myPost) {
      const myRoleWords = (myPost.role || "").toLowerCase().split(/\W+/);
      const candRoleWords = (cand.role || "").toLowerCase().split(/\W+/);

      // Intersection of role words
      const roleOverlap = myRoleWords.filter((w: string) => candRoleWords.includes(w)).length;
      if (roleOverlap > 0) score += 50;

      // Intersection of skills words
      const mySkillsWords = (myPost.skills || "").toLowerCase().split(/\W+/);
      const candSkillsWords = (cand.skills || "").toLowerCase().split(/\W+/);
      const skillsOverlap = mySkillsWords.filter((w: string) => candSkillsWords.includes(w)).length;
      if (skillsOverlap > 0) score += (skillsOverlap * 10);
      
      score = Math.min(100, score);
    }

    return {
      ...cand,
      score,
      distance
    };
  });

  // Filter by radius (exclude if distance > radius, unless distance is unknown or radius is -1)
  let filtered = scoredCandidates.filter((c: any) => radius === -1 || c.distance === -1 || c.distance <= radius);

  // Sort: if myPost exists, sort by match % descending. Else sort by created_at descending.
  if (myPost) {
    filtered = filtered.sort((a, b) => b.score - a.score);
  } else {
    filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // 4. Get count of others of the same type
  let othersCount = 0;
  if (myPost) {
    const { count, error: countError } = await supabase
      .from("job_posts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("type", myPost.type)
      .neq("user_id", user.id);
      
    if (!countError && count) {
      othersCount = count;
    }
  }

  return NextResponse.json({ 
    posts: filtered, 
    myPost: myPost,
    othersCount,
    requiresPost: false,
    currentUserId: user.id
  });
}
