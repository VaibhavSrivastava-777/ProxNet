import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Get user's active post
  const { data: activePosts, error: activeError } = await supabase
    .from("carpool_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });
  
  if (!activePosts || activePosts.length === 0) {
    return NextResponse.json({ posts: [], requiresPost: true });
  }

  const myPost = activePosts[0];
  const targetType = myPost.type === "giver" ? "seeker" : "giver";

  // 2. Fetch all active candidates of the opposite type
  const todayStr = new Date().toISOString().split('T')[0];

  let query = supabase
    .from("carpool_posts")
    .select(`
      *,
      user:users (
        id,
        company,
        job_title
      )
    `)
    .eq("type", targetType)
    .eq("status", "active")
    .neq("user_id", user.id);

  if (targetType === "giver") {
    // I am a seeker, I need a giver with enough seats
    query = query.gte("seats", myPost.seats);
  } else {
    // I am a giver, I need a seeker who needs seats <= what I have
    query = query.lte("seats", myPost.seats);
  }

  const { data: candidates, error: candError } = await query;
  if (candError) return NextResponse.json({ error: candError.message }, { status: 500 });

  // Filter candidates by date/recurring logic
  const dateFilteredCandidates = (candidates || []).filter(cand => {
    // 1. Cand must be today or future if one-time
    if (!cand.is_recurring && cand.date < todayStr) return false;

    // 2. Check overlap
    if (!myPost.is_recurring && !cand.is_recurring) {
      return myPost.date === cand.date;
    } else if (myPost.is_recurring && cand.is_recurring) {
      return myPost.recurring_days.some((d: number) => cand.recurring_days.includes(d));
    } else {
      // One is recurring, one is not
      const recurringPost = myPost.is_recurring ? myPost : cand;
      const oneTimePost = myPost.is_recurring ? cand : myPost;
      // Note: assumes YYYY-MM-DD
      const oneTimeDate = new Date(oneTimePost.date + "T00:00:00Z");
      const oneTimeDay = oneTimeDate.getUTCDay(); // 0=Sun, 1=Mon, etc
      return recurringPost.recurring_days.includes(oneTimeDay);
    }
  });

  // 3. Calculate Scores
  const myStartMins = timeToMinutes(myPost.time_start);
  const myEndMins = timeToMinutes(myPost.time_end);

  const scoredCandidates = dateFilteredCandidates.map(candidate => {
    const destDist = haversineDistance(myPost.dest_lat, myPost.dest_lng, candidate.dest_lat, candidate.dest_lng);
    const startDist = haversineDistance(myPost.start_lat, myPost.start_lng, candidate.start_lat, candidate.start_lng);
    
    const candStartMins = timeToMinutes(candidate.time_start);
    const candEndMins = timeToMinutes(candidate.time_end);

    const timeOverlap = Math.max(0, Math.min(myEndMins, candEndMins) - Math.max(myStartMins, candStartMins));
    const timeGap = timeOverlap > 0 ? 0 : Math.max(myStartMins, candStartMins) - Math.min(myEndMins, candEndMins);

    let score = 0;

    // Both start and dest should be reasonably close. Let's use dest distance as the primary anchor, but start distance must not be crazy far.
    // If start is > 5km apart, probably a bad match regardless.
    if (startDist <= 5000) {
      if (destDist <= 300 && timeOverlap > 0) {
        score = 100;
      } else if (destDist <= 1000 && (timeOverlap > 0 || timeGap <= 60)) {
        score = 75;
      } else if (destDist <= 3000 && timeGap <= 120) {
        score = 50;
      }
    }

    return {
      ...candidate,
      score,
      distance: destDist
    };
  });

  const filtered = scoredCandidates
    .filter(c => c.score >= 40)
    .sort((a, b) => b.score - a.score);

  // 4. Get count of others of the same type
  // Use a simple fetch and filter for accurate count given the complex logic
  let othersCount = 0;
  if (myPost) {
    const { data: allSameType } = await supabase
      .from("carpool_posts")
      .select("id, date, is_recurring, recurring_days")
      .eq("status", "active")
      .eq("type", myPost.type)
      .neq("user_id", user.id);
      
    if (allSameType) {
      othersCount = allSameType.filter(post => {
        if (!post.is_recurring && post.date < todayStr) return false;
        
        if (!myPost.is_recurring && !post.is_recurring) {
          return myPost.date === post.date;
        } else if (myPost.is_recurring && post.is_recurring) {
          return myPost.recurring_days.some((d: number) => post.recurring_days.includes(d));
        } else {
          const recurringPost = myPost.is_recurring ? myPost : post;
          const oneTimePost = myPost.is_recurring ? post : myPost;
          const oneTimeDate = new Date(oneTimePost.date + "T00:00:00Z");
          const oneTimeDay = oneTimeDate.getUTCDay();
          return recurringPost.recurring_days.includes(oneTimeDay);
        }
      }).length;
    }
  }

  return NextResponse.json({ 
    posts: filtered, 
    myPost: myPost,
    othersCount,
    requiresPost: false 
  });
}
