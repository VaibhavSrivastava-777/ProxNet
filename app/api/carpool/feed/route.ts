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

function calculateVectorSimilarity(lat1: number, lon1: number, lat2: number, lon2: number, cLat1: number, cLon1: number, cLat2: number, cLon2: number) {
  // Convert lat/lng to approximate Cartesian vectors
  // Use average latitude to scale longitude difference
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
    const timeEndStr = myPost.time_end.length === 5 ? myPost.time_end + ":00" : myPost.time_end;
    const endDateTime = new Date(`${myPost.date}T${timeEndStr}+05:30`);
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
        job_title,
        home_name,
        office_name,
        home_lat,
        home_lng,
        office_lat,
        office_lng
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
    const timeEndStr = cand.time_end.length === 5 ? cand.time_end + ":00" : cand.time_end;
    const endDateTime = new Date(`${cand.date}T${timeEndStr}+05:30`);
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
      // Vector Cosine Similarity
      const vectorSim = calculateVectorSimilarity(
         myPost.start_lat, myPost.start_lng, myPost.dest_lat, myPost.dest_lng,
         candidate.start_lat, candidate.start_lng, candidate.dest_lat, candidate.dest_lng
      );
      
      const distToCandStart = haversineDistance(myPost.start_lat, myPost.start_lng, candidate.start_lat, candidate.start_lng);
      const distFromCandEnd = haversineDistance(myPost.dest_lat, myPost.dest_lng, candidate.dest_lat, candidate.dest_lng);
      
      const candStartMins = timeToMinutes(candidate.time_start);
      const candEndMins = timeToMinutes(candidate.time_end);
      const timeOverlap = Math.max(0, Math.min(myEndMins, candEndMins) - Math.max(myStartMins, candStartMins));

      // 1. Same-Type Matching (Splitting a cab / Two Drivers)
      if (candidate.type === myPost.type) {
         if (distToCandStart <= 3000 && vectorSim >= 0.85) {
            let score = 90; 
            
            // Vector Sim penalty
            score -= (1.0 - vectorSim) * 100;

            if (timeOverlap <= 0) {
              const timeGap = Math.max(myStartMins, candStartMins) - Math.min(myEndMins, candEndMins);
              score -= timeGap;
            }

            score = Math.max(0, Math.min(100, score));

            return {
               ...candidate,
               score,
               distance: distFromCandEnd,
               vector_sim: vectorSim,
               match_type: "vector_match",
               sameTypeMatch: true
            };
         }

         return {
            ...candidate,
            score: -1,
            distance: distFromCandEnd
         };
      }

      // 2. Opposite-Type Matching (Giver vs Seeker)
      const giver = myPost.type === "giver" ? myPost : candidate;
      const seeker = myPost.type === "seeker" ? myPost : candidate;

      const dStart = haversineDistance(giver.start_lat, giver.start_lng, seeker.start_lat, seeker.start_lng);
      const dEnd = haversineDistance(giver.dest_lat, giver.dest_lng, seeker.dest_lat, seeker.dest_lng);

      // Filter out if starting points are too far or vector similarity is too low
      if (dStart > 4000 || vectorSim < 0.85) {
        return {
           ...candidate,
           score: -1,
           distance: dEnd
        };
      }

      let score = 100;
      
      // Vector Sim penalty
      score -= (1.0 - vectorSim) * 100;

      // Time Penalty
      if (timeOverlap <= 0) {
        const timeGap = Math.max(myStartMins, candStartMins) - Math.min(myEndMins, candEndMins);
        score -= timeGap;
      }

      score = Math.max(0, Math.min(100, score));

      return {
        ...candidate,
        score,
        distance: dEnd,
        vector_sim: vectorSim,
        match_type: "vector_match"
      };
    }).filter(cand => cand.score >= 0).sort((a, b) => b.score - a.score);
  }

  // --- AI Summary Logic ---
  // Count how many AI threads were created for each post to populate ai_summary
  const postIds = [myPost?.id, ...filtered.map(p => p.id)].filter(Boolean);
  if (postIds.length > 0) {
    const { data: aiThreads } = await supabase
      .from("carpool_threads")
      .select("post_id")
      .in("post_id", postIds);
      
    if (aiThreads) {
      const threadCounts: Record<string, number> = {};
      aiThreads.forEach(t => {
        threadCounts[t.post_id] = (threadCounts[t.post_id] || 0) + 1;
      });

      if (myPost && threadCounts[myPost.id]) {
        myPost.ai_summary = `Sent DMs to ${threadCounts[myPost.id]} professional${threadCounts[myPost.id] > 1 ? 's' : ''} along this route who might need a ride.`;
      }
      filtered.forEach(p => {
        if (threadCounts[p.id]) {
          p.ai_summary = `Sent DMs to ${threadCounts[p.id]} professional${threadCounts[p.id] > 1 ? 's' : ''} along this route who might need a ride.`;
        }
      });
    }
  }
  // ------------------------

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
          const scoreHome = Math.max(0, 100 - (homeDist / 1000) * 100);
         const scoreOffice = Math.max(0, 100 - (officeDist / 1000) * 100);
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
            officeDist,
            ai_suggestion: "" // to be filled
         };
      }).filter(s => s.homeDist <= 1000 && s.officeDist <= 1000).sort((a, b) => b.score - a.score).slice(0, 3);
      
      // Generate AI suggestions for the top matches
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (suggestions.length > 0 && OPENAI_KEY) {
        try {
          await Promise.all(suggestions.map(async (s) => {
            const prompt = `You are a helpful carpool matchmaking AI. 
            The current user is looking for potential carpool matches. 
            A candidate named ${s.user.full_name} (${s.user.job_title} at ${s.user.company}) lives ${Math.round(s.homeDist)} meters from the user's home, and works ${Math.round(s.officeDist)} meters from the user's office.
            
            Write exactly ONE brief, conversational, persuasive sentence suggesting they share a ride. Do not use quotes.
            Example: "Alex from Acme Corp lives just 500m away and works 200m from your office, maybe you two could share a ride!"`;

            const completionRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { 
                "Authorization": `Bearer ${OPENAI_KEY}`, 
                "Content-Type": "application/json" 
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 60,
                temperature: 0.7,
              })
            });

            if (completionRes.ok) {
              const oaiData = await completionRes.json();
              s.ai_suggestion = oaiData.choices[0]?.message?.content?.trim() || `Maybe you could share a ride with ${s.user.full_name} from ${s.user.company}.`;
            } else {
              s.ai_suggestion = `Maybe you could share a ride with ${s.user.full_name} from ${s.user.company}.`;
            }
          }));
        } catch (e) {
          console.error("Failed to generate AI carpool suggestions:", e);
        }
      }
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
