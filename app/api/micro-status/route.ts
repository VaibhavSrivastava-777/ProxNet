import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { haversineDistanceMeters } from "@/lib/geo/haversine";
import type { MicroStatus } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusMeters = Number(searchParams.get("radius")) || 50000; // default 50km
  const lat = latParam ? Number(latParam) : null;
  const lng = lngParam ? Number(lngParam) : null;

  const supabase = createAdminClient();
  const now = new Date();

  // Query users that have an active_beacon set in their profile_digest
  const { data: usersWithBeacon, error } = await supabase
    .from("users")
    .select(`
      id,
      full_name,
      company,
      job_title,
      profile_photo_url,
      society_name,
      quick_chat_preference,
      home_lat,
      home_lng,
      profile_digest
    `)
    .not("profile_digest->active_beacon", "is", null);

  if (error || !usersWithBeacon) {
    console.warn("Micro-status fetch error:", error?.message);
    return NextResponse.json({ beacons: [] });
  }

  const activeBeacons: MicroStatus[] = [];

  for (const u of usersWithBeacon) {
    const rawBeacon = u.profile_digest?.active_beacon;
    if (!rawBeacon || !rawBeacon.expires_at) continue;

    const expiresDate = new Date(rawBeacon.expires_at);
    // Filter out expired beacons
    if (expiresDate.getTime() <= now.getTime()) {
      continue;
    }

    const beaconLat = rawBeacon.lat != null ? Number(rawBeacon.lat) : (u.home_lat ? Number(u.home_lat) : null);
    const beaconLng = rawBeacon.lng != null ? Number(rawBeacon.lng) : (u.home_lng ? Number(u.home_lng) : null);

    // Optional proximity filter if coordinates provided
    if (lat != null && lng != null && beaconLat != null && beaconLng != null) {
      const dist = haversineDistanceMeters(lat, lng, beaconLat, beaconLng);
      if (dist > radiusMeters) {
        continue;
      }
    }

    activeBeacons.push({
      id: rawBeacon.id || `beacon-${u.id}`,
      user_id: u.id,
      activity: rawBeacon.activity || "chai",
      note: rawBeacon.note || null,
      lat: beaconLat ?? 0,
      lng: beaconLng ?? 0,
      created_at: rawBeacon.created_at || now.toISOString(),
      expires_at: rawBeacon.expires_at,
      duration_mins: rawBeacon.duration_mins || 45,
      user: {
        id: u.id,
        full_name: "Community Neighbor", // Anonymize broadcaster identity for other users
        company: u.company || rawBeacon.company || "Nearby Company",
        job_title: u.job_title || rawBeacon.job_title || "Professional",
        profile_photo_url: u.profile_photo_url || rawBeacon.profile_photo_url || null,
        society_name: u.society_name || null,
        quick_chat_preference: u.quick_chat_preference || "chai",
      },
    });
  }

  // Sort latest first
  activeBeacons.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Check if current user has an active broadcast
  let myBeacon: MicroStatus | null = null;
  const currentUser = await getCurrentUser();
  if (currentUser) {
    const rawMy = (currentUser as any).profile_digest?.active_beacon;
    if (rawMy && rawMy.expires_at && new Date(rawMy.expires_at).getTime() > now.getTime()) {
      myBeacon = {
        id: rawMy.id || `beacon-${currentUser.id}`,
        user_id: currentUser.id,
        activity: rawMy.activity || "chai",
        note: rawMy.note || null,
        lat: rawMy.lat != null ? Number(rawMy.lat) : (currentUser.home_lat ? Number(currentUser.home_lat) : 0),
        lng: rawMy.lng != null ? Number(rawMy.lng) : (currentUser.home_lng ? Number(currentUser.home_lng) : 0),
        created_at: rawMy.created_at || now.toISOString(),
        expires_at: rawMy.expires_at,
        duration_mins: rawMy.duration_mins || 45,
        user: {
          id: currentUser.id,
          full_name: "You",
          company: currentUser.company || rawMy.company || "Nearby Company",
          job_title: currentUser.job_title || rawMy.job_title || "Professional",
          profile_photo_url: currentUser.profile_photo_url || rawMy.profile_photo_url || null,
          society_name: currentUser.society_name || null,
          quick_chat_preference: currentUser.quick_chat_preference || "chai",
        },
      };
    }
  }

  return NextResponse.json({ beacons: activeBeacons, my_beacon: myBeacon });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const activity = body.activity || "chai";
  const note = body.note ? String(body.note).trim() : null;
  // Allow custom durations from 5 minutes to 180 minutes
  const durationMins = Math.min(Math.max(Number(body.duration_mins) || 45, 5), 180);
  const lat = body.lat != null ? Number(body.lat) : user.home_lat;
  const lng = body.lng != null ? Number(body.lng) : user.home_lng;

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "Location is required to broadcast a local beacon." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();

  const supabase = createAdminClient();

  const { data: userProfile, error: profileError } = await supabase
    .from("users")
    .select("id, profile_digest, job_title, company, full_name, profile_photo_url")
    .eq("id", user.id)
    .single();

  if (profileError || !userProfile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 500 });
  }

  const profileDigest = userProfile.profile_digest || {};

  // Disallow opening another broadcast when a current broadcast is still in motion
  if (profileDigest.active_beacon?.expires_at) {
    const existingExpires = new Date(profileDigest.active_beacon.expires_at).getTime();
    if (existingExpires > Date.now()) {
      return NextResponse.json(
        {
          error: "You already have an active broadcast in motion. Please close your current broadcast before starting a new one.",
          active_beacon: profileDigest.active_beacon,
        },
        { status: 409 }
      );
    }
  }

  const effectiveJobTitle = userProfile.job_title || user.job_title || "Professional";
  const effectiveCompany = userProfile.company || user.company || "Nearby Company";
  const effectiveFullName = userProfile.full_name || user.full_name || "Neighbor";
  const effectivePhoto = userProfile.profile_photo_url || user.profile_photo_url || null;

  const beaconData = {
    id: `beacon-${user.id}`,
    user_id: user.id,
    activity,
    note,
    duration_mins: durationMins,
    lat,
    lng,
    created_at: nowIso,
    expires_at: expiresAt,
    user_name: effectiveFullName,
    job_title: effectiveJobTitle,
    company: effectiveCompany,
    profile_photo_url: effectivePhoto,
  };

  profileDigest.active_beacon = beaconData;

  const { error: updateError } = await supabase
    .from("users")
    .update({ profile_digest: profileDigest })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    beacon: {
      ...beaconData,
      user: {
        id: user.id,
        full_name: effectiveFullName,
        company: effectiveCompany,
        job_title: effectiveJobTitle,
        profile_photo_url: effectivePhoto,
      },
    },
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: userProfile } = await supabase
    .from("users")
    .select("profile_digest")
    .eq("id", user.id)
    .single();

  if (userProfile?.profile_digest?.active_beacon) {
    const profileDigest = { ...userProfile.profile_digest };
    delete profileDigest.active_beacon;
    await supabase
      .from("users")
      .update({ profile_digest: profileDigest })
      .eq("id", user.id);
  }

  return NextResponse.json({ success: true, message: "Beacon cancelled." });
}
