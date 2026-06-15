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

  const { searchParams } = new URL(request.url);
  const radius = parseFloat(searchParams.get("radius") || "1000");
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lng = parseFloat(searchParams.get("lng") || "0");

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
  
  let myPost = activePosts && activePosts.length > 0 ? activePosts[0] : null;

  const nowMs = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  // Auto-expire myPost if it's past time_end + 1 hour and not recurring
  if (myPost && !myPost.is_recurring) {
    // Assuming local time for date parsing (YYYY-MM-DDTHH:MM:SS)
    const endDateTime = new Date(`${myPost.date}T${myPost.time_end}`);
    if (nowMs > endDateTime.getTime() + ONE_HOUR_MS) {
      await supabase.from("carpool_posts").update({ status: "expired" }).eq("id", myPost.id);
      myPost = null;
    }
  }

  // Update last_checked_matches_at
  if (myPost) {
    await supabase.from("carpool_posts").update({ last_checked_matches_at: new Date().toISOString() }).eq("id", myPost.id);
  }

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
    .eq("status", "active")
    .neq("user_id", user.id);

  // Removed targetType filtering to show all posts

  const { data: rawCandidates, error: candError } = await query;
  if (candError) return NextResponse.json({ error: candError.message }, { status: 500 });

  let candidates = rawCandidates || [];
  const expiredCandidateIds: string[] = [];

  candidates = candidates.filter((cand: any) => {
    if (cand.is_recurring) return true;
    const endDateTime = new Date(`${cand.date}T${cand.time_end}`);
    if (nowMs > endDateTime.getTime() + ONE_HOUR_MS) {
      expiredCandidateIds.push(cand.id);
      return false;
    }
    return true;
  });

  if (expiredCandidateIds.length > 0) {
    // We will fire the update at the end of the file
  }

  let filtered = [];

  if (!myPost) {
    // If no post, return all active posts within radius of current location (unless radius is -1)
    filtered = (candidates || []).map(cand => {
      const startDist = lat && lng ? haversineDistance(lat, lng, cand.start_lat, cand.start_lng) : 0;
      return { ...cand, distance: startDist, score: 0 };
    }).filter(cand => radius === -1 || cand.distance <= radius);
  } else {
    // Filter candidates by date/recurring logic
    const dateFilteredCandidates = (candidates || []).filter(cand => {
      if (!cand.is_recurring && cand.date < todayStr) return false;

      if (!myPost.is_recurring && !cand.is_recurring) {
        return myPost.date === cand.date;
      } else if (myPost.is_recurring && cand.is_recurring) {
        return myPost.recurring_days.some((d: number) => cand.recurring_days.includes(d));
      } else {
        const recurringPost = myPost.is_recurring ? myPost : cand;
        const oneTimePost = myPost.is_recurring ? cand : myPost;
        const oneTimeDate = new Date(oneTimePost.date + "T00:00:00Z");
        const oneTimeDay = oneTimeDate.getUTCDay();
        return recurringPost.recurring_days.includes(oneTimeDay);
      }
    });

    const myStartMins = timeToMinutes(myPost.time_start);
    const myEndMins = timeToMinutes(myPost.time_end);

    filtered = dateFilteredCandidates.map(candidate => {
      if (candidate.type === myPost.type) {
         return {
            ...candidate,
            score: -1,
            distance: haversineDistance(myPost.dest_lat, myPost.dest_lng, candidate.dest_lat, candidate.dest_lng)
         };
      }

      const giver = myPost.type === "giver" ? myPost : candidate;
      const seeker = myPost.type === "seeker" ? myPost : candidate;

      const dGiverRoute = haversineDistance(giver.start_lat, giver.start_lng, giver.dest_lat, giver.dest_lng);
      const dStart = haversineDistance(giver.start_lat, giver.start_lng, seeker.start_lat, seeker.start_lng);
      const dSeekerRoute = haversineDistance(seeker.start_lat, seeker.start_lng, seeker.dest_lat, seeker.dest_lng);
      const dEnd = haversineDistance(seeker.dest_lat, seeker.dest_lng, giver.dest_lat, giver.dest_lng);

      const detour = dStart + dSeekerRoute + dEnd - dGiverRoute;
      
      const candStartMins = timeToMinutes(candidate.time_start);
      const candEndMins = timeToMinutes(candidate.time_end);
      const timeOverlap = Math.max(0, Math.min(myEndMins, candEndMins) - Math.max(myStartMins, candStartMins));

      let score = 100;
      
      // Distance Penalty (1% per 50m of detour)
      const distancePenalty = Math.floor(detour / 50);
      score -= distancePenalty;

      // Time Penalty
      if (timeOverlap <= 0) {
        const timeGap = Math.max(myStartMins, candStartMins) - Math.min(myEndMins, candEndMins);
        // Deduct 1% per minute of gap
        score -= timeGap;
      }

      score = Math.max(0, Math.min(100, score));

      return {
        ...candidate,
        score,
        distance: haversineDistance(myPost.dest_lat, myPost.dest_lng, candidate.dest_lat, candidate.dest_lng)
      };
    }).sort((a, b) => b.score - a.score);
  }

  // 4. Get count of others of the same type
  // Use a simple fetch and filter for accurate count given the complex logic
  let othersCount = 0;
  if (myPost) {
    const { data: allSameType } = await supabase
      .from("carpool_posts")
      .select("id, date, is_recurring, recurring_days, time_end")
      .eq("status", "active")
      .eq("type", myPost.type)
      .neq("user_id", user.id);
      
    if (allSameType) {
      othersCount = allSameType.filter(post => {
        if (!post.is_recurring) {
          const endDateTime = new Date(`${post.date}T${post.time_end}`);
          if (nowMs > endDateTime.getTime() + ONE_HOUR_MS) {
            expiredCandidateIds.push(post.id);
            return false;
          }
          if (post.date < todayStr) return false;
        }
        
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

  if (expiredCandidateIds.length > 0) {
    // Fire and forget update for all expired candidates found in this request
    supabase.from("carpool_posts").update({ status: "expired" }).in("id", expiredCandidateIds).then();
  }

  let suggestions: any[] = [];
  if (user.home_lat && user.home_lng && user.office_lat && user.office_lng) {
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, full_name, company, job_title, profile_photo_url, home_lat, home_lng, office_lat, office_lng")
      .neq("id", user.id)
      .not("home_lat", "is", null)
      .not("office_lat", "is", null);
      
    if (allUsers) {
      suggestions = allUsers.map((u: any) => {
         const homeDist = haversineDistance(user.home_lat!, user.home_lng!, u.home_lat, u.home_lng);
         const officeDist = haversineDistance(user.office_lat!, user.office_lng!, u.office_lat, u.office_lng);
         const scoreHome = Math.max(0, 100 - (homeDist / 5000) * 100);
         const scoreOffice = Math.max(0, 100 - (officeDist / 5000) * 100);
         const score = Math.round((scoreHome + scoreOffice) / 2);
         return {
            user: {
              id: u.id,
              company: u.company,
              job_title: u.job_title,
              full_name: u.full_name,
              profile_photo_url: u.profile_photo_url
            },
            score,
            homeDist,
            officeDist
         };
      }).filter(s => s.score > 50).sort((a, b) => b.score - a.score).slice(0, 3);
    }
  }

  return NextResponse.json({ 
    posts: filtered, 
    myPost: myPost,
    othersCount,
    suggestions,
    requiresPost: false 
  });
}
