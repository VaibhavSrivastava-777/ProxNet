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

  let notificationsSent = 0;
  const notificationPromises = [];

  for (const user of users) {
    let message = "";
    
    if (broadcastType === "AM") {
      // 1. Priority 1: Carpool Match
      if (user.home_lat && user.home_lng && user.office_lat && user.office_lng) {
        const { data: carpoolPosts } = await supabase
          .from("carpool_posts")
          .select("*")
          .eq("status", "active")
          .neq("user_id", user.id);

        if (carpoolPosts && carpoolPosts.length > 0) {
          let exactMatches = 0;
          let onTheWayMatches = 0;

          const validMatches = carpoolPosts.filter(post => {
            const myRoute = haversineDistanceMeters(user.home_lat!, user.home_lng!, user.office_lat!, user.office_lng!);
            const postRoute = haversineDistanceMeters(post.start_lat, post.start_lng, post.dest_lat, post.dest_lng);
            const startDist = haversineDistanceMeters(user.home_lat!, user.home_lng!, post.start_lat, post.start_lng);
            const endDist = haversineDistanceMeters(user.office_lat!, user.office_lng!, post.dest_lat, post.dest_lng);
            
            if (startDist <= 1000 && endDist <= 1000) {
                exactMatches++;
                return true;
            }

            if (startDist > 2500) return false;

            let detour = 0;
            if (post.type === "giver") {
                // Post is Giver, User is Seeker. Detour is on the Post
                detour = startDist + myRoute + endDist - postRoute;
            } else if (post.type === "seeker") {
                // User is Giver, Post is Seeker. Detour is on the User
                detour = startDist + postRoute + endDist - myRoute;
            } else {
                // Safe fallback
                const detourPost = startDist + myRoute + endDist - postRoute;
                const detourUser = startDist + postRoute + endDist - myRoute;
                detour = Math.min(detourPost, detourUser);
            }

            if (detour <= 3000) {
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
        const { data: jobs } = await supabase
          .from("job_posts")
          .select("*, users(home_lat, home_lng)")
          .eq("status", "active")
          .neq("user_id", user.id);

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
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: forums } = await supabase
          .from("questions")
          .select("*")
          .eq("type", "forum")
          .eq("status", "open")
          .gte("created_at", yesterday.toISOString());

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
        const { data: targets } = await supabase
          .from("question_targets")
          .select("id")
          .eq("professional_id", user.id)
          .eq("status", "pending")
          .limit(1);

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
