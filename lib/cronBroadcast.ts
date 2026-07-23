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

export async function handleBroadcast(request: Request) {
  // Validate CRON secret (Vercel specific)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const isPreview = url.searchParams.get("preview") === "true";

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
    // Carpool and Jobs queries disabled
    globalCarpoolPosts = [];
    globalJobPosts = [];
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
  const previewMessages: { userId: string; message: string }[] = [];

  for (const user of users) {
    let message = "";
    
    if (broadcastType === "AM") {
      // 1. Priority 1: Carpool Match (Disabled)
      // 2. Priority 2: Jobs (Disabled)

      // 3. Fallback: Proximity Awareness
      if (!message) {
        let nearbyCount = 0;
        if (user.home_lat && user.home_lng) {
          nearbyCount = users.filter((u: any) => {
            if (!u.home_lat || !u.home_lng || u.id === user.id) return false;
            const dist = haversineDistanceMeters(Number(user.home_lat), Number(user.home_lng), Number(u.home_lat), Number(u.home_lng));
            return dist <= 2000;
          }).length;
        }

        if (nearbyCount < 3) {
          message = `🏘️ Only ${nearbyCount + 1} professional(s) are mapped in your 2km radius. Invite a neighbor to unlock your local network!`;
        } else {
          message = "👋 Good morning! There are verified tech professionals currently active in your neighborhood. Say hi on the local forum!";
        }
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
        let nearbyCount = 0;
        if (user.home_lat && user.home_lng) {
          nearbyCount = users.filter((u: any) => {
            if (!u.home_lat || !u.home_lng || u.id === user.id) return false;
            const dist = haversineDistanceMeters(Number(user.home_lat), Number(user.home_lng), Number(u.home_lat), Number(u.home_lng));
            return dist <= 2000;
          }).length;
        }

        if (nearbyCount < 3) {
          message = "🌐 Your neighborhood is quiet tonight. Strengthen your local network by sharing an anonymous invite.";
        } else {
          message = "🏢 Want to find mentors in your apartment building? Update your professional profile to unlock precise local matches.";
        }
      }
    }

    if (message) {
      if (isPreview) {
        previewMessages.push({ userId: user.id, message });
      } else {
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
  }

  if (isPreview) {
    return NextResponse.json({
      success: true,
      broadcastType,
      targetCount: previewMessages.length,
      messages: previewMessages,
    });
  }

  await Promise.allSettled(notificationPromises);

  return NextResponse.json({ success: true, broadcastType, notificationsSent });
}
