import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Web Push
webPush.setVapidDetails(
  process.env.NEXT_PUBLIC_VAPID_SUBJECT || "mailto:your-email@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function runTestBroadcast() {
  console.log("Fetching target user...");
  const { data: users, error } = await supabase.from("users").select("*").eq("is_active", true).eq("email", "vaibhav.srivastava@iiml.org");

  if (error || !users || users.length === 0) {
    console.error("Failed to fetch target user:", error);
    return;
  }

  const { data: allCurrentLocations } = await supabase.from("user_current_locations").select("*");
  const locationMap = new Map((allCurrentLocations ?? []).map((l) => [l.user_id, { lat: Number(l.lat), lng: Number(l.lng) }]));

  console.log(`Found ${users.length} active users. Processing proximity...`);

  const radiusMeters = 2000; // 2km

  for (const user of users) {
    let lat = locationMap.get(user.id)?.lat ?? user.home_lat ?? user.office_lat;
    let lng = locationMap.get(user.id)?.lng ?? user.home_lng ?? user.office_lng;

    let messageBody = "Check out your daily network digest on ProxNet!";

    if (lat != null && lng != null) {
      let professionals = 0;
      const companies = new Set<string>();

      for (const u of users) {
        if (u.id === user.id) continue;
        const visibility = u.visibility as any;
        if (!visibility?.showCompany || !u.company?.trim()) continue;

        const current = locationMap.get(u.id);
        const locsToCheck = [];
        if (u.home_lat != null && u.home_lng != null) locsToCheck.push({ lat: Number(u.home_lat), lng: Number(u.home_lng) });
        if (u.office_lat != null && u.office_lng != null) locsToCheck.push({ lat: Number(u.office_lat), lng: Number(u.office_lng) });
        if (current?.lat != null && current?.lng != null) locsToCheck.push({ lat: current.lat, lng: current.lng });

        let minDistance = Infinity;
        for (const loc of locsToCheck) {
          const distance = haversineDistanceMeters(Number(lat), Number(lng), loc.lat, loc.lng);
          if (distance <= radiusMeters && distance < minDistance) {
            minDistance = distance;
          }
        }

        if (minDistance <= radiusMeters) {
          professionals++;
          companies.add(u.company.trim());
        }
      }

      if (professionals > 0) {
        const topCompanies = Array.from(companies).slice(0, 3).join(", ");
        messageBody = `Within 2kms, you are connected to ${professionals} professionals from ${companies.size} companies such as ${topCompanies}.`;
      } else {
        messageBody = "You are currently the first professional in your 2km radius! Invite others to unlock your local network.";
      }
    }

    const payload = JSON.stringify({
      title: "ProxNet Network Update 📍",
      body: messageBody,
      url: "/proximity"
    });

    // 1. Insert into in_app_notifications
    await supabase.from("in_app_notifications").insert({
      user_id: user.id,
      title: "ProxNet Network Update 📍",
      body: messageBody,
      url: "/proximity"
    });
    
    // 2. Fetch push subscriptions
    const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", user.id);
    
    let successCount = 0;
    if (subs) {
      for (const sub of subs) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          await webPush.sendNotification(pushSubscription, payload);
          successCount++;
        } catch (e) {
          // Ignore
        }
      }
    }
    
    console.log(`Sent to user ${user.id}: ${messageBody}`);
  }
  console.log("Done.");
}

runTestBroadcast();
