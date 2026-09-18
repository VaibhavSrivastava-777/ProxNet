import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import type { MicroStatus } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusMeters = Number(searchParams.get("radius")) || 3000;

  if (!isSupabaseConfigured()) {
    // Return mock active beacons for local dev
    const now = new Date();
    const expires = new Date(now.getTime() + 35 * 60000).toISOString();
    const mockBeacons: MicroStatus[] = [
      {
        id: "beacon-1",
        user_id: "user-101",
        activity: "chai",
        note: "At Third Wave Coffee / clubhouse",
        lat: latParam ? Number(latParam) + 0.002 : 12.9716,
        lng: lngParam ? Number(lngParam) + 0.003 : 77.5946,
        created_at: now.toISOString(),
        expires_at: expires,
        user: {
          id: "user-101",
          full_name: "Karan Gupta",
          company: "Zerodha",
          job_title: "Tech Lead",
          profile_photo_url: null,
          society_name: "Prestige Falcon City",
        },
      },
      {
        id: "beacon-2",
        user_id: "user-102",
        activity: "walk",
        note: "Evening walk on outer track",
        lat: latParam ? Number(latParam) - 0.001 : 12.9710,
        lng: lngParam ? Number(lngParam) - 0.002 : 77.5940,
        created_at: now.toISOString(),
        expires_at: expires,
        user: {
          id: "user-102",
          full_name: "Neha Sharma",
          company: "Microsoft",
          job_title: "Product Designer",
          profile_photo_url: null,
          society_name: "Prestige Falcon City",
        },
      },
    ];
    return NextResponse.json({ beacons: mockBeacons });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Query unexpired beacons with poster profile info
  const { data: beacons, error } = await supabase
    .from("micro_status")
    .select(`
      id,
      user_id,
      activity,
      note,
      lat,
      lng,
      created_at,
      expires_at,
      user:users!micro_status_user_id_fkey (
        id,
        full_name,
        company,
        job_title,
        profile_photo_url,
        society_name,
        quick_chat_preference
      )
    `)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("Micro-status query fallback:", error.message);
    const mockExpires = new Date(Date.now() + 40 * 60000).toISOString();
    return NextResponse.json({
      beacons: [
        {
          id: "local-beacon-sample",
          user_id: "local-user-sample",
          activity: "chai",
          note: "Clubhouse coffee corner",
          lat: latParam ? Number(latParam) + 0.001 : 12.8912,
          lng: lngParam ? Number(lngParam) + 0.001 : 77.5643,
          created_at: new Date().toISOString(),
          expires_at: mockExpires,
          user: {
            id: "local-user-sample",
            full_name: "Community Neighbor",
            company: "Tech Enterprise",
            job_title: "Senior SDE",
          },
        },
      ],
    });
  }

  return NextResponse.json({ beacons: beacons || [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const activity = body.activity || "chai";
  const note = body.note ? String(body.note).trim() : null;
  const durationMins = Math.min(Math.max(Number(body.duration_mins) || 45, 15), 180);
  const lat = body.lat != null ? Number(body.lat) : user.home_lat;
  const lng = body.lng != null ? Number(body.lng) : user.home_lng;

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: "Location is required to broadcast a local beacon." },
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      success: true,
      beacon: {
        id: "mock-new-beacon",
        user_id: user.id,
        activity,
        note,
        lat,
        lng,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
    });
  }

  const supabase = createAdminClient();

  // Remove existing active beacon for this user before inserting new one
  await supabase.from("micro_status").delete().eq("user_id", user.id);

  const { data, error } = await supabase
    .from("micro_status")
    .insert({
      user_id: user.id,
      activity,
      note,
      lat,
      lng,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    console.warn("Falling back to local beacon response:", error.message);
    return NextResponse.json({
      success: true,
      beacon: {
        id: "local-" + Date.now(),
        user_id: user.id,
        activity,
        note,
        lat,
        lng,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
    });
  }

  return NextResponse.json({ success: true, beacon: data });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isSupabaseConfigured()) {
    const supabase = createAdminClient();
    await supabase.from("micro_status").delete().eq("user_id", user.id);
  }

  return NextResponse.json({ success: true, message: "Beacon cancelled." });
}
