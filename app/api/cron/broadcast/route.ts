/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notifications";
import { haversineDistanceMeters } from "@/lib/geo/haversine";

// Helper to determine time of day (AM or PM broadcast)
// Based on current UTC time. IST is UTC+5:30.
// If it's around 01:30 UTC, it's 7:00 AM IST.
// If it's around 13:30 UTC, it's 7:00 PM IST.
// For now, we'll just check if UTC hour is < 10 for AM, else PM.
function getBroadcastType(): "AM" | "PM" {
  const utcHour = new Date().getUTCHours();
  return utcHour < 10 ? "AM" : "PM";
}

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

export const maxDuration = 60;

export async function GET(request: Request) {
  // Validate CRON secret (Vercel specific)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const broadcastType = getBroadcastType();

  // Fetch all active users with their locations
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, is_active, home_lat, home_lng, office_lat, office_lng")
    .eq("is_active", true);

  if (usersError || !users) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Pre-fetch all global data to avoid N+1 queries in the loop
  let globalCarpoolPosts: any[] = [];
  let globalJobPosts: any[] = [];
  let globalForums: any[] = [];
  let globalTargets: any[] = [];

  if (broadcastType === "AM") {
    const [carpoolsRes, jobsRes] = await Promise.all([
      supabase.from("carpool_posts").select("*").eq("status", "active"),
      supabase.from("job_posts").select("*, users(home_lat, home_lng)").eq("status", "active")
    ]);
    globalCarpoolPosts = carpoolsRes.data || [];
    globalJobPosts = jobsRes.data || [];
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const [forumsRes, targetsRes] = await Promise.all([
      supabase.from("questions").select("*").eq("type", "forum").eq("status", "open").gte("created_at", yesterday.toISOString()),
      supabase.from("question_targets").select("id, professional_id").eq("status", "pending")
    ]);
    globalForums = forumsRes.data || [];
    globalTargets = targetsRes.data || [];
  }

  let notificationsSent = 0;
  const notificationPromises = [];

  for (const user of users) {
    let message = "";
    
    if (broadcastType === "AM") {
      // 1. Priority 1: Carpool Match
      if (user.home_lat && user.home_lng && user.office_lat && user.office_lng) {
        const carpoolPosts = globalCarpoolPosts.filter((p: any) => p.user_id !== user.id);

        if (carpoolPosts && carpoolPosts.length > 0) {
          let exactMatches = 0;
          let onTheWayMatches = 0;

          const validMatches = carpoolPosts.filter(post => {
            const startDist = haversineDistanceMeters(user.home_lat!, user.home_lng!, post.start_lat, post.start_lng);
            const endDist = haversineDistanceMeters(user.office_lat!, user.office_lng!, post.dest_lat, post.dest_lng);
            
            if (startDist <= 1000 && endDist <= 1000) {
                exactMatches++;
                return true;
            }

            const vectorSim = calculateVectorSimilarity(
              user.home_lat!, user.home_lng!, user.office_lat!, user.office_lng!,
              post.start_lat, post.start_lng, post.dest_lat, post.dest_lng
            );

            if (startDist <= 4000 && vectorSim >= 0.85) {
                onTheWayMatches++;
                return true;
            }

            return false;
          });

          if (exactMatches > 0) {
            message = `🚗 ${exactMatches} verified professional(s) are sharing your exact commute today. Tap to ride together.`;
          } else if (onTheWayMatches > 0) {
            message = `🚗 A neighbor's commute is right on your way! A minor detour could let you share the ride and split costs.`;
          }
        }
      }

      // 2. Priority 2: Jobs
      if (!message && user.home_lat && user.home_lng) {
        const jobs = globalJobPosts.filter((j: any) => j.user_id !== user.id);

        if (jobs && jobs.length > 0) {
          const localJobs = jobs.filter(job => {
            if (!job.users?.home_lat || !job.users?.home_lng) return false;
            const dist = haversineDistanceMeters(user.home_lat!, user.home_lng!, job.users.home_lat, job.users.home_lng);
            return dist <= 5000; // 5km radius for jobs
          });

          if (localJobs.length > 0) {
            const randomJob = localJobs[Math.floor(Math.random() * localJobs.length)];
            const typeText = randomJob.type === "giver" ? "give a referral" : "find a role";
            const companyText = randomJob.company ? ` at ${randomJob.company}` : "";
            message = `💼 A neighbor${companyText} is looking to ${typeText} today. Check it out before you start work.`;
          }
        }
      }

      // 3. Fallback: Proximity Awareness
      if (!message) {
        message = "👋 Good morning! There are verified tech professionals currently active in your neighborhood. Say hi on the local forum!";
      }
    } else {
      // PM Broadcast
      // 1. Priority 1: Local Forum
      if (user.home_lat && user.home_lng) {
        const forums = globalForums;

        if (forums && forums.length > 0) {
          const localForums = forums.filter(f => {
            const dist = haversineDistanceMeters(user.home_lat!, user.home_lng!, f.center_lat, f.center_lng);
            return dist <= f.radius_meters;
          });

          if (localForums.length > 0) {
            // Pick most liked or random
            const bestForum = localForums.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))[0];
            message = `🗣️ Hot topic nearby: "${bestForum.body.slice(0, 40)}..." Join the discussion anonymously.`;
          }
        }
      }

      // 2. Priority 2: Direct Q&A Targets
      if (!message) {
        const targets = globalTargets.filter((t: any) => t.professional_id === user.id);

        if (targets && targets.length > 0) {
          message = "❓ A neighbor specifically asked for your expertise today. Can you help them out?";
        }
      }

      // 3. Fallback
      if (!message) {
        message = "🏢 Want to find mentors in your apartment building? Update your professional profile to unlock precise local matches.";
      }
    }

    if (message) {
      notificationPromises.push(
        sendNotification(user.id, {
          title: broadcastType === "AM" ? "ProxNet Morning Match" : "ProxNet Evening Wrap-up",
          body: message,
          url: "/"
        }).then(() => {
          notificationsSent++;
        }).catch((e) => {
          console.error(`Failed to send push to user ${user.id}`, e);
        })
      );
    }
  }

  await Promise.allSettled(notificationPromises);

  return NextResponse.json({ success: true, broadcastType, notificationsSent });
}
