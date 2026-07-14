import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const fcmMessaging = getMessaging();

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

    const title = "ProxNet Network Update 📍";

    // 1. Insert into in_app_notifications
    await supabase.from("in_app_notifications").insert({
      user_id: user.id,
      title,
      body: messageBody,
      url: "/proximity"
    });

    // 2. Fetch user's FCM tokens
    const { data: tokens } = await supabase.from("fcm_tokens").select("*").eq("user_id", user.id);

    if (tokens && tokens.length > 0) {
      console.log(`Sending test FCM to ${tokens.length} active devices for user ${user.id}...`);
      for (const tokenRecord of tokens) {
        try {
          await fcmMessaging.send({
            token: tokenRecord.token,
            notification: {
              title,
              body: messageBody,
            },
            webpush: {
              fcmOptions: {
                link: "https://www.proxnet.in/proximity",
              },
              notification: {
                icon: "/logo.png",
                badge: "/icons/icon-96.png",
                data: { url: "/proximity" },
              },
            },
            android: {
              priority: "high",
              notification: {
                channelId: "proxnet_messages",
                sound: "default",
                icon: "@mipmap/ic_launcher",
              },
            },
          });
        } catch (err: any) {
          console.error("Test FCM delivery failed:", err.code);
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            await supabase.from("fcm_tokens").delete().eq("id", tokenRecord.id);
          }
        }
      }
    }
  }

  console.log("Test broadcast run completed.");
}

runTestBroadcast().catch(console.error);
